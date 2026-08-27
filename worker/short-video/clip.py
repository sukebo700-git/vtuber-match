#!/usr/bin/env python
"""VtuberMatch 切り抜きShorts 生成CLI。

    python clip.py check
    python clip.py probe   --in 配信.mp4
    python clip.py subs    --in 配信.mp4 --start 12:34 --end 13:20
      → subs.ass / subs.txt を出力して停止。ここで運営が誤字を直す
    python clip.py render  --work work/20260826-1
      → out.mp4(納品用) と out_wm.mp4(透かし付きプレビュー用) を出力
    python clip.py all     --in 配信.mp4 --start 12:34 --end 13:20

字幕の手直しは subs.ass をテキストエディタで直接編集する。
話者の色を変える場合は Dialogue 行の Style 列を Speaker0/Speaker1 に書き換える。
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

from cliplib import config
from cliplib.probe import ProbeError, ProbeResult, format_summary, probe, validate_clip_range
from cliplib.render import (
    Rect,
    RenderError,
    extract_audio,
    make_placeholder_watermark,
    measure_loudness,
    render,
    render_preview,
)
from cliplib.subtitle import build_ass, group_words, preview_text
from cliplib.transcribe import BACKENDS, DEFAULT_BACKEND, TranscribeError, Word, transcribe

ROOT = Path(__file__).resolve().parent
JOB_FILE = "job.json"


# --------------------------------------------------------------------------
# 引数のパース補助
# --------------------------------------------------------------------------

def parse_time(value: str) -> float:
    """'93' / '1:33' / '1:02:03' / '1:33.5' を秒に変換する。"""
    text = value.strip()
    if not text:
        raise argparse.ArgumentTypeError("時刻が空です")
    parts = text.split(":")
    if len(parts) > 3:
        raise argparse.ArgumentTypeError(f"時刻の形式が不正です: {value}")
    try:
        seconds = 0.0
        for part in parts:
            seconds = seconds * 60 + float(part)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"時刻の形式が不正です: {value}") from exc
    return seconds


def parse_rect(value: str) -> Rect:
    """'0.0,0.0,1.0,0.6' 形式(元動画に対する比率)を Rect にする。"""
    parts = [p.strip() for p in value.split(",")]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("矩形は x,y,w,h の4つの比率で指定してください (例: 0,0,1,0.6)")
    try:
        x, y, w, h = (float(p) for p in parts)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"矩形の値が数値ではありません: {value}") from exc
    if not (0 <= x <= 1 and 0 <= y <= 1 and 0 < w <= 1 and 0 < h <= 1):
        raise argparse.ArgumentTypeError("矩形は 0.0〜1.0 の比率で指定してください")
    return Rect(x=x, y=y, w=w, h=h)


def _rect_to_dict(rect: Rect | None) -> dict | None:
    return None if rect is None else {"x": rect.x, "y": rect.y, "w": rect.w, "h": rect.h}


def _rect_from_dict(data: dict | None) -> Rect | None:
    return None if not data else Rect(**data)


# --------------------------------------------------------------------------
# ジョブディレクトリ
# --------------------------------------------------------------------------

def make_workdir(explicit: str | None) -> Path:
    if explicit:
        path = Path(explicit).resolve()
    else:
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        path = (ROOT / "work" / stamp).resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_job(workdir: Path, data: dict) -> None:
    (workdir / JOB_FILE).write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def load_job(workdir: Path) -> dict:
    path = workdir / JOB_FILE
    if not path.exists():
        raise SystemExit(f"エラー: {path} がありません。先に subs を実行してください。")
    return json.loads(path.read_text(encoding="utf-8"))


def ensure_watermark(workdir: Path) -> None:
    """本番ロゴがあればコピーし、無ければ仮の透かしを生成する。"""
    target = workdir / "watermark.png"
    if target.exists():
        return
    asset = ROOT / "assets" / "watermark.png"
    if asset.exists():
        shutil.copy2(asset, target)
    else:
        make_placeholder_watermark(target)
        print(f"  ! 仮の透かしを生成しました。本番用ロゴは {asset} に置いてください")


def ensure_font(workdir: Path) -> None:
    """ass の fontsdir=. 用に日本語フォントを作業ディレクトリへ用意する。"""
    if any(workdir.glob("*.ttf")) or any(workdir.glob("*.otf")):
        return
    for candidate in (
        ROOT / "assets" / "NotoSansJP-VF.ttf",
        Path("C:/Windows/Fonts/NotoSansJP-VF.ttf"),
    ):
        if candidate.exists():
            shutil.copy2(candidate, workdir / candidate.name)
            return
    print("  ! Noto Sans JP が見つかりません。フォントが代替されると字形が崩れます")


# --------------------------------------------------------------------------
# サブコマンド
# --------------------------------------------------------------------------

def cmd_check(_args: argparse.Namespace) -> int:
    print("=== 実行環境の確認 ===")
    ok = True

    for tool in ("ffmpeg", "ffprobe"):
        path = shutil.which(tool)
        if path:
            ver = subprocess.run(
                [tool, "-version"], capture_output=True, text=True, encoding="utf-8", errors="replace"
            ).stdout.splitlines()[0]
            print(f"  [OK] {tool}: {ver}")
        else:
            print(f"  [NG] {tool} が PATH にありません")
            ok = False

    caps = subprocess.run(
        ["ffmpeg", "-hide_banner", "-buildconf"], capture_output=True, text=True,
        encoding="utf-8", errors="replace",
    ).stdout
    for flag, label in (
        ("--enable-libx264", "H.264エンコード"),
        ("--enable-libass", "ASS字幕焼き込み"),
        ("--enable-libopus", "音声圧縮(文字起こし用)"),
        ("--enable-fontconfig", "フォント名指定"),
    ):
        mark = "OK" if flag in caps else "NG"
        if mark == "NG":
            ok = False
        print(f"  [{mark}] {label} ({flag})")
    print(f"  [--] ffmpeg内蔵whisper: {'あり' if '--enable-whisper' in caps else 'なし'}")

    import os

    print(f"  [--] OPENAI_API_KEY: {'設定済み' if os.environ.get('OPENAI_API_KEY') else '未設定'}")

    for mod, label in (("budoux", "日本語改行(推奨)"), ("faster_whisper", "ローカルGPU文字起こし(任意)")):
        try:
            __import__(mod)
            print(f"  [OK] {label}: {mod}")
        except ImportError:
            print(f"  [--] {label}: {mod} 未インストール")

    font = Path("C:/Windows/Fonts/NotoSansJP-VF.ttf")
    print(f"  [{'OK' if font.exists() else '--'}] Noto Sans JP: {font}")

    print("\n" + ("すべて揃っています。" if ok else "不足があります。上の [NG] を解消してください。"))
    return 0 if ok else 1


def cmd_peek(args: argparse.Namespace) -> int:
    """指定時刻の静止画を抜き出して、切り抜き位置が合っているか目視確認する。

    顧客はYouTubeのプレイヤーを見ながら時刻を伝えてくる。送られてきたファイルが
    YouTube Studio からのダウンロードなら時刻はそのまま一致するが、OBSの
    ローカル録画だと待機画面の分だけずれる。処理を回す前にここで確かめる。
    """
    source = Path(args.input).resolve()
    try:
        info = probe(source)
    except ProbeError as exc:
        print(f"入力エラー: {exc}", file=sys.stderr)
        return 2

    at = args.at + args.offset
    if at < 0 or at > info.duration_sec:
        print(
            f"エラー: 指定位置 {at:.1f}秒 が動画の範囲外です（動画長 {info.duration_sec:.1f}秒）",
            file=sys.stderr,
        )
        return 2

    outdir = Path(args.out).resolve() if args.out else (ROOT / "work" / "peek")
    outdir.mkdir(parents=True, exist_ok=True)

    print(f"動画長 {info.duration_sec / 60:.1f}分 / 指定 {args.at:.1f}秒", end="")
    print(f" + 補正 {args.offset:+.1f}秒 = {at:.1f}秒" if args.offset else "")

    written: list[Path] = []
    for delta in (-5.0, 0.0, 5.0):
        t = at + delta
        if t < 0 or t > info.duration_sec:
            continue
        out = outdir / f"peek_{int(at)}{'' if delta == 0 else f'{delta:+.0f}'}.jpg"
        cmd = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-ss", f"{t:.3f}", "-i", str(source),
            "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "3", str(out),
        ]
        subprocess.run(cmd, capture_output=True, timeout=300)
        if out.exists():
            written.append(out)
            label = "← 指定位置" if delta == 0 else f"{delta:+.0f}秒"
            print(f"  {out.name}  ({t:.1f}秒) {label}")

    if not written:
        print("フレームを抽出できませんでした", file=sys.stderr)
        return 3
    print(f"\n{outdir} を開いて、切り抜きたい場面か確認してください。")
    print("ずれている場合は --offset で補正できます（例: --offset -90 で90秒前へ）。")
    return 0


def cmd_probe(args: argparse.Namespace) -> int:
    try:
        info = probe(Path(args.input).resolve())
    except ProbeError as exc:
        print(f"入力エラー: {exc}", file=sys.stderr)
        return 2
    print("=== 入力動画 ===")
    print(format_summary(info))
    return 0


def _transcribe_all(
    workdir: Path, source: Path, info: ProbeResult, start: float, duration: float,
    backend: str, prompt: str, speakers: str, whisper_model: str,
) -> tuple[list[Word], list[int]]:
    """音声トラックごとに文字起こしし、話者を割り当てたWord列を返す。"""
    use_tracks: list[int]
    if speakers == "tracks" and info.is_multitrack:
        use_tracks = [t.audio_index for t in info.audio_tracks]
        print(f"  マルチトラック({len(use_tracks)}本)を検出 → トラック単位で話者を分けます")
    else:
        use_tracks = [info.audio_tracks[0].audio_index]
        if speakers == "tracks":
            print("  音声トラックが1本のみ → 全員を話者0として出力します")
            print("  （コラボの色分けは subs.ass の Style 列を手で書き換えてください）")

    all_words: list[Word] = []
    for speaker, audio_index in enumerate(use_tracks):
        audio = workdir / f"audio_a{audio_index}.ogg"
        extract_audio(source, audio, start, duration, audio_index)
        size_mb = audio.stat().st_size / 1024 / 1024
        print(f"  a:{audio_index} 音声抽出 {size_mb:.2f}MB → 文字起こし中 ({backend}) ...")
        began = time.monotonic()
        words = transcribe(
            audio, backend=backend, language="ja", prompt=prompt,
            speaker=speaker, model_path=whisper_model,
        )
        print(f"    {len(words)}語 / {time.monotonic() - began:.1f}秒")
        all_words.extend(words)

    all_words.sort(key=lambda w: (w.start, w.speaker))
    return all_words, use_tracks


def cmd_subs(args: argparse.Namespace) -> int:
    source = Path(args.input).resolve()
    try:
        info = probe(source)
        # 顧客はYouTubeの再生位置で時刻を伝えてくる。OBSのローカル録画のように
        # 時間軸がずれている素材では --offset で補正する。
        start = args.start + args.offset
        end = args.end + args.offset
        validate_clip_range(info, start, end)
    except ProbeError as exc:
        print(f"入力エラー: {exc}", file=sys.stderr)
        return 2

    duration = end - start
    workdir = make_workdir(args.work)
    print("=== 入力動画 ===")
    print(format_summary(info))
    if args.offset:
        print(
            f"\n=== 切り抜き 依頼 {args.start:.1f}s〜{args.end:.1f}s "
            f"／ 補正 {args.offset:+.1f}s "
            f"→ 実位置 {start:.1f}s〜{end:.1f}s ({duration:.1f}秒) ==="
        )
    else:
        print(f"\n=== 切り抜き {start:.1f}s → {end:.1f}s ({duration:.1f}秒) ===")
    print(f"  作業ディレクトリ: {workdir}")

    prompt = ""
    if args.dict:
        dict_path = Path(args.dict)
        if not dict_path.exists():
            print(f"エラー: 辞書ファイルがありません: {dict_path}", file=sys.stderr)
            return 2
        terms = [t.strip() for t in dict_path.read_text(encoding="utf-8").splitlines() if t.strip()]
        prompt = "、".join(terms[:200])
        print(f"  固有名詞辞書: {len(terms)}語")

    try:
        words, tracks = _transcribe_all(
            workdir, source, info, start, duration,
            args.asr, prompt, args.speakers, args.whisper_model,
        )
    except (RenderError, TranscribeError) as exc:
        print(f"\n文字起こしエラー: {exc}", file=sys.stderr)
        return 3

    if not words:
        print("\n発話が検出されませんでした。切り抜き範囲を確認してください。", file=sys.stderr)
        return 3

    segments = group_words(words)
    ensure_font(workdir)
    (workdir / "subs.ass").write_text(build_ass(segments, karaoke=args.karaoke), encoding="utf-8")
    (workdir / "subs.txt").write_text(preview_text(segments), encoding="utf-8")

    save_job(workdir, {
        "source": str(source),
        "start": start,
        "end": end,
        "requested_start": args.start,
        "offset": args.offset,
        "duration": duration,
        "template": args.template,
        "source_crop": _rect_to_dict(args.source_crop),
        "game_rect": _rect_to_dict(args.game_rect),
        "live2d_rect": _rect_to_dict(args.live2d_rect),
        "audio_index": tracks[0],
        "asr": args.asr,
        "speakers": args.speakers,
        "word_count": len(words),
        "segment_count": len(segments),
        "created_at": datetime.now().isoformat(timespec="seconds"),
    })

    print(f"\n=== 字幕 {len(segments)}ブロック / {len(words)}語 ===")
    print(preview_text(segments)[:2000])
    print(f"\n次の手順:")
    print(f"  1. {workdir / 'subs.ass'} を開いて誤字を直す")
    print(f"     （話者の色を変える場合は Style 列を Speaker0 / Speaker1 に書き換え）")
    print(f"  2. python clip.py render --work \"{workdir}\"")
    return 0


def cmd_render(args: argparse.Namespace) -> int:
    workdir = Path(args.work).resolve()
    job = load_job(workdir)
    source = Path(job["source"])
    if not source.exists():
        print(f"エラー: 元動画が見つかりません: {source}", file=sys.stderr)
        return 2

    try:
        info = probe(source)
    except ProbeError as exc:
        print(f"入力エラー: {exc}", file=sys.stderr)
        return 2

    ensure_watermark(workdir)
    ensure_font(workdir)

    start = float(job["start"])
    duration = float(job["duration"])
    audio_index = int(job.get("audio_index", 0))

    print("=== ラウドネス測定(1パス目) ===")
    stats = measure_loudness(source, start, duration, audio_index)
    if stats is None:
        print("  ! 測定に失敗しました。動的正規化に切り替えます（音質がやや落ちます）")
    else:
        print(f"  入力 {stats.input_i:.1f} LUFS / TP {stats.input_tp:.1f} dBTP → 目標 {config.LOUDNORM_I} LUFS")

    print(f"\n=== レンダリング ({job.get('template', config.DEFAULT_TEMPLATE)}) ===")
    try:
        result = render(
            workdir=workdir, source=source, info=info,
            start=start, duration=duration,
            template=job.get("template", config.DEFAULT_TEMPLATE),
            game=_rect_from_dict(job.get("game_rect")),
            live2d=_rect_from_dict(job.get("live2d_rect")),
            audio_index=audio_index,
            source_crop=_rect_from_dict(job.get("source_crop")),
            outputs=args.outputs,
            loudness=stats,
        )
    except RenderError as exc:
        print(f"\nレンダリングエラー: {exc}", file=sys.stderr)
        return 3

    print(f"  所要 {result.elapsed_sec:.1f}秒 (実時間比 {duration / result.elapsed_sec:.2f}x)")
    for label, path in (("納品用(透かしなし)", result.clean), ("プレビュー用(透かしあり)", result.watermarked)):
        if path:
            print(f"  {label}: {path}  ({path.stat().st_size / 1024 / 1024:.1f} MB)")
    return 0


def cmd_preview(args: argparse.Namespace) -> int:
    workdir = Path(args.work).resolve()
    job = load_job(workdir)
    source = Path(job["source"])
    try:
        info = probe(source)
    except ProbeError as exc:
        print(f"入力エラー: {exc}", file=sys.stderr)
        return 2
    ensure_font(workdir)
    try:
        path = render_preview(
            workdir=workdir, source=source, info=info,
            start=float(job["start"]), duration=float(job["duration"]),
            template=job.get("template", config.DEFAULT_TEMPLATE),
            game=_rect_from_dict(job.get("game_rect")),
            live2d=_rect_from_dict(job.get("live2d_rect")),
            audio_index=int(job.get("audio_index", 0)),
            source_crop=_rect_from_dict(job.get("source_crop")),
        )
    except RenderError as exc:
        print(f"プレビュー生成エラー: {exc}", file=sys.stderr)
        return 3
    print(f"プレビュー: {path} ({path.stat().st_size / 1024:.0f} KB)")
    return 0


def cmd_all(args: argparse.Namespace) -> int:
    code = cmd_subs(args)
    if code != 0:
        return code
    workdir = sorted((ROOT / "work").glob("*"))[-1] if not args.work else Path(args.work)
    render_args = argparse.Namespace(work=str(workdir), outputs=args.outputs)
    return cmd_render(render_args)


# --------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="clip.py",
        description="VtuberMatch 切り抜きShorts 生成CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("check", help="実行環境を確認する").set_defaults(func=cmd_check)

    p_peek = sub.add_parser("peek", help="指定時刻の静止画を抜き出して位置を目視確認する")
    p_peek.add_argument("--in", dest="input", required=True, help="元動画のパス")
    p_peek.add_argument("--at", required=True, type=parse_time, help="確認したい時刻 (例 1:25:30)")
    p_peek.add_argument("--offset", type=float, default=0.0, help="補正秒数 (例 -90)")
    p_peek.add_argument("--out", default="", help="出力先ディレクトリ (既定: work/peek)")
    p_peek.set_defaults(func=cmd_peek)

    p_probe = sub.add_parser("probe", help="入力動画を検証して構成を表示する")
    p_probe.add_argument("--in", dest="input", required=True, help="元動画のパス")
    p_probe.set_defaults(func=cmd_probe)

    def add_subs_args(p: argparse.ArgumentParser) -> None:
        p.add_argument("--in", dest="input", required=True, help="元動画のパス")
        p.add_argument("--start", required=True, type=parse_time, help="開始時刻 (例 12:34)")
        p.add_argument("--end", required=True, type=parse_time, help="終了時刻 (例 13:20)")
        p.add_argument("--work", default=None, help="作業ディレクトリ (既定: work/日時)")
        p.add_argument("--offset", type=float, default=0.0,
                       help="指定時刻に加える補正秒数。顧客がYouTubeの再生位置で時刻を伝え、"
                            "送られてきたファイルの時間軸がずれている場合に使う (例: -90)")
        p.add_argument("--template", default=config.DEFAULT_TEMPLATE, choices=config.TEMPLATE_IDS,
                       help="レイアウト " + " / ".join(f"{k}:{v}" for k, v in config.TEMPLATE_LABELS.items()))
        p.add_argument("--game-rect", type=parse_rect, default=None,
                       help="ゲーム画面の領域 x,y,w,h (比率。テンプレA/Cで必須)")
        p.add_argument("--live2d-rect", type=parse_rect, default=None,
                       help="Live2Dの領域 x,y,w,h (比率。テンプレA/Cで必須)")
        p.add_argument("--source-crop", type=parse_rect, default=None,
                       help="テンプレ適用前に元動画を切り取る x,y,w,h (比率)。"
                            "コメント欄など不要領域を落とすのに使う (例: 0.23,0,0.77,1)")
        p.add_argument("--asr", default=DEFAULT_BACKEND, choices=BACKENDS, help="文字起こしエンジン")
        p.add_argument("--whisper-model", default="", help="ffmpeg-whisper 用の ggml モデルパス")
        p.add_argument("--dict", default=None, help="固有名詞辞書 (1行1語のテキスト)")
        p.add_argument("--speakers", default="tracks", choices=("tracks", "single"),
                       help="tracks: 音声トラックごとに話者を分ける / single: 常に1話者")
        p.add_argument("--karaoke", action="store_true",
                       help="カラオケ強調を付ける(既定は単色)。話者色分けと配色が衝突するため複数話者では非推奨")

    p_subs = sub.add_parser("subs", help="文字起こしして subs.ass を作る（ここで停止）")
    add_subs_args(p_subs)
    p_subs.set_defaults(func=cmd_subs)

    p_render = sub.add_parser("render", help="subs.ass を焼き込んで完成MP4を出力する")
    p_render.add_argument("--work", required=True, help="subs で作られた作業ディレクトリ")
    p_render.add_argument("--outputs", default="both", choices=("both", "clean", "wm"),
                          help="both: 両方 / clean: 透かしなしのみ / wm: 透かしありのみ")
    p_render.set_defaults(func=cmd_render)

    p_prev = sub.add_parser("preview", help="低解像度プレビューを作る（確認用・軽い）")
    p_prev.add_argument("--work", required=True)
    p_prev.set_defaults(func=cmd_preview)

    p_all = sub.add_parser("all", help="subs と render を続けて実行する")
    add_subs_args(p_all)
    p_all.add_argument("--outputs", default="both", choices=("both", "clean", "wm"))
    p_all.set_defaults(func=cmd_all)

    return parser


def main() -> int:
    args = build_parser().parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    sys.exit(main())
