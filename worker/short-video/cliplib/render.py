"""FFmpegによる音声抽出・ラウドネス測定・縦型レンダリング。

フィルタグラフは2026-08-26のベンチマークで実測済み:
  3分 / 1080x1920 / 30fps / -threads 4 → 128.9秒 (1.40x realtime) / 73.6MB

Windowsでは ass= フィルタにドライブレター付きパスを渡すと ':' の解釈で壊れるため、
ffmpegは常に作業ディレクトリをcwdにして相対パスで起動する。
"""

from __future__ import annotations

import json
import re
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

from . import config
from .probe import ProbeResult


class RenderError(Exception):
    """FFmpeg処理の失敗。"""


@dataclass
class Rect:
    """元動画に対する比率(0.0-1.0)で表した矩形。解像度が変わっても使い回せる。"""

    x: float
    y: float
    w: float
    h: float

    def to_pixels(self, src_w: int, src_h: int) -> tuple[int, int, int, int]:
        """yuv420pの制約に合わせて偶数に丸めたピクセル値を返す。"""
        def even(v: float) -> int:
            return max(2, int(round(v / 2)) * 2)

        w = even(self.w * src_w)
        h = even(self.h * src_h)
        x = even(self.x * src_w)
        y = even(self.y * src_h)
        # はみ出しを補正
        x = min(x, max(0, src_w - w))
        y = min(y, max(0, src_h - h))
        return x, y, w, h


@dataclass
class LoudnessStats:
    input_i: float
    input_tp: float
    input_lra: float
    input_thresh: float
    target_offset: float


def _run(
    cmd: list[str], cwd: Path | None = None, what: str = "ffmpeg", timeout: float = 1800.0
) -> subprocess.CompletedProcess[str]:
    try:
        proc = subprocess.run(
            cmd, cwd=str(cwd) if cwd else None,
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        raise RenderError(f"{what} が {timeout:.0f} 秒で終わりませんでした（引数の順序を確認してください）") from exc
    if proc.returncode != 0:
        raise RenderError(f"{what} が失敗しました:\n{proc.stderr.strip()[-1500:]}")
    return proc


# --------------------------------------------------------------------------
# 音声抽出
# --------------------------------------------------------------------------

def extract_audio(
    source: Path, out_path: Path, start: float, duration: float, audio_index: int = 0
) -> Path:
    """文字起こし用に、指定トラックの音声だけをモノラル16kHz Opusで抜き出す。"""
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-ss", f"{start:.3f}", "-t", f"{duration:.3f}", "-i", str(source),
        "-map", f"0:a:{audio_index}",
        *config.ASR_AUDIO_ARGS,
        str(out_path),
    ]
    _run(cmd, what="音声抽出")
    if not out_path.exists() or out_path.stat().st_size == 0:
        raise RenderError("音声の抽出結果が空です")
    return out_path


def extract_audio_only(source: Path, out_path: Path, start: float, duration: float) -> Path:
    """音声のみのファイル(m4a/wav/mp3等)から文字起こし用の音声を切り出す。

    精度測定には映像が要らないため、スマホのボイスメモやサウンドレコーダーの
    録音をそのまま渡せるようにしておく。
    """
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-ss", f"{start:.3f}", "-t", f"{duration:.3f}", "-i", str(source),
        *config.ASR_AUDIO_ARGS,
        str(out_path),
    ]
    _run(cmd, what="音声抽出")
    if not out_path.exists() or out_path.stat().st_size == 0:
        raise RenderError("音声の抽出結果が空です")
    return out_path


# --------------------------------------------------------------------------
# ラウドネス測定(2パスloudnormの1パス目)
# --------------------------------------------------------------------------

def measure_loudness(source: Path, start: float, duration: float, audio_index: int = 0) -> LoudnessStats | None:
    """1パス目の測定。失敗しても致命的ではないのでNoneを返して動的正規化に落とす。"""
    filt = (
        f"loudnorm=I={config.LOUDNORM_I}:TP={config.LOUDNORM_TP}"
        f":LRA={config.LOUDNORM_LRA}:print_format=json"
    )
    cmd = [
        "ffmpeg", "-hide_banner", "-y",
        "-ss", f"{start:.3f}", "-t", f"{duration:.3f}", "-i", str(source),
        "-map", f"0:a:{audio_index}", "-af", filt, "-f", "null", "-",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    match = re.findall(r"\{[^{}]*\"input_i\"[^{}]*\}", proc.stderr, re.DOTALL)
    if not match:
        return None
    try:
        data = json.loads(match[-1])
        return LoudnessStats(
            input_i=float(data["input_i"]),
            input_tp=float(data["input_tp"]),
            input_lra=float(data["input_lra"]),
            input_thresh=float(data["input_thresh"]),
            target_offset=float(data.get("target_offset", 0.0)),
        )
    except (json.JSONDecodeError, KeyError, ValueError):
        return None


def _loudnorm_filter(stats: LoudnessStats | None) -> str:
    base = f"loudnorm=I={config.LOUDNORM_I}:TP={config.LOUDNORM_TP}:LRA={config.LOUDNORM_LRA}"
    if stats is None:
        # 測定に失敗した場合は動的正規化。音質は落ちるが破綻はしない
        return f"{base},aresample=48000"
    return (
        f"{base}"
        f":measured_I={stats.input_i}:measured_TP={stats.input_tp}"
        f":measured_LRA={stats.input_lra}:measured_thresh={stats.input_thresh}"
        f":offset={stats.target_offset}:linear=true,aresample=48000"
    )


# --------------------------------------------------------------------------
# テンプレート別の合成フィルタ
# --------------------------------------------------------------------------

def _compose_filter(
    template: str, info: ProbeResult, game: Rect | None, live2d: Rect | None,
    source_crop: Rect | None = None,
) -> str:
    """入力[0:v]から縦型のベース映像[base]までを作るフィルタ列を返す。

    source_crop を指定すると、テンプレートを適用する前に元動画を切り取る。
    配信画面の左端にあるコメント欄など、Shortsでは読めない領域を落とすのに使う。
    切り落とすとゲーム画面を大きく使えるので、縦型にしたときの見栄えが上がる。
    """
    w, h = config.OUT_WIDTH, config.OUT_HEIGHT

    # 先頭に切り取りを差し込む。以降のフィルタは[0:v]ではなく[src]を使う
    pre = ""
    src = "0:v"
    if source_crop is not None:
        cx, cy, cw, ch = source_crop.to_pixels(info.width, info.height)
        pre = f"[0:v]crop={cw}:{ch}:{cx}:{cy}[src];"
        src = "src"
        # 切り取り後のサイズを基準に矩形を再計算する必要があるため、
        # source_crop と game/live2d の併用は現時点では未対応。

    if template == "B":
        # 背景ぼかし + 中央原寸。領域指定が不要なので既定に据えている。
        # gblurは重いが、疑似ぼかし(縮小→拡大)は出力ビットレートが上がり
        # egressで食い返すため、実測の結果gblurを採用している。
        return pre + (
            f"[{src}]fps={config.OUT_FPS},split=2[bg][fg];"
            f"[bg]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},"
            f"gblur=sigma=40,eq=brightness=-0.12:saturation=0.85[bgb];"
            f"[fg]scale={w}:-2:flags=lanczos[fgs];"
            f"[bgb][fgs]overlay=(W-w)/2:(H-h)/2[base]"
        )

    if template == "A":
        if game is None or live2d is None:
            raise RenderError("テンプレートAには --game-rect と --live2d-rect の指定が必要です")
        gx, gy, gw, gh = game.to_pixels(info.width, info.height)
        lx, ly, lw, lh = live2d.to_pixels(info.width, info.height)
        # 上段(ゲーム)は y=180 から 1080px。下段(Live2D)に使えるのは残り 1920-1300=620px。
        # 単に scale={w}:-2 にすると縦長のLive2D領域が画面外まで伸びて切れるため、
        # 枠に内接させて中央に置く。
        l2d_h = h - 1300
        return pre + (
            f"[{src}]fps={config.OUT_FPS},split=2[g][l];"
            f"[g]crop={gw}:{gh}:{gx}:{gy},scale={w}:1080:force_original_aspect_ratio=increase,"
            f"crop={w}:1080[gs];"
            f"[l]crop={lw}:{lh}:{lx}:{ly},"
            f"scale={w}:{l2d_h}:force_original_aspect_ratio=decrease[ls];"
            f"color=c=0x111111:s={w}x{h}:r={config.OUT_FPS}[canvas];"
            f"[canvas][gs]overlay=0:180:shortest=1[t1];"
            f"[t1][ls]overlay=(W-w)/2:1300[base]"
        )

    if template == "C":
        if game is None or live2d is None:
            raise RenderError("テンプレートCには --game-rect と --live2d-rect の指定が必要です")
        gx, gy, gw, gh = game.to_pixels(info.width, info.height)
        lx, ly, lw, lh = live2d.to_pixels(info.width, info.height)
        return pre + (
            f"[{src}]fps={config.OUT_FPS},split=3[bg][g][l];"
            f"[bg]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},"
            f"gblur=sigma=40,eq=brightness=-0.15[bgb];"
            f"[g]crop={gw}:{gh}:{gx}:{gy},scale={w}:-2:flags=lanczos[gs];"
            f"[l]crop={lw}:{lh}:{lx}:{ly},scale=420:-2[ls];"
            f"[bgb][gs]overlay=(W-w)/2:(H-h)/2[t1];"
            f"[t1][ls]overlay=W-w-30:H-h-430[base]"
        )

    raise RenderError(f"未知のテンプレートです: {template}")


def hot_spans(ass_path: Path) -> list[tuple[float, float]]:
    """ASSから強調ブロック(Styleが Hot で終わる行)の時間範囲を読む。

    映像側の演出をASSから駆動することで、運営が subs.ass のStyle列を
    手で書き換えれば、字幕だけでなくズームや揺れもそれに追随する。
    """
    if not ass_path.exists():
        return []

    def to_sec(v: str) -> float:
        h, m, rest = v.split(":")
        return int(h) * 3600 + int(m) * 60 + float(rest)

    spans: list[tuple[float, float]] = []
    for line in ass_path.read_text(encoding="utf-8").splitlines():
        if not line.startswith("Dialogue:"):
            continue
        cols = line.split(",", 9)
        if len(cols) < 10 or not cols[3].endswith("Hot"):
            continue
        try:
            spans.append((to_sec(cols[1]), to_sec(cols[2])))
        except (ValueError, IndexError):
            continue
    return _merge_spans(spans)


def _merge_spans(spans: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """重なる区間をまとめる。式が短くなり、二重にズームするのも防げる。"""
    if not spans:
        return []
    spans = sorted(spans)
    merged = [spans[0]]
    for start, end in spans[1:]:
        last_start, last_end = merged[-1]
        if start <= last_end + 0.05:
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))
    return merged


def _punch_filter(spans: list[tuple[float, float]]) -> str:
    """強調区間だけ軽くズームして揺らすフィルタ。区間が無ければ空文字。

    scale は時間式を取れないため zoompan を使う。d=1 で1フレームずつ通し、
    s= で出力サイズを固定する。x/y を明示しないと左上を基準に寄るので中央に置く。
    """
    if not spans:
        return ""
    z = config.PUNCH_ZOOM
    cond = "+".join(f"between(in_time,{a:.3f},{b:.3f})" for a, b in spans)
    active = f"min(1,{cond})"
    zoom = f"if({active},{z},1)"
    px, hz = config.PUNCH_SHAKE_PX, config.PUNCH_SHAKE_HZ
    shake = f"{active}*{px}*sin(in_time*{hz * 6.2832:.3f})"
    x = f"iw/2-(iw/zoom/2)+({shake})"
    y = f"ih/2-(ih/zoom/2)"
    return (
        f"zoompan=z='{zoom}':x='{x}':y='{y}'"
        f":d=1:s={config.OUT_WIDTH}x{config.OUT_HEIGHT}:fps={config.OUT_FPS}"
    )


# --------------------------------------------------------------------------
# 本レンダリング
# --------------------------------------------------------------------------

@dataclass
class RenderResult:
    clean: Path | None
    watermarked: Path | None
    elapsed_sec: float


def render(
    workdir: Path,
    source: Path,
    info: ProbeResult,
    start: float,
    duration: float,
    ass_name: str = "subs.ass",
    template: str = config.DEFAULT_TEMPLATE,
    game: Rect | None = None,
    live2d: Rect | None = None,
    audio_index: int = 0,
    watermark_name: str = "watermark.png",
    outputs: str = "both",
    source_crop: Rect | None = None,
    loudness: LoudnessStats | None = None,
    no_punch: bool = False,
) -> RenderResult:
    """字幕を焼き込んだ縦型MP4を生成する。

    outputs="both" の場合、デコードとフィルタは1回だけ走らせ、
    透かし有り版と無し版を同時に書き出す(2回別々に回すより約3割速い)。
    """
    if not (workdir / ass_name).exists():
        raise RenderError(f"字幕ファイルが見つかりません: {workdir / ass_name}")

    want_clean = outputs in ("both", "clean")
    want_wm = outputs in ("both", "wm")
    if not (want_clean or want_wm):
        raise RenderError(f"outputs の指定が不正です: {outputs}")

    compose = _compose_filter(template, info, game, live2d, source_crop)
    # fontsdir=. で作業ディレクトリ内のフォントも拾えるようにする
    graph = f"{compose};[base]ass={ass_name}:fontsdir=.[sub]"

    # 強調区間だけ軽くズームして揺らす。区間はASSのStyle列から読むので、
    # 運営が subs.ass を手で直せば映像側の演出もそれに追随する。
    punch = "" if no_punch else _punch_filter(hot_spans(workdir / ass_name))
    if punch:
        graph += f";[sub]{punch}[sub2]"
        sub_label = "sub2"
    else:
        sub_label = "sub"

    # -t は必ず -i の *前* に置く。後ろに置くと、続く -i watermark.png の
    # 入力オプションとして解釈され、元動画側が無制限に読まれてしまう。
    cmd: list[str] = [
        "ffmpeg", "-hide_banner", "-y",
        "-ss", f"{start:.3f}", "-t", f"{duration:.3f}", "-i", str(source),
    ]

    if want_wm:
        wm_path = workdir / watermark_name
        if not wm_path.exists():
            raise RenderError(f"透かし画像が見つかりません: {wm_path}")
        cmd += ["-i", watermark_name]

    if want_clean and want_wm:
        graph += (
            f";[{sub_label}]split=2[clean][towm]"
            f";[1:v]scale={config.WATERMARK_WIDTH}:-1[wm]"
            f";[towm][wm]overlay=W-w-{config.WATERMARK_MARGIN_X}:H-h-{config.WATERMARK_MARGIN_Y}[wmout]"
        )
    elif want_wm:
        graph += (
            f";[1:v]scale={config.WATERMARK_WIDTH}:-1[wm]"
            f";[{sub_label}][wm]overlay=W-w-{config.WATERMARK_MARGIN_X}:H-h-{config.WATERMARK_MARGIN_Y}[wmout]"
        )
    else:
        graph += f";[{sub_label}]null[clean]"

    audio_filter = _loudnorm_filter(loudness)
    cmd += ["-filter_complex", graph]

    clean_path = workdir / "out.mp4"
    wm_path_out = workdir / "out_wm.mp4"

    if want_clean:
        cmd += [
            "-map", "[clean]", "-map", f"0:a:{audio_index}",
            "-af", audio_filter,
            *config.VIDEO_ARGS, *config.AUDIO_ARGS, *config.CONTAINER_ARGS,
            "out.mp4",
        ]
    if want_wm:
        cmd += [
            "-map", "[wmout]", "-map", f"0:a:{audio_index}",
            "-af", audio_filter,
            *config.VIDEO_ARGS, *config.AUDIO_ARGS, *config.CONTAINER_ARGS,
            "out_wm.mp4",
        ]

    began = time.monotonic()
    _run(cmd, cwd=workdir, what="レンダリング")
    elapsed = time.monotonic() - began

    return RenderResult(
        clean=clean_path if want_clean and clean_path.exists() else None,
        watermarked=wm_path_out if want_wm and wm_path_out.exists() else None,
        elapsed_sec=elapsed,
    )


def render_preview(
    workdir: Path,
    source: Path,
    info: ProbeResult,
    start: float,
    duration: float,
    ass_name: str = "subs.ass",
    template: str = config.DEFAULT_TEMPLATE,
    game: Rect | None = None,
    live2d: Rect | None = None,
    audio_index: int = 0,
    source_crop: Rect | None = None,
) -> Path:
    """確認用の低解像度プレビュー。原価が本番の約1/20なので回数を絞る必要がない。"""
    dur = min(duration, float(config.PREVIEW_MAX_SEC))
    compose = _compose_filter(template, info, game, live2d, source_crop)
    graph = (
        f"{compose};[base]ass={ass_name}:fontsdir=.[sub]"
        f";[sub]scale={config.PREVIEW_WIDTH}:{config.PREVIEW_HEIGHT},fps={config.PREVIEW_FPS}[pv]"
    )
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", str(source),
        "-filter_complex", graph,
        "-map", "[pv]", "-map", f"0:a:{audio_index}",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "30", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "96k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart", "preview.mp4",
    ]
    _run(cmd, cwd=workdir, what="プレビュー生成")
    return workdir / "preview.mp4"


def make_placeholder_watermark(path: Path, text_hint: str = "VtuberMatch") -> Path:
    """本番用ロゴPNGが用意されるまでの仮の透かしを作る。"""
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi",
        "-i", f"color=c=white@0.80:s={config.WATERMARK_WIDTH}x80,format=rgba",
        "-frames:v", "1", str(path),
    ]
    _run(cmd, what="透かし生成")
    return path
