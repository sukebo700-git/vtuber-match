#!/usr/bin/env python
"""クリーンな音声に BGM / ゲーム音を指定SNRで混ぜて、ベンチマーク素材を作る。

スピーカーで流しながら録るより、後から混ぜる方が良い:
  - 声とノイズの音量比(SNR)をdB単位で制御できる
  - 同じ読み上げから何度でも作り直せる(再現性)
  - 読み上げは1回で済む

    # 1本ずつ
    python mixbgm.py --voice voice.m4a --noise bgm.mp3 --snr 10 --out A2-bgm.wav

    # SNRを振って一気に作る
    python mixbgm.py --voice voice.m4a --noise bgm.mp3 --sweep 20,15,10,5 --outdir work/bench

    # 動画からノイズ源を取り出す(ゲーム音の抽出)
    python mixbgm.py --extract-noise "配信.mp4" --out game-noise.wav --start 60 --dur 180

SNRの目安:
  20dB … BGMが小さめ。実況の標準的な設定
  15dB … 一般的な配信のBGM音量
  10dB … BGMがかなり大きい。ゲーム音が乗っている状態に近い
   5dB … 声とノイズがほぼ同じ。かなり厳しい条件
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def run(cmd: list[str], what: str) -> subprocess.CompletedProcess[str]:
    proc = subprocess.run(
        cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=1800
    )
    if proc.returncode != 0:
        raise SystemExit(f"{what} が失敗しました:\n{proc.stderr.strip()[-1200:]}")
    return proc


def measure_lufs(path: Path) -> float:
    """統合ラウドネス(LUFS)を測る。音量比の計算に使う。"""
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-y", "-i", str(path),
         "-af", "loudnorm=print_format=json", "-f", "null", "-"],
        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=1800,
    )
    blocks = re.findall(r"\{[^{}]*\"input_i\"[^{}]*\}", proc.stderr, re.DOTALL)
    if not blocks:
        raise SystemExit(f"ラウドネスを測定できませんでした: {path}")
    return float(json.loads(blocks[-1])["input_i"])


def duration_of(path: Path) -> float:
    proc = run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nk=1:nw=1", str(path)],
        "長さの取得",
    )
    return float(proc.stdout.strip())


def extract_noise(source: Path, out: Path, start: float, dur: float) -> None:
    """動画からノイズ源(BGM・ゲーム音)を抜き出す。"""
    run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", str(source),
         "-vn", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", str(out)],
        "ノイズ源の抽出",
    )
    print(f"ノイズ源: {out}  ({duration_of(out):.1f}秒, {measure_lufs(out):.1f} LUFS)")


def mix(voice: Path, noise: Path, snr_db: float, out: Path) -> None:
    """voice に noise を指定SNRで重ねる。voiceの音量は変えない。"""
    voice_lufs = measure_lufs(voice)
    noise_lufs = measure_lufs(noise)
    # ノイズを (voice_lufs - snr) LUFS まで持っていく
    gain_db = (voice_lufs - snr_db) - noise_lufs

    run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-i", str(voice),
         # 声より短ければノイズを繰り返す
         "-stream_loop", "-1", "-i", str(noise),
         "-filter_complex",
         f"[1:a]volume={gain_db:.2f}dB[bg];"
         f"[0:a][bg]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out]",
         "-map", "[out]", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(out)],
        "混合",
    )
    print(
        f"  SNR {snr_db:>4.0f}dB → {out.name}"
        f"  (声 {voice_lufs:.1f} / ノイズ {noise_lufs:.1f}{gain_db:+.1f}dB)"
    )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--voice", help="クリーンな読み上げ音声(m4a/wav/mp3)")
    ap.add_argument("--noise", help="混ぜるBGM/ゲーム音")
    ap.add_argument("--snr", type=float, default=None, help="目標SNR(dB)")
    ap.add_argument("--sweep", default="", help="SNRを振る (例: 20,15,10,5)")
    ap.add_argument("--out", help="出力ファイル")
    ap.add_argument("--outdir", default="", help="sweep時の出力先ディレクトリ")
    ap.add_argument("--extract-noise", dest="extract", help="この動画からノイズ源を抽出する")
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--dur", type=float, default=180.0)
    args = ap.parse_args()

    if args.extract:
        if not args.out:
            return ap.error("--extract-noise には --out が必要です")
        extract_noise(Path(args.extract).resolve(), Path(args.out).resolve(), args.start, args.dur)
        return 0

    if not args.voice or not args.noise:
        return ap.error("--voice と --noise を指定してください")

    voice = Path(args.voice).resolve()
    noise = Path(args.noise).resolve()
    for path in (voice, noise):
        if not path.exists():
            raise SystemExit(f"ファイルがありません: {path}")

    print(f"声  : {voice.name} ({duration_of(voice):.1f}秒)")
    print(f"雑音: {noise.name} ({duration_of(noise):.1f}秒)")

    if args.sweep:
        outdir = Path(args.outdir or ROOT / "work" / "bench").resolve()
        outdir.mkdir(parents=True, exist_ok=True)
        for token in args.sweep.split(","):
            snr = float(token.strip())
            mix(voice, noise, snr, outdir / f"snr{int(snr):02d}.wav")
        print(f"\n出力先: {outdir}")
        return 0

    if args.snr is None:
        return ap.error("--snr か --sweep のどちらかを指定してください")
    if not args.out:
        return ap.error("--out を指定してください")
    mix(voice, noise, args.snr, Path(args.out).resolve())
    return 0


if __name__ == "__main__":
    sys.exit(main())
