"""文字起こしバックエンド。

どのエンジンを本採用するかは未確定(素材Aでのベンチマーク待ち)なので、
Word列を返す共通インターフェースの裏に差し替え可能な形で並べている。

重要(調査報告書 第3部):
  カラオケ風強調には「単語単位タイムスタンプ」が必須。
  OpenAIでは whisper-1 のみが対応し、gpt-4o-transcribe系は非対応。
"""

from __future__ import annotations

import json
import mimetypes
import os
import subprocess
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass

from . import config
from pathlib import Path

BACKENDS = ("openai", "faster-whisper", "ffmpeg-whisper")
# 暫定でローカルGPUを既定にする。無料・音声を外部送信しない・単語タイムスタンプも取れる。
# OpenAI whisper-1 との精度比較(素材A)が済んだら再検討すること。
DEFAULT_BACKEND = "faster-whisper"


class TranscribeError(Exception):
    """文字起こしに失敗した。多くはシステム起因(failed_system相当)。"""


@dataclass
class Word:
    text: str
    start: float
    end: float
    speaker: int = 0
    # Whisperのセグメント通し番号。日本語では"単語"が「お/しゃ/べ/り」レベルの
    # 断片になり語間ギャップが当てにならないため、字幕の分割はセグメント境界を
    # 優先する(語間ギャップで切ると「これがア」「イギス、エ」のように割れる)。
    segment: int = 0
    # 音量から決まる強調レベル(0=通常, 1=叫び)。emphasis.py が後から設定する
    emphasis: int = 0
    # 固有名詞辞書に載っている語。意味的なキーワードとして色を変える
    keyword: bool = False

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)


def transcribe(
    audio: Path,
    backend: str = DEFAULT_BACKEND,
    language: str = "ja",
    prompt: str = "",
    speaker: int = 0,
    model_path: str = "",
    use_hotwords: bool = True,
) -> list[Word]:
    """音声ファイルからWord列を返す。speakerは呼び出し側が割り当てる。"""
    if backend == "openai":
        words = _openai_whisper1(audio, language, prompt)
    elif backend == "faster-whisper":
        words = _faster_whisper(audio, language, prompt, use_hotwords)
    elif backend == "ffmpeg-whisper":
        words = _ffmpeg_whisper(audio, language, model_path)
    else:
        raise TranscribeError(f"未知のバックエンドです: {backend}（利用可能: {', '.join(BACKENDS)}）")

    for w in words:
        w.speaker = speaker
    return _clean(words)


def _clean(words: list[Word]) -> list[Word]:
    """空白のみの語を落とし、時刻の逆転を潰す。"""
    out: list[Word] = []
    for w in words:
        text = w.text.strip()
        if not text:
            continue
        start = max(0.0, w.start)
        end = max(start, w.end)
        # Whisperは長い無音を語の継続時間に含めることがある。
        # 1語が数秒続くことはないので上限で切る(字幕が出っぱなしになるのを防ぐ)
        end = min(end, start + config.WORD_MAX_SEC)
        if out and start < out[-1].end:
            # Whisperは稀に区間が重なるので、直前の終端に合わせる
            start = out[-1].end
            end = max(start, end)
        # Whisperは区間の境目で直前の語を繰り返すことがある。
        # そのまま出すと「またお前か!か!」のように重複して見える。
        if out and out[-1].text == text and start - out[-1].end < 0.25:
            continue
        out.append(Word(text=text, start=start, end=end, speaker=w.speaker,
                        segment=w.segment, emphasis=w.emphasis, keyword=w.keyword))
    return out


# --------------------------------------------------------------------------
# OpenAI whisper-1 (単語タイムスタンプ対応・確実)
# --------------------------------------------------------------------------

def _encode_multipart(fields: dict[str, str], file_field: str, file_path: Path) -> tuple[bytes, str]:
    """requestsに依存せず multipart/form-data を組む。"""
    boundary = f"----clipcli{uuid.uuid4().hex}"
    crlf = b"\r\n"
    parts: list[bytes] = []

    for key, value in fields.items():
        parts.append(f"--{boundary}".encode())
        parts.append(f'Content-Disposition: form-data; name="{key}"'.encode())
        parts.append(b"")
        parts.append(str(value).encode("utf-8"))

    mime = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    parts.append(f"--{boundary}".encode())
    parts.append(
        f'Content-Disposition: form-data; name="{file_field}"; filename="{file_path.name}"'.encode()
    )
    parts.append(f"Content-Type: {mime}".encode())
    parts.append(b"")
    parts.append(file_path.read_bytes())
    parts.append(f"--{boundary}--".encode())
    parts.append(b"")

    return crlf.join(parts), f"multipart/form-data; boundary={boundary}"


def _openai_whisper1(audio: Path, language: str, prompt: str) -> list[Word]:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise TranscribeError(
            "環境変数 OPENAI_API_KEY が設定されていません。\n"
            "ローカルGPUで処理する場合は --asr faster-whisper を指定してください。"
        )

    size_mb = audio.stat().st_size / 1024 / 1024
    if size_mb > 25:
        raise TranscribeError(
            f"音声ファイルが25MBを超えています ({size_mb:.1f}MB)。"
            "切り抜き範囲を短くするか、ビットレートを下げてください"
        )

    fields = {
        "model": "whisper-1",  # 単語タイムスタンプに対応する唯一のOpenAIモデル
        "response_format": "verbose_json",
        "timestamp_granularities[]": "word",
        "language": language,
    }
    if prompt:
        # 固有名詞辞書。Whisperのpromptは直前文脈として働き、表記を誘導できる
        fields["prompt"] = prompt[:900]

    body, content_type = _encode_multipart(fields, "file", audio)
    req = urllib.request.Request(
        "https://api.openai.com/v1/audio/transcriptions",
        data=body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": content_type},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:400]
        raise TranscribeError(f"OpenAI APIエラー {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise TranscribeError(f"OpenAI APIに接続できません: {exc.reason}") from exc

    raw_words = payload.get("words")
    if not raw_words:
        raise TranscribeError(
            "単語タイムスタンプが返りませんでした。"
            "response_format=verbose_json と timestamp_granularities[]=word を確認してください"
        )

    # words[] にセグメント番号は含まれないため、segments[] の時間範囲から逆引きする
    ranges = [
        (float(s.get("start", 0.0)), float(s.get("end", 0.0)))
        for s in payload.get("segments", [])
    ]

    def segment_of(start: float) -> int:
        for i, (s0, s1) in enumerate(ranges):
            if s0 - 0.01 <= start <= s1 + 0.01:
                return i
        return 0

    return [
        Word(
            text=str(w.get("word", "")),
            start=float(w.get("start", 0.0)),
            end=float(w.get("end", 0.0)),
            segment=segment_of(float(w.get("start", 0.0))),
        )
        for w in raw_words
    ]


# --------------------------------------------------------------------------
# faster-whisper (ローカルGPU・MITライセンス)
# --------------------------------------------------------------------------

def register_cuda_dlls() -> list[str]:
    """pip版のCUDAランタイムDLLをWindowsの検索パスに登録する。

    nvidia-cublas-cu12 / nvidia-cudnn-cu12 は site-packages/nvidia/*/bin にDLLを置くが、
    ctranslate2 は自動では見に行かないため、明示的に登録する。
    これをやらないと 'cublas64_12.dll is not found' で GPU 実行が落ちる。

    add_dll_directory だけでは足りない点に注意。ctranslate2 は実行時に
    LoadLibrary で cuBLAS/cuDNN を遅延ロードしており、その検索順は
    add_dll_directory を見ないため、PATH にも前置きする必要がある。
    """
    added: list[str] = []
    if not hasattr(os, "add_dll_directory"):  # Windows以外では不要
        return added
    import site

    roots = list(site.getsitepackages())
    user_site = site.getusersitepackages()
    if isinstance(user_site, str):
        roots.append(user_site)

    for root in roots:
        nvidia = Path(root) / "nvidia"
        if not nvidia.is_dir():
            continue
        for bin_dir in sorted(nvidia.rglob("bin")):
            if not any(bin_dir.glob("*.dll")):
                continue
            path = str(bin_dir)
            try:
                os.add_dll_directory(path)
            except OSError:
                pass
            current = os.environ.get("PATH", "")
            if path not in current.split(os.pathsep):
                os.environ["PATH"] = path + os.pathsep + current
            added.append(path)
    return added


def _faster_whisper(audio: Path, language: str, prompt: str, use_hotwords: bool = True) -> list[Word]:
    register_cuda_dlls()
    try:
        from faster_whisper import WhisperModel  # type: ignore[import-not-found]
    except ImportError as exc:
        raise TranscribeError(
            "faster-whisper が見つかりません。\n"
            "  pip install faster-whisper\n"
            "でインストールするか、--asr openai を指定してください。"
        ) from exc

    model_name = os.environ.get("CLIP_FW_MODEL", "large-v3")
    device = os.environ.get("CLIP_FW_DEVICE", "cuda")
    compute_type = os.environ.get("CLIP_FW_COMPUTE", "float16")

    try:
        model = WhisperModel(model_name, device=device, compute_type=compute_type)
    except Exception as exc:  # モデルDL失敗・CUDA未対応など理由が多岐にわたる
        raise TranscribeError(f"faster-whisperの初期化に失敗しました: {exc}") from exc

    # initial_prompt は最初のウィンドウにしか効きにくく、固有名詞辞書としては弱い。
    # faster-whisper の hotwords は各ウィンドウに効くため、辞書はこちらで渡す。
    # vad_filter は既定でオフにする。
    # 実素材(遊楽木たいむ)では VAD が笑い声や叫びを「非音声」と判定して
    # 丸ごと捨ててしまい、98秒中48秒ぶんの発話が字幕化されなかった。
    # 例: 15秒の区間が VAD あり=「なんて、俺の?」1件だけ、
    #     VAD なし=「俺のパスカルがー!」×3件と正しく取れる。
    # 無音でのハルシネーションは no_speech_threshold で抑える。
    kwargs: dict = {
        "language": language,
        "word_timestamps": True,
        "vad_filter": config.ASR_VAD_FILTER,
        "no_speech_threshold": config.ASR_NO_SPEECH_THRESHOLD,
        "condition_on_previous_text": False,
    }
    if prompt:
        if use_hotwords:
            kwargs["hotwords"] = prompt
        else:
            kwargs["initial_prompt"] = prompt
    segments, _info = model.transcribe(str(audio), **kwargs)

    words: list[Word] = []
    for seg_index, seg in enumerate(segments):
        for w in (seg.words or []):
            words.append(
                Word(text=str(w.word), start=float(w.start), end=float(w.end), segment=seg_index)
            )

    if not words:
        raise TranscribeError("faster-whisperが単語を返しませんでした（無音の可能性があります）")
    return words


# --------------------------------------------------------------------------
# ffmpeg内蔵 whisper フィルタ (whisper.cpp)
# --------------------------------------------------------------------------

def _ffmpeg_whisper(audio: Path, language: str, model_path: str) -> list[Word]:
    """ffmpeg 8.x の whisper フィルタを使う。

    注意: このフィルタの json 出力が単語単位のタイムスタンプを含むかは未検証。
    セグメント単位しか返らない場合、カラオケ強調は使えない。
    """
    model = model_path or os.environ.get("CLIP_WHISPER_MODEL", "")
    if not model:
        raise TranscribeError(
            "whisper.cppのモデルファイルが指定されていません。\n"
            "  --whisper-model <path/to/ggml-large-v3.bin>\n"
            "または環境変数 CLIP_WHISPER_MODEL を設定してください。"
        )
    if not Path(model).exists():
        raise TranscribeError(f"モデルファイルが見つかりません: {model}")

    out_json = audio.with_suffix(".whisper.json")
    filt = (
        f"whisper=model={_escape_filter_value(model)}"
        f":language={language}"
        f":format=json"
        f":destination={_escape_filter_value(str(out_json))}"
    )
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(audio), "-af", filt, "-f", "null", "-"]
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if proc.returncode != 0:
        raise TranscribeError(f"ffmpeg whisperフィルタが失敗しました: {proc.stderr.strip()[:400]}")

    if not out_json.exists():
        raise TranscribeError("whisperフィルタが出力ファイルを作成しませんでした")

    data = json.loads(out_json.read_text(encoding="utf-8"))
    words = _extract_words_loose(data)
    if not words:
        raise TranscribeError(
            "ffmpeg whisperの出力から単語タイムスタンプを取り出せませんでした。\n"
            "セグメント単位のみの場合、カラオケ強調は使えません。"
            " --asr openai または --asr faster-whisper を使ってください。"
        )
    return words


def _extract_words_loose(data: object) -> list[Word]:
    """出力スキーマが不明なため、start/end/textらしきキーを再帰的に探す。"""
    found: list[Word] = []

    def walk(node: object) -> None:
        if isinstance(node, dict):
            keys = {k.lower() for k in node}
            has_time = ("start" in keys or "t0" in keys) and ("end" in keys or "t1" in keys)
            text_key = next((k for k in node if k.lower() in ("word", "text", "token")), None)
            if has_time and text_key:
                start_key = "start" if "start" in node else "t0"
                end_key = "end" if "end" in node else "t1"
                try:
                    found.append(
                        Word(
                            text=str(node[text_key]),
                            start=_to_seconds(node[start_key]),
                            end=_to_seconds(node[end_key]),
                        )
                    )
                except (TypeError, ValueError):
                    pass
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(data)
    return found


def _to_seconds(value: object) -> float:
    """whisper.cppはcentisecond単位で返すことがあるため補正する。"""
    num = float(value)  # type: ignore[arg-type]
    # 1本の切り抜きは最大180秒。それを大きく超える値は10ms単位とみなす
    return num / 100.0 if num > 10_000 else num


def _escape_filter_value(value: str) -> str:
    """filter引数中の ':' '\\' をエスケープする（Windowsのドライブレター対策）。"""
    return value.replace("\\", "/").replace(":", r"\:")
