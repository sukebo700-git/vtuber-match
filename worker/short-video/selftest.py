#!/usr/bin/env python
"""文字起こしを介さずに字幕生成ロジックを検証する自己テスト。

ASRバックエンドが未確定でも、改行・話者色分け・ASSエスケープ・
カラオケタグの生成をここで確認できる。
    python selftest.py            # ロジックのみ
    python selftest.py --render   # 実素材でレンダリングまで通す
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from cliplib import config
from cliplib.subtitle import build_ass, escape_ass, group_words, preview_text, text_width
from cliplib.transcribe import Word

ROOT = Path(__file__).resolve().parent


def make_words() -> list[Word]:
    """whisper-1 の words[] を模した入力。話者1はコラボ相手を想定。"""
    script: list[tuple[str, int, float]] = [
        # (テキスト, 話者, 語の長さ秒)
        ("今日", 0, 0.35), ("は", 0, 0.12), ("ペルソナ", 0, 0.55), ("3", 0, 0.18),
        ("リロード", 0, 0.50), ("を", 0, 0.12), ("やって", 0, 0.35), ("いき", 0, 0.25), ("ます", 0, 0.30),
        ("__GAP__", 0, 0.9),
        ("うわ", 0, 0.30), ("あああ", 0, 0.70), ("！", 0, 0.10),
        ("これ", 0, 0.25), ("は", 0, 0.10), ("死んだ", 0, 0.45), ("って", 0, 0.20),
        ("__GAP__", 0, 1.1),
        ("いや", 1, 0.30), ("まだ", 1, 0.28), ("いける", 1, 0.45), ("よ", 1, 0.15),
        ("回復", 1, 0.40), ("するから", 1, 0.55), ("待って", 1, 0.45),
        ("__GAP__", 1, 0.8),
        ("たろう", 0, 0.40), ("2000", 0, 0.55), ("さん", 0, 0.25),
        ("スパチャ", 0, 0.50), ("ありがとう", 0, 0.70), ("ございます", 0, 0.65),
        ("__GAP__", 0, 0.9),
        # ASSタグ注入の試験。そのまま焼くと \pos が効いてしまう
        (r"{\pos(0,0)}悪意ある入力\N", 0, 0.60),
    ]

    words: list[Word] = []
    t = 0.5
    segment = 0
    for text, speaker, dur in script:
        if text == "__GAP__":
            # Whisperのセグメント境界を模す(息継ぎ=別セグメント)
            t += dur
            segment += 1
            continue
        words.append(Word(text=text, start=t, end=t + dur, speaker=speaker, segment=segment))
        t += dur + 0.03
    return words


def check(label: str, ok: bool, detail: str = "") -> bool:
    print(f"  [{'OK' if ok else 'NG'}] {label}" + (f" — {detail}" if detail else ""))
    return ok


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--render", action="store_true", help="実素材でレンダリングまで実行する")
    parser.add_argument("--source", default="C:/Users/kk/Videos/Captures/P3R   2024-09-22 00-41-29.mp4")
    args = parser.parse_args()

    words = make_words()
    segments = group_words(words)
    ass = build_ass(segments, karaoke=True)

    print("=== 字幕ブロック ===")
    print(preview_text(segments))

    print("\n=== 検証 ===")
    passed = True

    passed &= check("セグメントが分割された", len(segments) >= 4, f"{len(segments)}ブロック")

    speakers = {s.speaker for s in segments}
    passed &= check("話者が2人に分かれた", speakers == {0, 1}, f"話者={sorted(speakers)}")

    passed &= check(
        "話者ごとのStyleが定義された",
        "Style: Speaker0," in ass and "Style: Speaker1," in ass,
    )

    passed &= check(
        "話者1のブロックがSpeaker1スタイルを使う",
        any(",Speaker1,," in line for line in ass.splitlines() if line.startswith("Dialogue:")),
    )

    # 改行後の各行が上限内か
    over = []
    for seg in segments:
        line, cur = [], 0
        for i, w in enumerate(seg.words):
            if i in seg.line_breaks:
                line.append("".join(x.text for x in seg.words[cur:i]))
                cur = i
        line.append("".join(x.text for x in seg.words[cur:]))
        for text in line:
            if text_width(text) > config.MAX_LINE_WIDTH + 0.01:
                over.append(text)
    passed &= check("各行が全角14文字以内", not over, f"超過={over}")

    passed &= check("2行を超えていない", all(len(s.line_breaks) <= config.MAX_LINES - 1 for s in segments))

    # 回帰防止: Whisperのセグメント境界を跨いだブロックを作らない。
    # 跨ぐと「おしゃべりはおしまい行くよ、アイギス絶対に私、」のように文が繋がる。
    mixed = [s.text for s in segments if len({w.segment for w in s.words}) > 1]
    passed &= check("セグメント境界を跨いでいない", not mixed, f"混在={mixed}")

    # 回帰防止: 改行しても片側が長すぎて画面外へはみ出さない。
    # 読点の直後を無条件に選ぶと「今日はですね、/ モンハンワイルズを…思います。」
    # のように2行目が21文字になり、実際に画面外へ切れた。
    long_line = [
        Word(text=t, start=i * 0.3, end=i * 0.3 + 0.28, speaker=0, segment=0)
        for i, t in enumerate(
            ["今日", "は", "ですね", "、", "モンハン", "ワイルズ", "を",
             "やって", "いこう", "と", "思います", "。"]
        )
    ]
    widest = 0.0
    for b in group_words(long_line):
        cur = 0
        for i, w in enumerate(b.words):
            if i in b.line_breaks:
                widest = max(widest, text_width("".join(x.text for x in b.words[cur:i])))
                cur = i
        widest = max(widest, text_width("".join(x.text for x in b.words[cur:])))
    passed &= check(
        "長文でも各行が上限内に収まる",
        widest <= config.MAX_LINE_WIDTH + 0.01,
        f"最長行={widest:.0f}文字相当 (上限{config.MAX_LINE_WIDTH:.0f})",
    )

    # 回帰防止: 助詞の文字マッチがbudouxの文節判断を上書きしない。
    # 「おやすみなさい」の『や』を助詞と誤認し「おや / すみなさい」と割れていた。
    oyasumi = [
        Word(text=t, start=i * 0.2, end=i * 0.2 + 0.18, speaker=0, segment=0)
        for i, t in enumerate(["もう", "いい", "です", "寝", "ます", "お", "や", "す", "み", "な", "さい"])
    ]
    ob = group_words(oyasumi)
    ob_lines = []
    for b in ob:
        cur = 0
        for i, w in enumerate(b.words):
            if i in b.line_breaks:
                ob_lines.append("".join(x.text for x in b.words[cur:i]))
                cur = i
        ob_lines.append("".join(x.text for x in b.words[cur:]))
    passed &= check(
        "単語の途中で改行しない(おやすみなさい)",
        all("おやすみなさい" not in ln or ln.endswith("おやすみなさい") or ln == "おやすみなさい"
            for ln in ob_lines) and not any(ln.endswith("おや") for ln in ob_lines),
        " / ".join(ob_lines),
    )

    # 回帰防止: 2人が同時に喋っても字幕が粉砕されない。
    # 時刻順の1本の列にしてから話者の変わり目で切ると、マルチトラック収録で
    # 「行くよア」「はいみ」「イ」「なさん」のように1〜3文字に割れる。
    overlap: list[Word] = []
    for i, t in enumerate(["いや", "まだ", "いける", "って"]):
        overlap.append(Word(text=t, start=i * 0.5, end=i * 0.5 + 0.45, speaker=0, segment=0))
    for i, t in enumerate(["それ", "は", "むり", "でしょ"]):
        overlap.append(Word(text=t, start=i * 0.5 + 0.2, end=i * 0.5 + 0.6, speaker=1, segment=0))
    overlap.sort(key=lambda w: w.start)
    ov_blocks = group_words(overlap)
    passed &= check(
        "同時発話で字幕が粉砕されない",
        len(ov_blocks) == 2,
        f"{len(ov_blocks)}ブロック: {[b.text for b in ov_blocks]}",
    )
    passed &= check(
        "同時発話でも話者ごとにまとまる",
        {b.speaker: b.text for b in ov_blocks} == {0: "いやまだいけるって", 1: "それはむりでしょ"},
        str({b.speaker: b.text for b in ov_blocks}),
    )

    # 回帰防止: 話者が複数いるとMarginVを段積みして重なりを避ける
    multi_ass = build_ass(ov_blocks, karaoke=False)
    # 話者ごとに通常/強調(Hot)の2スタイルが出るので、通常スタイルだけを見る
    base = [ln for ln in multi_ass.splitlines()
            if ln.startswith("Style: Speaker") and "Hot," not in ln]
    margins = [ln.rsplit(",", 2)[-2] for ln in base]
    passed &= check("話者ごとにMarginVが段積みされる", len(set(margins)) == len(margins), f"MarginV={margins}")

    # 強調スタイルが話者ぶん定義されているか
    hot = [ln for ln in multi_ass.splitlines() if ln.startswith("Style: Speaker") and "Hot," in ln]
    passed &= check("話者ごとに強調スタイルが定義される", len(hot) == len(base), f"{len(hot)}件")

    # 登場アニメーション(ポップイン)が全ブロックに入っているか
    dlg = [ln for ln in multi_ass.splitlines() if ln.startswith("Dialogue:")]
    passed &= check(
        "全ブロックにポップインが入る",
        all("\\fscx62\\fscy62" in d for d in dlg),
        f"{len(dlg)}ブロック",
    )

    # 回帰防止: 語間ギャップで単語の途中を割らない。
    # 割ると「これがア」「イギス、エ」のように破綻する。
    long_seg = [Word(text=t, start=i * 3.0, end=i * 3.0 + 0.4, speaker=0, segment=0)
                for i, t in enumerate(["これ", "が", "ア", "イ", "ギ", "ス"])]
    long_blocks = group_words(long_seg)
    passed &= check(
        "同一セグメント内はギャップで割らない",
        len(long_blocks) == 1,
        f"{len(long_blocks)}ブロック: {[b.text for b in long_blocks]}",
    )

    # 注入対策: 本文由来の { } \ がASSに残っていないこと
    dialogue_bodies = []
    for line in ass.splitlines():
        if line.startswith("Dialogue:"):
            dialogue_bodies.append(line.split(",", 9)[9])
    joined = "".join(dialogue_bodies)
    injected = "\\pos(" in joined
    passed &= check("ASSタグ注入が無効化された", not injected)
    passed &= check("全角に置換されている", "｛" in joined and "＼" in joined)

    passed &= check("カラオケタグが入っている", "{\\k" in joined)
    passed &= check("フェードが入っている", "{\\fad(" in joined)
    passed &= check("escape_ass単体", escape_ass(r"a{b}c\d") == "a｛b｝c＼d")

    out = ROOT / "selftest_subs.ass"
    out.write_text(ass, encoding="utf-8")
    print(f"\n生成: {out}")

    if not args.render:
        print("\n" + ("すべて通りました。" if passed else "失敗があります。"))
        return 0 if passed else 1

    # --- 実素材でレンダリングまで通す ---
    from cliplib.probe import probe, validate_clip_range
    from cliplib.render import measure_loudness, render
    from clip import ensure_font, ensure_watermark, save_job

    source = Path(args.source)
    info = probe(source)
    start, duration = 30.0, max(w.end for w in words) + 1.0
    validate_clip_range(info, start, start + duration)

    workdir = ROOT / "work" / "selftest"
    workdir.mkdir(parents=True, exist_ok=True)
    (workdir / "subs.ass").write_text(ass, encoding="utf-8")
    ensure_font(workdir)
    ensure_watermark(workdir)
    save_job(workdir, {
        "source": str(source), "start": start, "end": start + duration,
        "duration": duration, "template": "B", "game_rect": None,
        "live2d_rect": None, "audio_index": 0, "asr": "selftest",
    })

    print(f"\n=== レンダリング検証 ({duration:.1f}秒) ===")
    stats = measure_loudness(source, start, duration, 0)
    print(f"  測定: {'成功' if stats else '失敗(動的正規化へ)'}")
    result = render(
        workdir=workdir, source=source, info=info, start=start,
        duration=duration, template="B", audio_index=0, outputs="both", loudness=stats,
    )
    print(f"  所要 {result.elapsed_sec:.1f}秒 (実時間比 {duration / result.elapsed_sec:.2f}x)")
    for label, path in (("納品用", result.clean), ("透かし付き", result.watermarked)):
        ok = path is not None and path.exists() and path.stat().st_size > 0
        passed &= check(f"{label}が生成された", ok, str(path) if path else "")
        if ok:
            print(f"       {path.stat().st_size / 1024 / 1024:.2f} MB")

    print("\n" + ("すべて通りました。" if passed else "失敗があります。"))
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
