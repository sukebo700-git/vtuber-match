"""音声の音量から「叫んでいる箇所」を検出し、字幕の強調レベルを決める。

テキストから推測する(「うわあ」が含まれるか等)のではなく、実際の音量を測る。
配信者の叫びは表記が一定しない(うわあ / うわぁ / わあああ)ため、
文字列マッチでは取りこぼす。音量なら確実に拾える。

判定は絶対値ではなく、そのクリップ内の中央値からの相対値で行う。
配信者ごと・環境ごとに基準音量が違うため、絶対dBでは使い物にならない。
"""

from __future__ import annotations

import array
import math
import subprocess
from dataclasses import dataclass
from pathlib import Path

from . import config

# 強調レベル
LEVEL_NORMAL = 0
LEVEL_LOUD = 1


@dataclass
class LevelTrack:
    """一定間隔で測った音量(dBFS)の列。"""

    step_sec: float
    values: list[float]
    median: float

    def peak_between(self, start: float, end: float) -> float:
        """区間内のピーク音量(dBFS)。区間が空なら -inf。"""
        if not self.values or end <= start:
            return -math.inf
        i0 = max(0, int(start / self.step_sec))
        i1 = min(len(self.values), int(math.ceil(end / self.step_sec)))
        if i1 <= i0:
            i1 = min(len(self.values), i0 + 1)
        window = self.values[i0:i1]
        return max(window) if window else -math.inf

def classify(track: LevelTrack, blocks: list[tuple[float, float]]) -> list[int]:
    """字幕ブロックごとの強調レベルを返す。

    比較対象は「全0.1秒窓の中央値」ではなく「各ブロックのピークの中央値」。
    前者と比べると、無音や息継ぎを含む窓が中央値を押し下げるため、
    発話しているブロックが軒並みしきい値を超えて全部強調されてしまう。
    実測(台本録音121秒)では、全窓の中央値 -42.6 dBFS に対し
    通常発話のピークが -26〜-31 dBFS で、叫びと区別できなかった。

    ブロックのピーク同士で比べると、叫び(-17.1)と笑い(-20.4)だけが
    通常発話(-26〜-31)から分離される。
    """
    peaks = [track.peak_between(s, e) for s, e in blocks]
    valid = sorted(p for p in peaks if p > -math.inf)

    # ブロック数が少ないと中央値が不安定になるため、強調しない
    if len(valid) < config.EMPHASIS_MIN_BLOCKS:
        return [LEVEL_NORMAL] * len(blocks)

    median = valid[len(valid) // 2]
    threshold = median + config.EMPHASIS_LOUD_DB
    return [
        LEVEL_LOUD if p > -math.inf and p >= threshold else LEVEL_NORMAL
        for p in peaks
    ]


def describe_blocks(
    track: LevelTrack, blocks: list[tuple[float, float]], levels: list[int]
) -> str:
    peaks = [track.peak_between(s, e) for s, e in blocks]
    valid = sorted(p for p in peaks if p > -math.inf)
    if not valid:
        return "  音量解析: 有効な区間なし"
    median = valid[len(valid) // 2]
    loud = sum(1 for lv in levels if lv == LEVEL_LOUD)
    return (
        f"  音量解析: ブロックピークの中央値 {median:.1f} dBFS / "
        f"しきい値 {median + config.EMPHASIS_LOUD_DB:.1f} dBFS / "
        f"強調 {loud}/{len(blocks)} ブロック"
    )


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


def analyze(source: Path, start: float, duration: float, audio_index: int = 0) -> LevelTrack:
    """音声を一括で読み、一定間隔のdBFS列を返す。

    ffmpegを何度も呼ばず、生PCMを1回だけ取り出して自前で計算する。
    """
    rate = 8000  # 音量を測るだけなので低いサンプルレートで足りる
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-ss", f"{start:.3f}", "-t", f"{duration:.3f}", "-i", str(source),
        "-map", f"0:a:{audio_index}",
        "-vn", "-ac", "1", "-ar", str(rate),
        "-f", "s16le", "-",
    ]
    proc = subprocess.run(cmd, capture_output=True, timeout=900)
    raw = proc.stdout
    if len(raw) < 2:
        return LevelTrack(step_sec=config.EMPHASIS_STEP_SEC, values=[], median=-math.inf)

    samples = array.array("h")
    samples.frombytes(raw[: len(raw) // 2 * 2])

    step = config.EMPHASIS_STEP_SEC
    win = max(1, int(rate * step))
    values: list[float] = []
    for lo in range(0, len(samples) - win + 1, win):
        values.append(_rms_db(samples, lo, lo + win))

    voiced = [v for v in values if v > -60.0]  # 無音区間は基準から除く
    voiced.sort()
    median = voiced[len(voiced) // 2] if voiced else -math.inf
    return LevelTrack(step_sec=step, values=values, median=median)


def mark_peak_words(track: LevelTrack, words: list) -> None:
    """語列のうち、そのブロック内で特に音が大きい語に emphasis を立てる。

    ブロック全体を大きくするのではなく、行の中の1〜数語だけを跳ねさせる。
    プロのテロップは行全体を拡大せず、キーワードだけが動く。
    """
    peaks = [track.peak_between(w.start, w.end) for w in words]
    valid = sorted(p for p in peaks if p > -math.inf)
    if len(valid) < 2:
        for w in words:
            w.emphasis = 1
        return
    median = valid[len(valid) // 2]
    threshold = median + config.WORD_EMPHASIS_DB
    hit = False
    for w, p in zip(words, peaks):
        if p > -math.inf and p >= threshold:
            w.emphasis = 1
            hit = True
    if not hit:
        # 全語が横並びなら、最大の語だけを跳ねさせる(必ず1語は強調する)
        best = max(range(len(words)), key=lambda i: peaks[i])
        words[best].emphasis = 1
