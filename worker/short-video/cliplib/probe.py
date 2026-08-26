"""ffprobeによる入力検証。

重い処理に入る前にここで弾くのが原則(調査報告書 第11部 #4/#5/#7)。
Content-Typeや拡張子は信用せず、必ず実ストリームを見る。
"""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

from . import config


class ProbeError(Exception):
    """入力が仕様を満たさない。ユーザー起因のエラー(failed_user相当)。"""


@dataclass
class AudioTrack:
    index: int          # ファイル内の絶対stream index
    audio_index: int    # 音声ストリーム中の通し番号(-map 0:a:N のN)
    codec: str
    channels: int
    language: str = ""
    title: str = ""


@dataclass
class ProbeResult:
    path: Path
    size_bytes: int
    duration_sec: float
    container: str
    video_codec: str
    width: int
    height: int
    fps: float
    audio_tracks: list[AudioTrack] = field(default_factory=list)

    @property
    def is_multitrack(self) -> bool:
        """音声トラックが2本以上あれば、トラック単位の話者分離が使える。"""
        return len(self.audio_tracks) >= 2


def _parse_fraction(value: str) -> float:
    if not value:
        return 0.0
    if "/" in value:
        num, _, den = value.partition("/")
        try:
            d = float(den)
            return float(num) / d if d else 0.0
        except ValueError:
            return 0.0
    try:
        return float(value)
    except ValueError:
        return 0.0


def probe(path: Path) -> ProbeResult:
    """ffprobeで実際のストリーム構成を読み、仕様違反があればProbeErrorを投げる。"""
    if not path.exists():
        raise ProbeError(f"ファイルが見つかりません: {path}")

    size = path.stat().st_size
    if size > config.MAX_INPUT_BYTES:
        raise ProbeError(
            f"ファイルサイズが上限を超えています "
            f"({size / 1024 / 1024:.0f}MB > {config.MAX_INPUT_BYTES / 1024 / 1024:.0f}MB)"
        )
    if size == 0:
        raise ProbeError("ファイルが空です")

    cmd = [
        "ffprobe", "-v", "error",
        "-print_format", "json",
        "-show_format", "-show_streams",
        str(path),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if proc.returncode != 0:
        raise ProbeError(
            "動画として読み取れませんでした（ファイルが壊れているか、対応していない形式です）\n"
            f"ffprobe: {proc.stderr.strip()[:300]}"
        )

    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise ProbeError(f"ffprobeの出力を解釈できませんでした: {exc}") from exc

    fmt = data.get("format", {})
    streams = data.get("streams", [])

    if len(streams) > config.MAX_INPUT_STREAMS:
        raise ProbeError(f"ストリーム数が多すぎます ({len(streams)})")

    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    if video is None:
        raise ProbeError("映像ストリームが見つかりません（音声のみのファイルの可能性があります）")

    vcodec = str(video.get("codec_name", "")).lower()
    if vcodec in config.REJECTED_VIDEO_CODECS:
        raise ProbeError(
            f"編集用マスター形式（{vcodec}）には対応していません。"
            "H.264で書き出してからアップロードしてください"
        )
    if vcodec not in config.ALLOWED_VIDEO_CODECS:
        raise ProbeError(f"対応していない映像コーデックです: {vcodec}")

    width = int(video.get("width") or 0)
    height = int(video.get("height") or 0)
    if width <= 0 or height <= 0:
        raise ProbeError("解像度を取得できませんでした")
    if width > config.MAX_INPUT_WIDTH or height > config.MAX_INPUT_HEIGHT:
        raise ProbeError(
            f"解像度が上限を超えています ({width}x{height} > "
            f"{config.MAX_INPUT_WIDTH}x{config.MAX_INPUT_HEIGHT})"
        )

    # avg_frame_rateは可変フレームレートだと0/0になることがあるのでr_frame_rateも見る
    fps = _parse_fraction(str(video.get("avg_frame_rate", "")))
    if fps <= 0:
        fps = _parse_fraction(str(video.get("r_frame_rate", "")))
    if fps > config.MAX_INPUT_FPS + 0.5:
        raise ProbeError(f"フレームレートが上限を超えています ({fps:.1f}fps > {config.MAX_INPUT_FPS:.0f}fps)")

    duration = float(fmt.get("duration") or video.get("duration") or 0.0)
    if duration <= 0:
        raise ProbeError("再生時間を取得できませんでした（ファイルが破損している可能性があります）")
    if duration > config.MAX_INPUT_DURATION_SEC:
        raise ProbeError(
            f"動画が長すぎます ({duration / 60:.0f}分 > "
            f"{config.MAX_INPUT_DURATION_SEC / 60:.0f}分)。"
            "切り抜きたい範囲を含む短い区間に切ってからアップロードしてください"
        )

    tracks: list[AudioTrack] = []
    for audio_index, stream in enumerate(s for s in streams if s.get("codec_type") == "audio"):
        acodec = str(stream.get("codec_name", "")).lower()
        if acodec not in config.ALLOWED_AUDIO_CODECS:
            # 対応外の音声トラックは無視する(他が使えるなら処理は続行できる)
            continue
        tags = stream.get("tags", {}) or {}
        tracks.append(
            AudioTrack(
                index=int(stream.get("index", -1)),
                audio_index=audio_index,
                codec=acodec,
                channels=int(stream.get("channels") or 0),
                language=str(tags.get("language", "")),
                title=str(tags.get("title", "")),
            )
        )

    if not tracks:
        raise ProbeError("利用できる音声ストリームが見つかりません（字幕を生成できません）")

    return ProbeResult(
        path=path,
        size_bytes=size,
        duration_sec=duration,
        container=str(fmt.get("format_name", "")),
        video_codec=vcodec,
        width=width,
        height=height,
        fps=fps,
        audio_tracks=tracks,
    )


def validate_clip_range(info: ProbeResult, start_sec: float, end_sec: float) -> None:
    """切り抜き範囲が妥当かを検証する。"""
    if start_sec < 0:
        raise ProbeError("開始時刻が負の値です")
    if end_sec <= start_sec:
        raise ProbeError("終了時刻は開始時刻より後にしてください")
    if start_sec >= info.duration_sec:
        raise ProbeError(
            f"開始時刻({start_sec:.1f}秒)が動画の長さ({info.duration_sec:.1f}秒)を超えています"
        )

    length = end_sec - start_sec
    if length < config.MIN_CLIP_SEC:
        raise ProbeError(f"切り抜きが短すぎます ({length:.1f}秒 < {config.MIN_CLIP_SEC:.0f}秒)")
    if length > config.MAX_CLIP_SEC:
        raise ProbeError(f"切り抜きが長すぎます ({length:.1f}秒 > {config.MAX_CLIP_SEC:.0f}秒)")
    if end_sec > info.duration_sec + 0.5:
        raise ProbeError(
            f"終了時刻({end_sec:.1f}秒)が動画の長さ({info.duration_sec:.1f}秒)を超えています"
        )


def format_summary(info: ProbeResult) -> str:
    lines = [
        f"  ファイル   : {info.path.name}",
        f"  サイズ     : {info.size_bytes / 1024 / 1024:.1f} MB",
        f"  長さ       : {info.duration_sec:.1f} 秒 ({info.duration_sec / 60:.1f} 分)",
        f"  映像       : {info.video_codec} {info.width}x{info.height} {info.fps:.2f}fps",
        f"  音声トラック: {len(info.audio_tracks)} 本",
    ]
    for t in info.audio_tracks:
        label = t.title or t.language or "(名称なし)"
        lines.append(f"    - a:{t.audio_index} {t.codec} {t.channels}ch {label}")
    if info.is_multitrack:
        lines.append("  → マルチトラック検出: トラック単位の話者分離が使えます")
    return "\n".join(lines)
