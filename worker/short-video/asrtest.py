#!/usr/bin/env python
"""文字起こしバックエンドの疎通・速度・単語タイムスタンプ有無を確認する。

    python asrtest.py --in 動画.mp4 --start 60 --dur 60 --backend faster-whisper --model base

精度そのものの評価は正解テキスト付きの素材(素材A)が要る。
ここで見るのは「配管が通るか」「単語単位のタイムスタンプが返るか」「どれだけ速いか」。
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from cliplib.probe import ProbeError, probe
from cliplib.render import extract_audio, extract_audio_only
from cliplib.subtitle import build_ass, group_words, preview_text

ROOT = Path(__file__).resolve().parent


def try_faster_whisper(audio: Path, model_name: str, device: str, compute: str) -> tuple[list, dict]:
    from cliplib.transcribe import register_cuda_dlls

    register_cuda_dlls()
    from faster_whisper import WhisperModel

    meta: dict = {"device": device, "compute_type": compute, "model": model_name}
    began = time.monotonic()
    model = WhisperModel(model_name, device=device, compute_type=compute)
    meta["load_sec"] = time.monotonic() - began

    began = time.monotonic()
    segments, info = model.transcribe(
        str(audio), language="ja", word_timestamps=True, vad_filter=True
    )
    segments = list(segments)  # ジェネレータなのでここで実処理が走る
    meta["infer_sec"] = time.monotonic() - began
    meta["detected_language"] = getattr(info, "language", "?")
    meta["audio_sec"] = getattr(info, "duration", 0.0)
    return segments, meta


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="input", required=True)
    ap.add_argument("--start", type=float, default=60.0)
    ap.add_argument("--dur", type=float, default=60.0)
    ap.add_argument("--backend", default="faster-whisper")
    ap.add_argument("--model", default="base")
    ap.add_argument("--device", default="auto", help="cuda / cpu / auto")
    ap.add_argument("--compute", default="", help="float16 / int8_float16 / int8")
    args = ap.parse_args()

    source = Path(args.input).resolve()
    workdir = ROOT / "work" / "asrtest"
    workdir.mkdir(parents=True, exist_ok=True)
    audio = workdir / "sample.ogg"

    # 精度測定に映像は不要。音声だけのファイル(m4a/wav/mp3等)もそのまま受ける。
    try:
        info = probe(source)
        print(f"入力: {source.name} ({info.width}x{info.height}, 音声{len(info.audio_tracks)}本)")
        extract_audio(source, audio, args.start, args.dur, info.audio_tracks[0].audio_index)
    except ProbeError as exc:
        if "映像ストリーム" not in str(exc):
            raise
        print(f"入力: {source.name} (音声のみ)")
        extract_audio_only(source, audio, args.start, args.dur)
    size_kb = audio.stat().st_size / 1024
    print(f"音声抽出: {args.dur:.0f}秒 → {size_kb:.0f} KB (16kHz mono Opus 32k)")

    if args.backend != "faster-whisper":
        print("このスクリプトは faster-whisper 専用です", file=sys.stderr)
        return 2

    devices = [args.device] if args.device != "auto" else ["cuda", "cpu"]
    segments = None
    meta: dict = {}
    for device in devices:
        compute = args.compute or ("float16" if device == "cuda" else "int8")
        print(f"\n--- {device} / {compute} / {args.model} を試行 ---")
        try:
            segments, meta = try_faster_whisper(audio, args.model, device, compute)
            break
        except Exception as exc:
            print(f"  失敗: {type(exc).__name__}: {str(exc)[:300]}")
            segments = None

    if segments is None:
        print("\nすべてのデバイスで失敗しました", file=sys.stderr)
        return 3

    print(f"\n=== 結果 ===")
    print(f"  デバイス      : {meta['device']} / {meta['compute_type']}")
    print(f"  モデル読込    : {meta['load_sec']:.1f}秒")
    print(f"  推論          : {meta['infer_sec']:.1f}秒")
    print(f"  音声長        : {meta.get('audio_sec', 0):.1f}秒")
    if meta["infer_sec"] > 0:
        print(f"  実時間比      : {meta.get('audio_sec', 0) / meta['infer_sec']:.1f}x")
    print(f"  検出言語      : {meta.get('detected_language')}")
    print(f"  セグメント数  : {len(segments)}")

    # --- 単語タイムスタンプの有無(カラオケ強調の可否に直結) ---
    words = [(i, w) for i, seg in enumerate(segments) for w in (seg.words or [])]
    has_words = bool(words)
    print(f"  単語数        : {len(words)}")
    print(f"  [{'OK' if has_words else 'NG'}] 単語単位タイムスタンプ")
    if has_words:
        print("  先頭8語:")
        for seg_index, w in words[:8]:
            print(f"    seg{seg_index:<2d} {w.start:6.2f}-{w.end:6.2f}  {w.word!r}")

    print("\n=== 文字起こし全文 ===")
    for seg in segments[:20]:
        print(f"  [{seg.start:6.2f}-{seg.end:6.2f}] {seg.text.strip()}")
    if len(segments) > 20:
        print(f"  ... 他 {len(segments) - 20} セグメント")

    # --- 実際に字幕を組めるか ---
    if has_words:
        from cliplib.transcribe import Word

        # segment を落とすと全語が1チャンクに繋がり、文の境界が消える
        converted = [
            Word(text=str(w.word), start=float(w.start), end=float(w.end),
                 speaker=0, segment=seg_index)
            for seg_index, w in words
        ]
        blocks = group_words(converted)
        out = workdir / "asrtest_subs.ass"
        out.write_text(build_ass(blocks, karaoke=True), encoding="utf-8")
        print(f"\n=== 字幕化 {len(blocks)}ブロック ===")
        print(preview_text(blocks)[:1500])
        print(f"\n生成: {out}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
