"""切り抜きShorts生成の定数・テンプレート定義。

出力仕様は調査報告書(第15部/J-3)の確定値に合わせている。
数値を変えるとYouTube Shortsでの互換性や採算に影響するため、
変更する場合は根拠を添えること。
"""

from __future__ import annotations

# --- 入力制限(調査報告書 第12部 J-2) ---
MAX_INPUT_BYTES = 2 * 1024 * 1024 * 1024  # 2 GB
MAX_INPUT_DURATION_SEC = 1800  # 30分
MAX_INPUT_WIDTH = 3840
MAX_INPUT_HEIGHT = 2160
MAX_INPUT_FPS = 60.0
MAX_INPUT_STREAMS = 8

ALLOWED_VIDEO_CODECS = {"h264", "hevc", "vp9", "av1"}
ALLOWED_AUDIO_CODECS = {"aac", "opus", "mp3", "pcm_s16le", "pcm_s24le", "pcm_f32le", "vorbis", "flac"}
# 編集用マスターは1分で数GBになり、サイズ上限に無意味に引っかかるため明示的に拒否する
REJECTED_VIDEO_CODECS = {"prores", "dnxhd", "rawvideo", "ffv1", "huffyuv"}

# --- 切り抜き長 ---
MIN_CLIP_SEC = 5.0
MAX_CLIP_SEC = 180.0

# --- 出力仕様 ---
OUT_WIDTH = 1080
OUT_HEIGHT = 1920
OUT_FPS = 30

VIDEO_ARGS = [
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "22",
    "-maxrate", "8M",
    "-bufsize", "16M",
    "-pix_fmt", "yuv420p",
    "-r", str(OUT_FPS),
    "-g", str(OUT_FPS * 2),
    "-keyint_min", str(OUT_FPS),
    "-sc_threshold", "0",
    "-profile:v", "high",
    "-level:v", "4.2",
    # 明示しないとYouTube側で色が変わることがある
    "-colorspace", "bt709",
    "-color_primaries", "bt709",
    "-color_trc", "bt709",
]

AUDIO_ARGS = [
    # libfdk-aacはnonfreeなのでFFmpeg内蔵aacを使う(調査報告書 第14部)
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "48000",
    "-ac", "2",
]

CONTAINER_ARGS = ["-movflags", "+faststart"]

# YouTubeは-14 LUFSに正規化する。ここに合わせておくと音量を下げられない
LOUDNORM_I = -14.0
LOUDNORM_TP = -1.5
LOUDNORM_LRA = 11.0

# --- プレビュー(低解像度・回数無制限枠)仕様 ---
PREVIEW_WIDTH = 360
PREVIEW_HEIGHT = 640
PREVIEW_FPS = 15
PREVIEW_MAX_SEC = 30

# --- 文字起こし用の音声抽出 ---
# 25MB上限のAPIに送れるよう、モノラル16kHz Opusまで落とす
ASR_AUDIO_ARGS = [
    "-vn",
    "-ac", "1",
    "-ar", "16000",
    "-af", "highpass=f=80",
    "-c:a", "libopus",
    "-b:a", "32k",
]

# --- 字幕スタイル(調査報告書 第4部) ---
FONT_NAME = "Noto Sans JP"
FONT_SIZE = 86
OUTLINE = 7
SHADOW = 3
MARGIN_V = 300  # Shorts UI(いいね/コメント/タイトル)との干渉回避
MARGIN_H = 60

MAX_LINES = 2
MAX_LINE_WIDTH = 14.0  # 全角換算
SEGMENT_GAP_SEC = 0.6  # これ以上の無音で字幕を分割
MAX_SEGMENT_SEC = 6.0

# ASSは &HAABBGGRR (AA=00で不透明)
COLOR_WHITE = "&H00FFFFFF"
COLOR_KARAOKE = "&H0000E5FF"  # カラオケ未発話色(オレンジ)
COLOR_OUTLINE = "&H00202020"
COLOR_BACK = "&H80000000"

# 話者ごとの本文色。コラボ切り抜きの色分けに使う(第3部/方式A・C)
SPEAKER_COLORS = [
    COLOR_WHITE,        # 話者0: 白
    "&H0080FFFF",       # 話者1: 黄
    "&H00FF9060",       # 話者2: 水色寄りの青
    "&H00A0FFA0",       # 話者3: 緑
]

# --- テンプレート ---
# 各テンプレートはfilter_complexの「背景+前景の合成」部分だけを担い、
# 字幕焼き込みと透かしはrender.py側で共通に付ける。
TEMPLATE_IDS = ("A", "B", "C")
DEFAULT_TEMPLATE = "B"

TEMPLATE_LABELS = {
    "A": "上下分割(上:ゲーム画面 / 下:Live2D)",
    "B": "背景ぼかし + 中央原寸(領域指定不要・既定)",
    "C": "ゲーム中央 + Live2D右下",
}

# --- 透かし ---
WATERMARK_WIDTH = 260
WATERMARK_MARGIN_X = 40
WATERMARK_MARGIN_Y = 120
