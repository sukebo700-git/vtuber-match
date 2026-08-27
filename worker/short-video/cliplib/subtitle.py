"""Word列 → ASS字幕への変換。

品質の8割はここで決まる(調査報告書 第4部)。特に日本語の改行位置。
budouxが入っていれば文節境界を使い、無ければ助詞ベースの規則で代替する。
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass, field

from . import config
from .transcribe import Word

# 行頭に置いてはいけない文字(禁則処理)
NO_LINE_START = "、。，．）］｝」』〉》・ー…‥！？!?ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ々〃"
# 行末に置いてはいけない文字
NO_LINE_END = "（［｛「『〈《"

# 改行の優先度。数字が大きいほど改行したい位置
_BREAK_AFTER_STRONG = "、。！？!?"
_PARTICLES = ("は", "が", "を", "に", "で", "と", "も", "の", "へ", "や", "から", "まで", "より", "ね", "よ")
_CONJUNCTIVE = ("て", "けど", "けれど", "ので", "から")


@dataclass
class Segment:
    """1つの字幕ブロック(Dialogue 1行に対応)。"""

    words: list[Word]
    speaker: int = 0
    line_breaks: set[int] = field(default_factory=set)  # ここのindexの語の直前で改行

    @property
    def start(self) -> float:
        return self.words[0].start

    @property
    def end(self) -> float:
        return self.words[-1].end

    @property
    def text(self) -> str:
        return "".join(w.text for w in self.words)


# --------------------------------------------------------------------------
# 文字幅
# --------------------------------------------------------------------------

def char_width(ch: str) -> float:
    """全角=1.0 / 半角=0.5 として概算する。"""
    return 1.0 if unicodedata.east_asian_width(ch) in ("F", "W", "A") else 0.5


def text_width(text: str) -> float:
    return sum(char_width(c) for c in text)


# --------------------------------------------------------------------------
# セグメント分割
# --------------------------------------------------------------------------

def _split_to_fit(words: list[Word]) -> list[list[Word]]:
    """2行に収まらない語列を、安全な区切り位置で分割する。

    分割位置はタイミングではなく言語的な妥当性で選ぶ。日本語のWhisperは
    「お/しゃ/べ/り」のような断片を1語として返すため、語間ギャップで切ると
    単語の途中で割れてしまう。
    """
    capacity = config.MAX_LINE_WIDTH * config.MAX_LINES
    if text_width("".join(w.text for w in words)) <= capacity or len(words) < 2:
        return [words]

    full = "".join(w.text for w in words)
    offsets: list[int] = []
    pos = 0
    for w in words:
        offsets.append(pos)
        pos += len(w.text)
    boundaries = _budoux_boundaries(full)

    best_index = -1
    best_score = -10_000
    for i in range(1, len(words)):
        width = text_width("".join(w.text for w in words[:i]))
        if width > capacity:
            break
        score = _break_score(words[i - 1].text, words[i].text)
        if boundaries and offsets[i] in boundaries:
            score += 50
        score += int(width / capacity * 30)
        if score >= best_score:
            best_score = score
            best_index = i

    if best_index <= 0:
        # 安全な位置が見つからない(記号の連続など)。容量ぴったりで機械的に切る
        best_index = 1
        for i in range(1, len(words)):
            if text_width("".join(w.text for w in words[:i])) > capacity:
                break
            best_index = i

    return [words[:best_index], *_split_to_fit(words[best_index:])]


def group_words(words: list[Word]) -> list[Segment]:
    """Word列を字幕ブロックに分割する。

    Whisperのセグメント境界と話者の変わり目を「絶対に跨がない境界」として扱い、
    その内側でだけ、2行に収まらない場合に安全な位置で分割する。

    語間ギャップでの分割は行わない。日本語では語の粒度が細かすぎて
    ギャップが当てにならず、「これがア」「イギス、エ」のような破綻を招くため。
    """
    if not words:
        return []

    # 話者ごとに独立してグルーピングする。
    # 時刻順の1本の列にしてから話者の変わり目で切ると、2人が同時に喋ったときに
    # 1語ずつ交互になり「行くよア」「はいみ」「イ」「なさん」のように粉砕される。
    # マルチトラック収録では発話が常時重なるため、話者ごとに分けてから組む。
    by_speaker: dict[int, list[Word]] = {}
    for word in words:
        by_speaker.setdefault(word.speaker, []).append(word)

    segments: list[Segment] = []
    for speaker in sorted(by_speaker):
        stream = sorted(by_speaker[speaker], key=lambda w: w.start)
        chunks: list[list[Word]] = []
        current: list[Word] = []
        for word in stream:
            if current and word.segment != current[-1].segment:
                chunks.append(current)
                current = []
            current.append(word)
        if current:
            chunks.append(current)

        for chunk in chunks:
            for piece in _split_to_fit(chunk):
                if not piece:
                    continue
                seg = Segment(words=piece, speaker=speaker)
                seg.line_breaks = _decide_line_breaks(piece)
                segments.append(seg)

    # ASSは重なったDialogueを同時に描画する。話者ごとにMarginVを変えて段積みする
    segments.sort(key=lambda s: (s.start, s.speaker))
    return segments


# --------------------------------------------------------------------------
# 改行位置の決定
# --------------------------------------------------------------------------

def _budoux_boundaries(text: str) -> set[int]:
    """budouxで文節境界の文字オフセットを得る。未インストールなら空集合。"""
    try:
        import budoux  # type: ignore[import-not-found]
    except ImportError:
        return set()
    try:
        parser = budoux.load_default_japanese_parser()
        offsets: set[int] = set()
        pos = 0
        for chunk in parser.parse(text):
            offsets.add(pos)
            pos += len(chunk)
        return offsets
    except Exception:
        # budouxの内部エラーで字幕生成全体を止めたくない
        return set()


def _break_score(prev_text: str, next_text: str) -> int:
    """語と語の間で改行する妥当性。大きいほど改行してよい。"""
    if not prev_text or not next_text:
        return 0
    last = prev_text[-1]
    first = next_text[0]

    if first in NO_LINE_START:
        return -100
    if last in NO_LINE_END:
        return -100
    if last in _BREAK_AFTER_STRONG:
        return 100
    if prev_text.endswith(_PARTICLES):
        return 60
    if prev_text.endswith(_CONJUNCTIVE):
        return 40
    return 10


def _decide_line_breaks(words: list[Word]) -> set[int]:
    """words のどのindexの直前で改行するかを決める(最大 MAX_LINES-1 箇所)。"""
    if len(words) < 2:
        return set()

    full = "".join(w.text for w in words)
    if text_width(full) <= config.MAX_LINE_WIDTH:
        return set()  # 1行に収まる

    # 各語の開始文字オフセット
    offsets: list[int] = []
    pos = 0
    for w in words:
        offsets.append(pos)
        pos += len(w.text)

    boundaries = _budoux_boundaries(full)

    breaks: set[int] = set()
    line_start = 0
    for _ in range(config.MAX_LINES - 1):
        best_index = -1
        best_score = -10_000

        for i in range(line_start + 1, len(words)):
            width = text_width("".join(w.text for w in words[line_start:i]))
            if width > config.MAX_LINE_WIDTH:
                break  # これ以上は1行に収まらない

            score = _break_score(words[i - 1].text, words[i].text)
            if boundaries and offsets[i] in boundaries:
                score += 50  # budouxが文節の切れ目と判断した位置を優遇
            # 行がある程度埋まっている方が見栄えがよい
            score += int(width / config.MAX_LINE_WIDTH * 30)

            if score >= best_score:
                best_score = score
                best_index = i

        if best_index <= line_start:
            break
        breaks.add(best_index)
        line_start = best_index
        if text_width("".join(w.text for w in words[line_start:])) <= config.MAX_LINE_WIDTH:
            break

    return breaks


# --------------------------------------------------------------------------
# ASS生成
# --------------------------------------------------------------------------

def escape_ass(text: str) -> str:
    """ASSタグ注入を防ぐ(調査報告書 第11部 #15)。

    '{' '}' '\\' はASSの制御文字なので、全角に置換して無力化する。
    日本語字幕では見た目の劣化がほぼない。
    """
    return (
        text.replace("\\", "＼")
        .replace("{", "｛")
        .replace("}", "｝")
        .replace("\r", "")
        .replace("\n", "")
    )


def format_time(seconds: float) -> str:
    seconds = max(0.0, seconds)
    h = int(seconds // 3600)
    m = int(seconds % 3600 // 60)
    s = seconds % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def _style_block(speaker_count: int) -> str:
    fmt = (
        "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,"
        "Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,"
        "Alignment,MarginL,MarginR,MarginV,Encoding"
    )
    rows = [fmt]
    for i in range(max(1, speaker_count)):
        color = config.SPEAKER_COLORS[i % len(config.SPEAKER_COLORS)]
        # 話者が複数いる場合、発話が重なると字幕も重なる。段積みして読めるようにする
        margin_v = config.MARGIN_V + (i * config.SPEAKER_MARGIN_STEP if speaker_count > 1 else 0)
        rows.append(
            f"Style: Speaker{i},{config.FONT_NAME},{config.FONT_SIZE},{color},{config.COLOR_KARAOKE},"
            f"{config.COLOR_OUTLINE},{config.COLOR_BACK},1,0,0,0,100,100,0,0,1,"
            f"{config.OUTLINE},{config.SHADOW},2,{config.MARGIN_H},{config.MARGIN_H},{margin_v},1"
        )
    return "\n".join(rows)


def _dialogue_text(seg: Segment, karaoke: bool) -> str:
    parts = ["{\\fad(80,80)}"]
    cursor = seg.start
    for i, word in enumerate(seg.words):
        if i in seg.line_breaks:
            parts.append("\\N")
        if karaoke:
            # 語の前の無音ぶんも \k で送らないと強調がずれていく
            gap_cs = int(round(max(0.0, word.start - cursor) * 100))
            if gap_cs > 0:
                parts.append(f"{{\\k{gap_cs}}}")
            dur_cs = max(1, int(round(word.duration * 100)))
            parts.append(f"{{\\k{dur_cs}}}")
            cursor = word.end
        parts.append(escape_ass(word.text))
    return "".join(parts)


def build_ass(segments: list[Segment], karaoke: bool = True) -> str:
    """字幕ブロック列からASSファイルの中身を作る。"""
    speaker_count = max((s.speaker for s in segments), default=0) + 1

    head = (
        "[Script Info]\n"
        "; VtuberMatch clip generator\n"
        "; 話者の色を変えるには、各Dialogue行のStyle列を Speaker0 / Speaker1 ... に書き換えてください\n"
        "ScriptType: v4.00+\n"
        f"PlayResX: {config.OUT_WIDTH}\n"
        f"PlayResY: {config.OUT_HEIGHT}\n"
        "WrapStyle: 2\n"  # 自動折り返しを止め、\N の位置だけで改行する
        "ScaledBorderAndShadow: yes\n"
        "YCbCr Matrix: TV.709\n\n"
        "[V4+ Styles]\n"
        f"{_style_block(speaker_count)}\n\n"
        "[Events]\n"
        "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n"
    )

    rows = []
    for seg in segments:
        style = f"Speaker{seg.speaker}"
        rows.append(
            f"Dialogue: 0,{format_time(seg.start)},{format_time(seg.end)},{style},,0,0,0,,"
            f"{_dialogue_text(seg, karaoke)}"
        )
    return head + "\n".join(rows) + "\n"


def preview_text(segments: list[Segment]) -> str:
    """運営が目視確認するためのプレーンテキスト。"""
    lines = []
    for i, seg in enumerate(segments, 1):
        body = seg.text
        for idx in sorted(seg.line_breaks, reverse=True):
            offset = sum(len(w.text) for w in seg.words[:idx])
            body = body[:offset] + " / " + body[offset:]
        lines.append(f"{i:3d}. [{format_time(seg.start)}-{format_time(seg.end)}] (話者{seg.speaker}) {body}")
    return "\n".join(lines)
