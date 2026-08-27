"""音声から「盛り上がっている箇所」を検出し、字幕の強調レベルを決める。

テキストから推測する(「うわあ」が含まれるか等)のではなく、実際の音を測る。
配信者の叫びは表記が一定しない(うわあ / うわぁ / わあああ)ため、
文字列マッチでは取りこぼす。

2つの特徴量を見る。

  音量   … 素直な指標だが、マイクにコンプレッサーやリミッターが
           かかっているとまったく効かない。実際の配信素材(そらちゃんサブ)では
           26秒間ずっと -19.8〜-22.2 dBFS で、変化幅が 2.4dB しかなかった。
           目視では悲鳴を上げているのに、音量では検出できない。
  高域比 … 高域(2kHz以上)のエネルギーが全帯域に対しどれだけ強いか。
           叫び・高い声・興奮した発声は高域に寄る。同じ素材で
           -17.1〜-4.3 dB と 12.8dB の変化幅があり、明確に分離できた。

どちらか一方でも十分な変化幅があればそれを使う。両方とも平坦なら強調しない
(素材自体にメリハリが無いということ)。
"""

from __future__ import annotations

import array
import math
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

from . import config

LEVEL_NORMAL = 0
LEVEL_LOUD = 1

_RATE = 16000
_HIGHPASS_HZ = 2000
_SILENCE_DB = -55.0


@dataclass
class LevelTrack:
    """一定間隔で測った音声特徴の列。"""

    step_sec: float
    loud: list[float] = field(default_factory=list)    # 全帯域 dBFS
    bright: list[float] = field(default_factory=list)  # 高域比 (高域dB - 全域dB)
    # 笑いの検出用。振幅の脈動(ハハハ)を見るには0.1秒では粗すぎるため、
    # 25ms刻みの包絡線を別に持つ
    fine_step: float = 0.025
    fine: list[float] = field(default_factory=list)

    def _peak(self, values: list[float], start: float, end: float) -> float:
        if not values or end <= start:
            return -math.inf
        i0 = max(0, int(start / self.step_sec))
        i1 = min(len(values), int(math.ceil(end / self.step_sec)))
        if i1 <= i0:
            i1 = min(len(values), i0 + 1)
        window = values[i0:i1]
        return max(window) if window else -math.inf

    def loud_peak(self, start: float, end: float) -> float:
        return self._peak(self.loud, start, end)

    def bright_peak(self, start: float, end: float) -> float:
        return self._peak(self.bright, start, end)


def _rms_db(samples: array.array, lo: int, hi: int) -> float:
    if hi <= lo:
        return -math.inf
    total = 0
    for i in range(lo, hi):
        v = samples[i]
        total += v * v
    mean = total / (hi - lo)
    if mean <= 0:
        return -math.inf
    return 20.0 * math.log10(math.sqrt(mean) / 32768.0)


def _pcm(source: Path, start: float, duration: float, audio_index: int, af: str = "") -> array.array:
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-ss", f"{start:.3f}", "-t", f"{duration:.3f}", "-i", str(source),
        "-map", f"0:a:{audio_index}", "-vn", "-ac", "1", "-ar", str(_RATE),
    ]
    if af:
        cmd += ["-af", af]
    cmd += ["-f", "s16le", "-"]
    raw = subprocess.run(cmd, capture_output=True, timeout=1800).stdout
    out = array.array("h")
    out.frombytes(raw[: len(raw) // 2 * 2])
    return out


def analyze(source: Path, start: float, duration: float, audio_index: int = 0) -> LevelTrack:
    """音量と高域比の2系列を測る。ffmpegは2回だけ呼ぶ。"""
    full = _pcm(source, start, duration, audio_index)
    if len(full) < _RATE // 10:
        return LevelTrack(step_sec=config.EMPHASIS_STEP_SEC)
    high = _pcm(source, start, duration, audio_index, f"highpass=f={_HIGHPASS_HZ}")

    step = config.EMPHASIS_STEP_SEC
    win = max(1, int(_RATE * step))
    loud: list[float] = []
    bright: list[float] = []
    for lo in range(0, len(full) - win + 1, win):
        f = _rms_db(full, lo, lo + win)
        loud.append(f)
        if f <= _SILENCE_DB or lo + win > len(high):
            bright.append(-math.inf)  # 無音区間の高域比は意味を持たない
        else:
            h = _rms_db(high, lo, lo + win)
            bright.append(h - f if h > -math.inf else -math.inf)
    fine_win = max(1, int(_RATE * 0.025))
    fine = [_rms_db(full, lo, lo + fine_win) for lo in range(0, len(full) - fine_win + 1, fine_win)]
    return LevelTrack(step_sec=step, loud=loud, bright=bright, fine_step=0.025, fine=fine)


def _stats(values: list[float]) -> tuple[float, float]:
    """(中央値, 上位10%と中央値の差)。差が小さい特徴量は判定に使えない。"""
    valid = sorted(v for v in values if v > -math.inf)
    if len(valid) < 8:
        return -math.inf, 0.0
    median = valid[len(valid) // 2]
    p90 = valid[min(len(valid) - 1, int(len(valid) * 0.9))]
    return median, p90 - median


def _features(track: LevelTrack):
    """使える特徴量だけを (ピーク取得関数, しきい値) で返す。"""
    out = []
    for values, peak_of, need_db in (
        (track.loud, track.loud_peak, config.EMPHASIS_LOUD_DB),
        (track.bright, track.bright_peak, config.EMPHASIS_BRIGHT_DB),
    ):
        _, spread = _stats(values)
        if spread >= config.EMPHASIS_MIN_SPREAD_DB:
            out.append((peak_of, need_db))
    return out


def _select_top(peaks: list[float], ratio: float, min_spread: float) -> list[bool]:
    """ピークの上位 ratio 割を選ぶ。ばらつきが小さければ何も選ばない。

    「中央値より N dB 大きいもの」という相対比較は、クリップの大半が
    盛り上がっている素材では機能しない。中央値自体が引き上げられ、
    どのブロックもしきい値を超えなくなるため。
    実素材(そらちゃんサブ)は26秒中16秒が悲鳴で、この方式では0件だった。
    上位から選べば、素材の性質によらず必ず見せ場を拾える。
    """
    valid = sorted((p for p in peaks if p > -math.inf), reverse=True)
    if len(valid) < 2 or valid[0] - valid[-1] < min_spread:
        return [False] * len(peaks)
    take = max(1, int(round(len(valid) * ratio)))
    cutoff = valid[take - 1]
    return [p > -math.inf and p >= cutoff for p in peaks]


def classify(track: LevelTrack, blocks: list[tuple[float, float]]) -> list[int]:
    """字幕ブロックごとの強調レベルを返す。

    音量と高域比のうち、十分な変化幅を持つ特徴量だけを使う。
    コンプレッサーで潰れた素材では音量が平坦になるため、
    そのまま使うとしきい値付近のノイズで誤検出する。
    """
    if len(blocks) < config.EMPHASIS_MIN_BLOCKS:
        return [LEVEL_NORMAL] * len(blocks)

    feats = _features(track)
    if not feats:
        return [LEVEL_NORMAL] * len(blocks)

    votes = [False] * len(blocks)
    for peak_of, _need_db in feats:
        peaks = [peak_of(s, e) for s, e in blocks]
        got = _select_top(peaks, config.EMPHASIS_TOP_RATIO, config.EMPHASIS_MIN_SPREAD_DB)
        votes = [a or b for a, b in zip(votes, got)]
    return [LEVEL_LOUD if v else LEVEL_NORMAL for v in votes]


def mark_peak_words(track: LevelTrack, words: list) -> None:
    """ブロック内で最も目立つ「ひとつながりの区間」に emphasis を立てる。

    上位N%の語を個別に選ぶと、日本語Whisperの語が細かすぎるせいで
    「なん」「で3袋か」「3」「袋が」のように断片が散らばり、
    かえって雑に見える。連続した1区間だけを選ぶと意図的な強調に見える。
    """
    if len(words) < 2:
        for w in words:
            w.emphasis = 1
        return

    # 語ごとのスコア。使える特徴量の中央値からの超過分を足し合わせる
    scores = [0.0] * len(words)
    used = False
    for peak_of in (track.loud_peak, track.bright_peak):
        peaks = [peak_of(w.start, w.end) for w in words]
        valid = sorted(p for p in peaks if p > -math.inf)
        if len(valid) < 2 or valid[-1] - valid[0] < config.WORD_MIN_SPREAD_DB:
            continue
        used = True
        median = valid[len(valid) // 2]
        for i, p in enumerate(peaks):
            if p > -math.inf:
                scores[i] += p - median
    if not used:
        return

    # 1〜MAX語の連続区間のうち、平均スコアが最大のものを選ぶ
    best, best_avg = None, -math.inf
    max_len = min(config.WORD_EMPHASIS_MAX_RUN, len(words))
    for length in range(1, max_len + 1):
        for i in range(len(words) - length + 1):
            avg = sum(scores[i:i + length]) / length
            # 短すぎる断片(1文字)だけの強調は避ける
            text_len = sum(len(words[j].text) for j in range(i, i + length))
            if text_len < config.WORD_EMPHASIS_MIN_CHARS:
                continue
            if avg > best_avg:
                best_avg, best = avg, (i, length)

    if best is None:
        return
    i, length = best
    for j in range(i, i + length):
        words[j].emphasis = 1


def describe(track: LevelTrack, blocks: list[tuple[float, float]], levels: list[int]) -> str:
    lines = []
    for label, values, unit in (("音量", track.loud, "dBFS"), ("高域比", track.bright, "dB")):
        median, spread = _stats(values)
        if median == -math.inf:
            lines.append(f"  {label}: 測定不可")
            continue
        usable = "使用" if spread >= config.EMPHASIS_MIN_SPREAD_DB else "平坦のため不使用"
        lines.append(f"  {label}: 中央値 {median:.1f} {unit} / 変化幅 {spread:.1f} dB → {usable}")
    loud = sum(1 for lv in levels if lv == LEVEL_LOUD)
    lines.append(f"  強調ブロック: {loud}/{len(blocks)}")
    return "\n".join(lines)

def _pulse_rate(values: list[float], step: float) -> float:
    """包絡線が1秒あたり何回上向きに平均を横切るか。笑いの「ハハハ」を数える。

    笑いは4〜8Hz程度で振幅が脈動する。叫びは持続音なので脈動が少なく、
    通常発話は音節ごとに揺れるがそこまで規則的に速くない。
    """
    valid = [v for v in values if v > -math.inf]
    if len(valid) < 8:
        return 0.0
    mean = sum(valid) / len(valid)
    crossings = 0
    prev_above = values[0] > mean if values[0] > -math.inf else False
    for v in values[1:]:
        above = v > mean if v > -math.inf else False
        if above and not prev_above:
            crossings += 1
        prev_above = above
    return crossings / (len(values) * step)


def detect_laughter(track: LevelTrack, start: float, end: float) -> bool:
    """区間が笑い声かどうかを判定する。

    Whisperは「あははは」のような非言語音声を文字にしない。VADを切っても同じ。
    そこで音響特徴から拾い、字幕を自前で挿入する。

    条件は3つ。
      1. 十分に大きい      … 小さな相槌を拾わない
      2. 高域が持ち上がる  … 笑いは息の成分が多く高域に寄る
      3. 振幅が脈動する    … 「ハハハ」の周期。叫びとの決定的な違い
    """
    if end - start < config.LAUGH_MIN_SEC:
        return False
    if track.loud_peak(start, end) < config.LAUGH_MIN_DB:
        return False
    if track.bright_peak(start, end) < config.LAUGH_MIN_BRIGHT_DB:
        return False

    return peak_pulse_rate(track, start, end) >= config.LAUGH_PULSE_MIN_HZ


def peak_pulse_rate(track: LevelTrack, start: float, end: float) -> float:
    """1秒窓をスライドさせたときの脈動率の最大値。

    区間全体をまとめて測ると、笑いの前後の無音や通常発話に薄められて
    数値が出ない。実素材では13秒の区間で 1.3Hz しか出なかった。
    笑いは数秒の塊なので、短い窓の最大値で見る。
    """
    win = int(1.0 / track.fine_step)
    i0 = max(0, int(start / track.fine_step))
    i1 = min(len(track.fine), int(math.ceil(end / track.fine_step)))
    if i1 - i0 < win:
        return _pulse_rate(track.fine[i0:i1], track.fine_step)
    best = 0.0
    for i in range(i0, i1 - win + 1, max(1, win // 4)):
        seg = track.fine[i:i + win]
        # 窓内が十分に鳴っていること(無音の揺らぎを拾わない)
        loud = [v for v in seg if v > -math.inf]
        if not loud or max(loud) < config.LAUGH_MIN_DB:
            continue
        best = max(best, _pulse_rate(seg, track.fine_step))
    return best


def laughter_text(duration: float, pulse_hz: float, index: int = 0) -> str:
    """笑いのテロップ。長さと脈動の速さで表現を変える。

    毎回「あははは」だと機械的に見える。実際の切り抜きでは、短い笑いは
    「ｗｗｗ」、長く続く笑いは「あははは」と使い分けられている。
    脈動が速い(≒早口の笑い)ほど「ｗ」寄りにする。
    連続して同じ表現にならないよう index でも振り分ける。
    """
    n = max(2, min(config.LAUGH_MAX_HA, int(duration / 0.35)))

    if duration < config.LAUGH_SHORT_SEC:
        # 短い笑いは「ｗ」で軽く見せる
        return "ｗ" * max(2, min(5, int(duration / 0.25)))

    if pulse_hz >= config.LAUGH_FAST_HZ:
        # 速く刻む笑いは草表現の方が近い
        return "ｗ" * max(3, min(8, n + 1))

    # 長く続く笑いは声として書く。表記は交互に変えて単調さを避ける
    if index % 2:
        return "は" * n + "っ"
    return "あ" + "は" * n + "っ"


def find_laughs(track: LevelTrack, start: float, end: float) -> list[tuple[float, float, float]]:
    """区間内の笑い箇所を (開始, 終了, 脈動Hz) で返す。

    検出窓は1秒刻みなので、そのまま使うと実際の発声より最大1秒早く
    字幕が出てしまう。窓の中で音が立ち上がる位置まで開始を詰める。
    """
    win = int(1.0 / track.fine_step)
    i0 = max(0, int(start / track.fine_step))
    i1 = min(len(track.fine), int(math.ceil(end / track.fine_step)))
    if i1 - i0 < win:
        return []

    hits: list[tuple[float, float, float]] = []
    step = max(1, win // 4)
    for i in range(i0, i1 - win + 1, step):
        seg = track.fine[i:i + win]
        loud = [v for v in seg if v > -math.inf]
        if not loud or max(loud) < config.LAUGH_MIN_DB:
            continue
        t0 = i * track.fine_step
        t1 = t0 + 1.0
        if track.bright_peak(t0, t1) < config.LAUGH_MIN_BRIGHT_DB:
            continue
        rate = _pulse_rate(seg, track.fine_step)
        if rate < config.LAUGH_PULSE_MIN_HZ:
            continue
        hits.append((t0, t1, rate))

    if not hits:
        return []
    merged = [list(hits[0])]
    for a, b, r in hits[1:]:
        if a <= merged[-1][1] + 0.3:
            merged[-1][1] = max(merged[-1][1], b)
            merged[-1][2] = max(merged[-1][2], r)
        else:
            merged.append([a, b, r])

    out: list[tuple[float, float, float]] = []
    for a, b, r in merged:
        b = min(b, end)
        a = _onset(track, a, b)
        if b - a >= config.LAUGH_MIN_SEC:
            out.append((a, b, r))
    return out


def _onset(track: LevelTrack, start: float, end: float) -> float:
    """区間内で実際に音が立ち上がる位置を返す。

    検出窓の頭は無音を含むことがあり、そのまま字幕の開始にすると
    「声を出していないのに先にテキストが出る」状態になる。
    """
    i0 = max(0, int(start / track.fine_step))
    i1 = min(len(track.fine), int(math.ceil(end / track.fine_step)))
    seg = [v for v in track.fine[i0:i1] if v > -math.inf]
    if not seg:
        return start
    thr = max(seg) - config.LAUGH_ONSET_DROP_DB
    for k in range(i0, i1):
        v = track.fine[k]
        if v > -math.inf and v >= thr:
            return k * track.fine_step
    return start
