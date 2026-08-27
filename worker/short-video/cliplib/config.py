"""切り抜きShorts生成の定数・テンプレート定義。

出力仕様は調査報告書(第15部/J-3)の確定値に合わせている。
数値を変えるとYouTube Shortsでの互換性や採算に影響するため、
変更する場合は根拠を添えること。
"""

from __future__ import annotations

import os

# --- 入力制限(調査報告書 第12部 J-2) ---
# ローカルCLIは配信アーカイブ全体を受け取る前提で緩めに設定している。
# YouTube Studio からのダウンロードは動画まるごとになるため、
# 「30分・2GB」では3時間配信が弾かれてしまう。
#
# 処理自体は入力側シーク(-ss を -i の前)で必要な区間しか読まないので、
# 長い動画でも処理時間はほぼ変わらない。ボトルネックは転送だけ。
#
# サーバ実装(Cloud Run)へ移す際は、ephemeral-disk と転送コストの都合で
# ここを 2GB / 30分 に戻すこと。
MAX_INPUT_BYTES = int(os.environ.get("CLIP_MAX_BYTES", 8 * 1024 * 1024 * 1024))  # 8 GB
MAX_INPUT_DURATION_SEC = int(os.environ.get("CLIP_MAX_DURATION", 4 * 3600))  # 4時間
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
# Noto Sans JP は可変フォントだが、libass は wght 軸を指定できず Regular で描かれる。
# Bold=1 の合成太字も弱く、テロップとしては細すぎた。
# そこで fontTools で wght=900 の静的インスタンスを生成し、
# 既存の "Noto Sans JP" と衝突しない一意な名前を付けて assets/ に置いている。
# 生成元は Noto Sans JP (SIL OFL 1.1) なので商用利用に問題はない。
#   python -c "from fontTools.ttLib import TTFont; from fontTools.varLib import instancer; ..."
#   詳細は README の「フォント」を参照
FONT_NAME = "VMClip Gothic Black"
FONT_FILE = "VMClipGothicBlack.ttf"
FONT_SIZE = 86
OUTLINE = 7
SHADOW = 3
MARGIN_V = 300  # Shorts UI(いいね/コメント/タイトル)との干渉回避
# 話者が複数いるとき、2人目以降を段積みする間隔。発話が重なっても両方読める
SPEAKER_MARGIN_STEP = 200
MARGIN_H = 60

# --- 演出(強調) ---
# 音量から「叫んでいる箇所」を検出して字幕を強調する。
# しきい値はクリップ内の中央値からの相対値。配信者ごとに基準音量が違うため、
# 絶対dBでは判定できない。
EMPHASIS_STEP_SEC = 0.1       # 音量を測る間隔
EMPHASIS_LOUD_DB = 6.0        # ブロックピークの中央値より何dB大きければ強調するか
EMPHASIS_MIN_BLOCKS = 4       # これ未満のブロック数では中央値が不安定なので強調しない
EMPHASIS_SCALE = 1.30         # 強調時の文字サイズ倍率
# 語単位の強調。行全体ではなく、その行の中で一番音が大きい語だけを跳ねさせる。
# プロのテロップは行全体を大きくせず、キーワードだけ跳ねる。
WORD_EMPHASIS_DB = 3.0        # 同じブロック内の中央値より何dB大きければ跳ねさせるか
WORD_EMPHASIS_SCALE = 1.45    # 跳ねる語の文字サイズ倍率
WORD_POP_MS = 130             # 語が跳ねる時間
WORD_POP_OVERSHOOT = 118      # 一度この%まで拡大してから戻る
EMPHASIS_COLOR = "&H003C5AFF"  # 強調色(BGR順なので赤寄りオレンジ)
EMPHASIS_OUTLINE = 9          # 強調時は縁取りも太くする

# 登場アニメーション。全字幕に軽く掛ける(ポップイン)
POP_IN_MS = 110
POP_IN_START_SCALE = 62       # 開始時の拡大率(%)

# 映像側の演出。強調区間だけ軽くズーム(パンチイン)して揺らす。
# 数値を上げると酔うので控えめにする。1.06倍は「言われないと気づかないが
# 並べると分かる」程度で、プロの切り抜きでもこのくらいが多い。
PUNCH_ZOOM = 1.06
PUNCH_SHAKE_PX = 5.0     # 揺れの振幅(px)
PUNCH_SHAKE_HZ = 7.0     # 揺れの速さ(Hz)

# テロップ慣習: 句読点は表示しない。日本語のテロップは「、」「。」を出さず
# 間で見せるのが一般的。感嘆符・疑問符は感情を伝えるので残す。
# 読点は「間」を残すため半角空白に、句点は完全に削除する。
# 全部消すと「草てぇてぇそれはそう」と繋がって読みにくくなる。
TELOP_STRIP_PUNCTUATION = True
TELOP_SPACE_CHARS = "、，"   # 半角空白に置換
TELOP_DROP_CHARS = "。．"    # 削除

# 強調時に加える揺れ。角度(度)と1往復の時間(ms)
SHAKE_DEG = 2.0
SHAKE_MS = 90

MAX_LINES = 2
# 全角換算。実測で14文字が約910px、使える幅は 1080-60-60=960px しかなく余裕がない。
# 縁取り7pxの張り出しも考慮して13に設定している。
MAX_LINE_WIDTH = 13.0
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
