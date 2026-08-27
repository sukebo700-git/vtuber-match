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
    return LevelTrack(step_sec=step, loud=loud, bright=bright)


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
