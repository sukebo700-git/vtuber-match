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

    @property
    def emphasis(self) -> int:
        """ブロック内に1語でも強調指定があれば強調扱いにする。"""
        return max((w.emphasis for w in self.words), default=0)


# --------------------------------------------------------------------------
# 文字幅
# --------------------------------------------------------------------------

def char_width(ch: str) -> float:
    """全角=1.0 / 半角=0.5 として概算する。"""
    return 1.0 if unicodedata.east_asian_width(ch) in ("F", "W", "A") else 0.5


def text_width(text: str) -> float:
    return sum(char_width(c) for c in text)


def words_width(words: list[Word]) -> float:
    """語列の表示幅。跳ねる語は拡大されるぶん広く数える。

    語単位で倍率が変わるため、単純な文字数では幅を見誤り画面外へはみ出す。
    """
    total = 0.0
    for w in words:
        scale = config.WORD_EMPHASIS_SCALE if w.emphasis else 1.0
        total += text_width(w.text) * scale
    return total


def max_line_width(words: list[Word]) -> float:
    """この語列で1行に入れてよい幅。強調ブロックは文字が大きいぶん短くなる。

    これを考慮しないと、強調で1.3倍に拡大した瞬間に画面外へはみ出す。
    """
    return config.MAX_LINE_WIDTH


# --------------------------------------------------------------------------
# セグメント分割
# --------------------------------------------------------------------------

def _split_to_fit(words: list[Word]) -> list[list[Word]]:
    """2行に収まらない語列を、安全な区切り位置で分割する。

    分割位置はタイミングではなく言語的な妥当性で選ぶ。日本語のWhisperは
    「お/しゃ/べ/り」のような断片を1語として返すため、語間ギャップで切ると
    単語の途中で割れてしまう。
    """
    capacity = max_line_width(words) * config.MAX_LINES
    if words_width(words) <= capacity or len(words) < 2:
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
        width = words_width(words[:i])
        if width > capacity:
            break
        score = _break_score(words[i - 1].text, words[i].text)
        score += _boundary_adjust(boundaries, offsets[i])
        score += int(width / capacity * 30)
        if score >= best_score:
            best_score = score
            best_index = i

    if best_index <= 0:
        # 安全な位置が見つからない(記号の連続など)。容量ぴったりで機械的に切る
        best_index = 1
        for i in range(1, len(words)):
            if words_width(words[:i]) > capacity:
                break
            best_index = i

    return [words[:best_index], *_split_to_fit(words[best_index:])]


def _line_texts(words: list[Word], breaks: set[int]) -> list[str]:
    lines: list[str] = []
    cursor = 0
    for i in range(1, len(words)):
        if i in breaks:
            lines.append("".join(w.text for w in words[cursor:i]))
            cursor = i
    lines.append("".join(w.text for w in words[cursor:]))
    return lines


def _clean_cut(words: list[Word]) -> int:
    """2行に割るのに使える「文節境界の」改行位置を返す。無ければ -1。

    budouxが使えない環境では判定できないので 0 を返し、呼び出し側で
    分割しない(過剰分割を避ける)。
    """
    limit = max_line_width(words)
    full = "".join(w.text for w in words)
    boundaries = _budoux_boundaries(full)
    if not boundaries:
        return 0

    offsets: list[int] = []
    pos = 0
    for w in words:
        offsets.append(pos)
        pos += len(w.text)

    best, best_gap = -1, float("inf")
    for i in range(1, len(words)):
        if offsets[i] not in boundaries:
            continue
        left = words_width(words[:i])
        right = words_width(words[i:])
        if left <= limit and right <= limit:
            return -2  # 文節境界で2行に収まる。分割不要
        if abs(left - right) < best_gap:
            best_gap, best = abs(left - right), i
    return best


def _build_segments(words: list[Word], speaker: int, depth: int = 0) -> list[Segment]:
    """1つの語列から字幕ブロックを作る。

    2行に詰め込むと文節の途中で改行せざるを得ない場合は、無理に詰めず
    **ブロックごと分割**する。詰め込むと
    「前回のアップデートで、ゼン / ゼロも触りたいんですけど、」のように
    単語の途中で割れ、行幅が収まっていても読みにくくなる。
    """
    if not words:
        return []

    full = "".join(w.text for w in words)
    if depth < 4 and len(words) >= 2 and words_width(words) > max_line_width(words):
        cut = _clean_cut(words)
        if cut > 0:  # 文節境界で2行に収める術がない → ブロックを分ける
            return _build_segments(words[:cut], speaker, depth + 1) + _build_segments(
                words[cut:], speaker, depth + 1
            )

    seg = Segment(words=words, speaker=speaker)
    seg.line_breaks = _decide_line_breaks(words)
    return [seg]


def _split_long(words: list[Word], depth: int = 0) -> list[list[Word]]:
    """表示時間が長すぎるブロックを、内部の無音位置で割る。

    割る位置は「文節境界」に限る。Whisperのタイムスタンプは長い発話の途中に
    誤差で1秒以上の空白を作ることがあり、それを本物の間と誤認すると
    「パスカル使って」が「パ」「ス」「カル使」「って」に砕ける。
    budouxが使えない環境では、割らずにそのまま出す(砕けるよりましなため)。
    """
    if len(words) < 2 or depth >= 4:
        return [words]
    span = words[-1].end - words[0].start
    if span <= config.MAX_SEGMENT_SEC:
        return [words]

    full = "".join(w.text for w in words)
    boundaries = _budoux_boundaries(full)
    if not boundaries:
        return [words]

    offsets: list[int] = []
    pos = 0
    for w in words:
        offsets.append(pos)
        pos += len(w.text)

    gap, cut = 0.0, -1
    for i in range(1, len(words)):
        if offsets[i] not in boundaries:
            continue  # 文節の途中では割らない
        g = words[i].start - words[i - 1].end
        if g > gap:
            gap, cut = g, i
    if cut < 1 or gap < config.SEGMENT_GAP_SEC:
        # 無音では割れない。文節境界のうち時間的な中点に最も近い位置で割る。
        # 17秒の字幕が出っぱなしになるより、文の途中でも区切った方がよい。
        mid = (words[0].start + words[-1].end) / 2
        best, best_d = -1, float("inf")
        for i in range(1, len(words)):
            if offsets[i] not in boundaries:
                continue
            d = abs(words[i].start - mid)
            if d < best_d:
                best_d, best = d, i
        if best < 1:
            return [words]
        cut = best
    return _split_long(words[:cut], depth + 1) + _split_long(words[cut:], depth + 1)


def _merge_tiny(segments: list[Segment]) -> list[Segment]:
    """極端に短いブロックを直前に併合する。

    語の長さを打ち切ったり分割した結果、「か!」のように0.1秒だけ映る
    取り残しが出ることがある。一瞬だけ光って消えるので目障りになる。
    """
    out: list[Segment] = []
    for seg in segments:
        too_short = seg.end - seg.start < config.MIN_BLOCK_SEC
        if too_short and out and out[-1].speaker == seg.speaker:
            prev = out[-1]
            merged = prev.words + seg.words
            if words_width(merged) <= config.MAX_LINE_WIDTH * config.MAX_LINES:
                prev.words = merged
                prev.line_breaks = _decide_line_breaks(merged)
                continue
        out.append(seg)
    return out


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
            for part in _split_long(chunk):
                for piece in _split_to_fit(part):
                    segments.extend(_build_segments(piece, speaker))

    # ASSは重なったDialogueを同時に描画する。話者ごとにMarginVを変えて段積みする
    segments.sort(key=lambda s: (s.start, s.speaker))
    return _merge_tiny(segments)


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


def _boundary_adjust(boundaries: set[int], offset: int) -> int:
    """budouxの文節境界かどうかで加点/減点する。

    budouxが使える場合は、その判断を助詞ヒューリスティックより優先する。
    _break_score は「直前の語が助詞で終わるか」を文字マッチで見ているだけなので、
    「おやすみなさい」の『や』のように、助詞ではない文字を助詞と誤認する。
    実際に「もういいです寝ますおや / すみなさい」と割れる不具合が出た。
    """
    if not boundaries:
        return 0  # budouxが無い環境では判断材料がないので中立
    return 50 if offset in boundaries else -40


def _decide_line_breaks(words: list[Word]) -> set[int]:
    """words のどのindexの直前で改行するかを決める(最大 MAX_LINES-1 箇所)。

    改行位置は「両側が1行に収まるか」を最優先で選ぶ。読点の直後など
    スコアの高い位置を無条件に採ると、片側だけが極端に長くなる。
    実際に「今日はですね、/ モンハンワイルズをやっていこうと思います。」で
    2行目が21文字になり、画面外へはみ出す不具合が出た。
    """
    if len(words) < 2:
        return set()

    limit = max_line_width(words)
    full = "".join(w.text for w in words)
    if words_width(words) <= limit:
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
        if words_width(words[line_start:]) <= limit:
            break  # 残りが1行に収まっているので改行不要

        best_index = -1
        best_score = -10_000
        # 両側を収められる位置が無い場合に備え、最も均等に割れる位置を控えておく
        fallback_index = -1
        fallback_worst = float("inf")

        for i in range(line_start + 1, len(words)):
            left = words_width(words[line_start:i])
            if left > limit:
                break  # これ以上は左側が1行に収まらない
            right = words_width(words[i:])

            worst = max(left, right)
            if worst < fallback_worst:
                fallback_worst = worst
                fallback_index = i

            if right > limit:
                continue  # 右側がはみ出す位置は選ばない

            score = _break_score(words[i - 1].text, words[i].text)
            score += _boundary_adjust(boundaries, offsets[i])
            # 行がある程度埋まっている方が見栄えがよい
            score += int(left / limit * 30)

            if score >= best_score:
                best_score = score
                best_index = i

        chosen = best_index if best_index > line_start else fallback_index
        if chosen <= line_start:
            break
        breaks.add(chosen)
        line_start = chosen

    return breaks


# --------------------------------------------------------------------------
# ASS生成
# --------------------------------------------------------------------------

def telop_text(text: str) -> str:
    """テロップ表示用に句読点を落とす。

    日本語のテロップは「、」「。」をそのまま出さない。読点は半角空白にして
    「間」を残し、句点は削除する。全部消すと語が繋がって読みにくくなる。
    幅計算には句読点を含んだまま使うので、実際の描画は必ず計算値より狭くなる
    (安全側に振れる)。感嘆符・疑問符は感情を伝えるため残す。
    """
    if not config.TELOP_STRIP_PUNCTUATION:
        return text
    for ch in config.TELOP_SPACE_CHARS:
        text = text.replace(ch, " ")
    for ch in config.TELOP_DROP_CHARS:
        text = text.replace(ch, "")
    return text


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
        # 叫んでいる箇所用。文字を大きく、色を変え、縁取りを太くする。
        # 手直しのときは Dialogue の Style 列を Speaker0 ⇔ Speaker0Hot で入れ替えるだけでよい
        hot_size = int(config.FONT_SIZE * config.EMPHASIS_SCALE)
        rows.append(
            f"Style: Speaker{i}Hot,{config.FONT_NAME},{hot_size},{config.EMPHASIS_COLOR},"
            f"{config.COLOR_KARAOKE},{config.COLOR_OUTLINE},{config.COLOR_BACK},1,0,0,0,100,100,0,0,1,"
            f"{config.EMPHASIS_OUTLINE},{config.SHADOW},2,{config.MARGIN_H},{config.MARGIN_H},{margin_v},1"
        )
    return "\n".join(rows)


def slant_tag(text: str) -> str:
    """「ｗ」表記の笑いを斜めに倒す。真っ直ぐだと勢いが出ない。"""
    if not text.startswith("ｗ"):
        return ""
    return "{" + chr(92) + f"frz{config.LAUGH_SLANT_DEG}" + "}"


def _intro_tags(emphasis: int) -> str:
    """字幕の登場演出。

    全ブロックに軽いポップイン(小さく出て原寸に戻る)を掛け、
    音量から強調と判定されたブロックにはさらに一往復の傾きを足す。
    傾きは小さく短くする。大きいと読みにくくなり、Shortsでは逆効果。
    """
    b = '\\'
    p0 = config.POP_IN_START_SCALE
    dur = config.POP_IN_MS
    tags = [
        "{" + b + "fad(60,80)}",
        "{" + b + f"fscx{p0}" + b + f"fscy{p0}"
        + b + f"t(0,{dur}," + b + "fscx100" + b + "fscy100)}",
    ]
    if emphasis:
        d = config.SHAKE_DEG
        ms = config.SHAKE_MS
        tags.append(
            "{"
            + b + f"t(0,{ms}," + b + f"frz{d})"
            + b + f"t({ms},{ms * 2}," + b + f"frz-{d})"
            + b + f"t({ms * 2},{ms * 3}," + b + "frz0)"
            + "}"
        )
    return "".join(tags)


def snap_emphasis(words: list[Word]) -> None:
    """強調範囲を文節境界に合わせる。合わせられなければ強調を取り消す。

    音量ベースの選択は言語構造を知らないため、「真・女神転生」の
    「女神転」だけが色付くといった中途半端な範囲になる。
    文節の途中で色が変わると、狙って強調したようには見えない。
    確信の持てる範囲に合わせられないなら、何もしない方がよい。
    """
    if not any(w.emphasis for w in words):
        return
    full = "".join(w.text for w in words)
    boundaries = _budoux_boundaries(full)
    if not boundaries:
        return

    offsets: list[int] = []
    pos = 0
    for w in words:
        offsets.append(pos)
        pos += len(w.text)
    ends = set(boundaries) | {pos}

    lo = min(i for i, w in enumerate(words) if w.emphasis)
    hi = max(i for i, w in enumerate(words) if w.emphasis) + 1

    # 開始は手前の文節境界へ、終端は先の文節境界へ広げる
    while lo > 0 and offsets[lo] not in boundaries:
        lo -= 1
    end_off = offsets[hi] if hi < len(words) else pos
    while hi < len(words) and end_off not in ends:
        hi += 1
        end_off = offsets[hi] if hi < len(words) else pos

    for w in words:
        w.emphasis = 0
    # 広げた結果が行の大半を占めるなら「強調」の意味がないので取り消す
    if text_width("".join(w.text for w in words[lo:hi])) > text_width(full) * config.EMPHASIS_MAX_SHARE:
        return
    for i in range(lo, hi):
        words[i].emphasis = 1


def mark_keywords(words: list[Word], terms: list[str]) -> int:
    """固有名詞辞書に載っている語に keyword を立てる。

    Whisperの語は「ケ/ル/ベ/ロ/ス」のように分かれるため、語単体ではなく
    連結したテキスト上で辞書語を探し、その範囲に重なる語すべてに印を付ける。
    """
    if not terms:
        return 0
    full = "".join(w.text for w in words)
    starts, pos = [], 0
    for w in words:
        starts.append(pos)
        pos += len(w.text)

    hit = 0
    for term in sorted(terms, key=len, reverse=True):
        if len(term) < config.KEYWORD_MIN_CHARS:
            continue
        at = full.find(term)
        while at >= 0:
            lo, hi = at, at + len(term)
            for i, w in enumerate(words):
                if starts[i] < hi and starts[i] + len(w.text) > lo:
                    if not w.keyword:
                        hit += 1
                    w.keyword = True
            at = full.find(term, at + 1)
    return hit


def close_reset() -> str:
    """語ごとの上書きを閉じる。順次表示中は本文色と未発話色を明示して戻す。"""
    b = chr(92)
    if not config.REVEAL_ENABLED:
        return "{" + b + "r}"
    return (
        "{" + b + "r"
        + b + f"c&H{config.COLOR_WHITE[-6:]}&"
        + b + f"2c&H{config.COLOR_KARAOKE[-6:]}&" + b + "2a&HFF&"
        + "}"
    )


def _word_tags(word: Word) -> tuple[str, str]:
    """跳ねる語に付ける開始タグと、元に戻すタグを返す。

    行全体を大きくするのではなく、その行で一番音が大きい語だけを跳ねさせる。
    プロのテロップは行全体ではなくキーワードだけが動く。
    一度 overshoot まで拡大してから原寸へ戻すことで「弾む」感じを出す。
    """
    b = chr(92)
    if not word.emphasis:
        if config.KEYWORD_ENABLED and word.keyword:
            # 意味的なキーワードは色だけ変える。大きさは変えない
            # \c だけ指定すると未発話色が効かず、順次表示でも最初から見えてしまう。
            # 色を上書きするときは \2c(未発話色)も併せて透明にする
            tag = "{" + b + f"c&H{config.KEYWORD_COLOR[-6:]}&"
            if config.REVEAL_ENABLED:
                tag += b + f"2c&H{config.COLOR_KARAOKE[-6:]}&" + b + "2a&HFF&"
            return tag + "}", close_reset()
        return "", ""
    size = int(config.FONT_SIZE * config.WORD_EMPHASIS_SCALE * config.FONT_EMPHASIS_SIZE_ADJUST)
    over = config.WORD_POP_OVERSHOOT
    half = config.WORD_POP_MS // 2
    full = config.WORD_POP_MS
    open_tag = (
        "{"
        + b + f"fn{config.FONT_EMPHASIS_NAME}"
        + b + f"fs{size}"
        + b + f"c&H{config.EMPHASIS_COLOR[-6:]}&"
        + (b + f"2c&H{config.COLOR_KARAOKE[-6:]}&" + b + "2a&HFF&" if config.REVEAL_ENABLED else "")
        + b + f"bord{config.EMPHASIS_OUTLINE}"
        + b + f"t(0,{half}," + b + f"fscx{over}" + b + f"fscy{over})"
        + b + f"t({half},{full}," + b + "fscx100" + b + "fscy100)"
        + "}"
    )
    # \r でスタイル既定へ戻す。戻さないと以降の語まで大きいままになる
    # \r はスタイル既定へ戻すが、順次表示中は未発話色(透明)も戻るため
    # 本文色を明示して閉じる
    return open_tag, close_reset()


def _dialogue_text(seg: Segment, karaoke: bool) -> str:
    parts = [_intro_tags(0), slant_tag(seg.text)]
    cursor = seg.start
    for i, word in enumerate(seg.words):
        if i in seg.line_breaks:
            parts.append("\\N")
        if karaoke:
            gap_cs = int(round(max(0.0, word.start - cursor) * 100))
            if gap_cs > 0:
                parts.append("{" + "\\ko" + str(gap_cs) + "}")
            dur_cs = max(1, int(round(word.duration * 100)))
            parts.append("{" + "\\ko" + str(dur_cs) + "}")
            cursor = word.end
        open_tag, close_tag = _word_tags(word)
        parts.append(open_tag + escape_ass(telop_text(word.text)) + close_tag)
    return "".join(parts)


def build_ass(segments: list[Segment], karaoke: bool | None = None) -> str:
    r"""字幕ブロック列からASSファイルの中身を作る。

    karaoke は既定で無効。理由が2つある。
      1. 配色が直感と逆になる。ASSの \k は PrimaryColour(発話済み)と
         SecondaryColour(発話前)を切り替えるため、静止画で見ると
         「これから喋る部分」が着色されて見える。
      2. 話者の色分けと衝突する。話者1の色とカラオケ未発話色が
         どちらも黄系で、コラボ回では区別がつかない。
    日本語の切り抜きでは単色が主流でもあるため、既定は単色とする。
    """
    if karaoke is None:
        karaoke = config.REVEAL_ENABLED
    speaker_count = max((s.speaker for s in segments), default=0) + 1

    head = (
        "[Script Info]\n"
        "; VtuberMatch clip generator\n"
        "; 話者の色を変えるには、各Dialogue行のStyle列を Speaker0 / Speaker1 ... に書き換えてください\n"
        "ScriptType: v4.00+\n"
        f"PlayResX: {config.OUT_WIDTH}\n"
        f"PlayResY: {config.OUT_HEIGHT}\n"
        # 1 = 行末で自動折り返し。明示改行はそのまま効く。
        # 2(折り返しなし)だと、計算漏れがあったとき画面外へ流れて切れてしまう
        "WrapStyle: 1\n"
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
        # Name列は描画に使われない。映像側のズーム区間を拾うための目印にする
        marker = "HOT" if seg.emphasis else ""
        rows.append(
            f"Dialogue: 0,{format_time(seg.start)},{format_time(seg.end)},{style},{marker},0,0,0,,"
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
