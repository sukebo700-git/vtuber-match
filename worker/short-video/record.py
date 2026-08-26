#!/usr/bin/env python
"""マイクから録音する。ベンチマーク用の読み上げ収録に使う。

    python record.py --list              # 使えるマイクを一覧表示
    python record.py --test              # 5秒のレベルチェック（まずこれ）
    python record.py --seconds 200 --out work/bench/voice.wav

録音後に音量レベルを判定して、小さすぎる/歪んでいる場合は警告する。
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def list_devices() -> list[tuple[str, str]]:
    """(表示名, 内部識別名) の一覧を返す。日本語名は引数で壊れやすいので識別名を使う。"""
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"],
        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120,
    )
    devices: list[tuple[str, str]] = []
    pending: str | None = None
    for line in proc.stderr.splitlines():
        name = re.search(r'"([^"]+)"\s+\(audio\)', line)
        if name:
            pending = name.group(1)
            continue
        alt = re.search(r'Alternative name\s+"([^"]+)"', line)
        if alt and pending:
            devices.append((pending, alt.group(1)))
            pending = None
    return devices


def pick_device(devices: list[tuple[str, str]], wanted: str) -> tuple[str, str]:
    if wanted:
        for label, alt in devices:
            if wanted.lower() in label.lower():
                return label, alt
        raise SystemExit(f"'{wanted}' に一致するマイクがありません")
    # 仮想デバイス(Steam等)は避けて、実機マイクを優先する
    for label, alt in devices:
        if "steam" not in label.lower() and "virtual" not in label.lower():
            return label, alt
    if devices:
        return devices[0]
    raise SystemExit("録音デバイスが見つかりません。マイクを接続してください。")


def measure(path: Path) -> tuple[float, float]:
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(path), "-af", "volumedetect", "-f", "null", "-"],
        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=600,
    )
    mean = re.search(r"mean_volume:\s*(-?[\d.]+) dB", proc.stderr)
    peak = re.search(r"max_volume:\s*(-?[\d.]+) dB", proc.stderr)
    return (
        float(mean.group(1)) if mean else -99.0,
        float(peak.group(1)) if peak else -99.0,
    )


def verdict(mean: float, peak: float) -> bool:
    """録音レベルの良否を判定する。読み上げ音声の目安は平均 -30〜-18 dB。"""
    print(f"\n  平均音量: {mean:.1f} dB / ピーク: {peak:.1f} dB")
    if peak < -50:
        print("  [NG] ほぼ無音です。")
        print("       ・マイクが物理的に挿さっているか")
        print("       ・Windows設定 → システム → サウンド → 入力 でミュートになっていないか")
        print("       ・入力音量が0になっていないか")
        print("       ・別の端子(ライン入力やヘッドホン出力)に挿していないか")
        return False
    if mean < -45:
        print("  [NG] 音が小さすぎます。Windowsの入力音量を上げるか、マイクに近づいてください。")
        return False
    if peak > -1.0:
        print("  [NG] 音が割れています(クリッピング)。入力音量を下げてください。")
        return False
    if mean < -35:
        print("  [△] やや小さめですが認識はできます。もう少し近づくと精度が上がります。")
        return True
    print("  [OK] 良好なレベルです。")
    return True


def record(alt_name: str, seconds: float, out: Path, countdown: int = 3) -> Path:
    out.parent.mkdir(parents=True, exist_ok=True)
    for i in range(countdown, 0, -1):
        print(f"  {i}...", flush=True)
        time.sleep(1)
    print(f"  ● 録音開始（{seconds:.0f}秒）— 話してください", flush=True)

    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "dshow", "-i", f"audio={alt_name}",
        "-t", f"{seconds:.3f}",
        "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", str(out),
    ]
    proc = subprocess.run(
        cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
        timeout=seconds + 120,
    )
    if proc.returncode != 0:
        raise SystemExit(f"録音に失敗しました:\n{proc.stderr.strip()[-800:]}")
    print("  ■ 録音終了")
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true", help="使えるマイクを一覧表示")
    ap.add_argument("--test", action="store_true", help="5秒のレベルチェック")
    ap.add_argument("--device", default="", help="マイク名の一部（省略時は実機マイクを自動選択）")
    ap.add_argument("--seconds", type=float, default=200.0, help="録音秒数")
    ap.add_argument("--out", default="work/bench/voice.wav")
    args = ap.parse_args()

    devices = list_devices()
    if not devices:
        raise SystemExit("録音デバイスが見つかりません。マイクを接続してください。")

    if args.list:
        print("=== 使える録音デバイス ===")
        for label, _alt in devices:
            print(f"  {label}")
        return 0

    label, alt = pick_device(devices, args.device)
    print(f"使用するマイク: {label}")

    if args.test:
        out = ROOT / "work" / "bench" / "mictest.wav"
        print("\n5秒間、普通の声で何か話してください。")
        record(alt, 5.0, out)
        return 0 if verdict(*measure(out)) else 1

    out = Path(args.out)
    if not out.is_absolute():
        out = ROOT / out
    print(f"\n出力先: {out}")
    print("台本を普通の話速で読み上げてください。")
    record(alt, args.seconds, out)
    ok = verdict(*measure(out))
    size_mb = out.stat().st_size / 1024 / 1024
    print(f"\n  {out}  ({size_mb:.1f} MB)")
    if ok:
        print("\n次の手順:")
        print(f"  python asrtest.py --in \"{out}\" --start 0 --dur {args.seconds:.0f} --model large-v3 --device cuda")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
