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

# --- 文字起こしの挙動 ---
# VADは笑い声・叫び・裏声を「非音声」と誤判定して捨てるため既定でオフ。
# 実素材では98秒中48秒ぶんの発話が丸ごと落ちていた。
ASR_VAD_FILTER = False
# VADを切るぶん、無音でのハルシネーションはこちらで抑える(既定0.6より強め)
ASR_NO_SPEECH_THRESHOLD = 0.7
# Whisperは「あの」「えー」「ね」といったフィラーを整形して落とすことがある。
# 配信の切り抜きでは話し方の癖も含めて字幕にした方が自然なので、
# フィラー込みの文例を initial_prompt に置いて残す方向へ寄せる。
# (hotwords は固有名詞辞書に使っているため、こちらは別枠で渡す)
ASR_KEEP_FILLERS = True
ASR_FILLER_PROMPT = "えーっと、あのー、なんかね、そうそう、まあ、うーん、っていうかさ、ね。"

# --- 笑い声の検出 ---
# Whisperは「あははは」のような非言語音声を文字にしない(VADを切っても同じ)。
# 音響特徴から拾って字幕を自前で挿入する。
LAUGH_ENABLED = True
LAUGH_MIN_SEC = 1.0            # これ未満は拾わない(短い相槌を除く)
LAUGH_MIN_DB = -22.0           # 十分に大きいこと
LAUGH_MIN_BRIGHT_DB = -6.0     # 高域が持ち上がっていること(息の成分)
# 「ハハハ」の脈動。叫びは持続音なので脈動が少なく、ここで区別できる
LAUGH_PULSE_MIN_HZ = 3.0
LAUGH_PULSE_MAX_HZ = 9.0
LAUGH_MAX_HA = 6               # テロップの「は」の最大数
LAUGH_SHORT_SEC = 1.5          # これ未満の短い笑いは「ｗ」表記にする
LAUGH_FAST_HZ = 5.5            # これ以上の速さで刻む笑いも「ｗ」寄りにする
# 検出窓の頭は無音を含む。ピークからこのdB以内に立ち上がった位置を発声開始とみなす
LAUGH_ONSET_DROP_DB = 12.0

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

# 強調語は本文と書体を変える。プロのテロップは通常テキストと強調テキストで
# 書体を分け、書体そのものでも「ここが山場」と伝える。
# 同じ級数でも書体ごとに字面の大きさが違うため、倍率で揃える。
FONT_EMPHASIS_NAME = "RocknRoll One"
FONT_EMPHASIS_FILE = "RocknRollOne-Regular.ttf"
FONT_EMPHASIS_SIZE_ADJUST = 1.12

# 同梱している書体(すべて SIL OFL 1.1 / 商用利用可)
#   VMClipGothicBlack.ttf     Noto Sans JP を wght=900 で静的化したもの(本文)
#   RocknRollOne-Regular.ttf  Fontworks RocknRoll One(強調)
#   ZenMaruGothic-Bold.ttf    Zen Maru Gothic Bold(丸ゴシック・任意)
#   MPLUSRounded1c-Black.ttf  M PLUS Rounded 1c Black(丸ゴシック・任意)
BUNDLED_FONTS = (
    "VMClipGothicBlack.ttf",
    "RocknRollOne-Regular.ttf",
    "ZenMaruGothic-Bold.ttf",
    "MPLUSRounded1c-Black.ttf",
)
FONT_SIZE = 86
OUTLINE = 9          # 参考動画に合わせて太く。細いと映像に負ける
SHADOW = 4
# 参考動画では字幕が画面中央付近にある。下端だとアバターの体にかぶり、
# Shorts UI(いいね/コメント)とも近くなるため、中央寄りに上げる。
MARGIN_V = 700
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
# 高域比(2kHz以上のエネルギー比)。コンプレッサーで音量が潰れた素材でも、
# 叫び・高い声は高域に寄るので検出できる。実素材では音量の変化幅2.4dBに対し
# 高域比は12.8dBあり、こちらだけが使い物になった。
EMPHASIS_BRIGHT_DB = 3.5      # 中央値より何dB高ければ強調するか
WORD_BRIGHT_DB = 2.0          # 語単位の判定しきい値
# 変化幅がこれ未満の特徴量は「平坦」とみなして判定に使わない。
# 平坦な系列をそのまま使うと、しきい値付近のノイズで誤検出する。
EMPHASIS_MIN_SPREAD_DB = 3.0
# 「中央値より N dB」ではなく上位何割を強調するかで決める。
# クリップの大半が盛り上がっている素材だと中央値自体が高くなり、
# 相対比較ではどのブロックもしきい値を超えなくなるため。
EMPHASIS_TOP_RATIO = 0.25     # ブロックの上位25%を強調
WORD_TOP_RATIO = 0.15         # (未使用。連続区間方式に変更)
# 跳ねさせるのは1ブロックにつき連続した1区間だけ。散らすと雑に見える。
WORD_EMPHASIS_MAX_RUN = 4     # 何語まで続けて強調するか
WORD_EMPHASIS_MIN_CHARS = 2   # これ未満の断片は強調しない
# 文節境界に合わせた結果、行のこの割合を超えるなら強調を取り消す。
# 行のほとんどが強調されていると「どこが山場か」が伝わらない。
EMPHASIS_MAX_SHARE = 0.6
# 音響スコアの分離がこの値未満なら強調しない。
# 確信が持てないのに演出を入れると、狙って強調したようには見えない。
WORD_MIN_SPREAD_DB = 4.0
EMPHASIS_SCALE = 1.30         # 強調時の文字サイズ倍率
# 語単位の強調。行全体ではなく、その行の中で一番音が大きい語だけを跳ねさせる。
# プロのテロップは行全体を大きくせず、キーワードだけ跳ねる。
WORD_EMPHASIS_DB = 3.0        # 同じブロック内の中央値より何dB大きければ跳ねさせるか
WORD_EMPHASIS_SCALE = 1.45    # 跳ねる語の文字サイズ倍率
WORD_POP_MS = 130             # 語が跳ねる時間
WORD_POP_OVERSHOOT = 118      # 一度この%まで拡大してから戻る
# 固有名詞辞書に載っている語は意味的なキーワードとして色を変える。
# 参考動画は「オタク衣装」のように意味で色を分けており、
# 音量ベースの強調だけでは拾えない語をここで拾う。
KEYWORD_ENABLED = True
KEYWORD_COLOR = "&H0030C0FF"   # 山吹色(BGR順)
KEYWORD_MIN_CHARS = 2

EMPHASIS_COLOR = "&H003C5AFF"  # 強調色(BGR順なので赤寄りオレンジ)
EMPHASIS_OUTLINE = 12         # 強調時はさらに太く

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
MAX_SEGMENT_SEC = 6.0          # これを超えるブロックは内部の最大無音で分割する
# Whisperは長い無音を語の継続時間に含めることがあり、実素材では
# 「な、なんだ。またおまえか!」が16.3秒表示される不具合が出た。
# 1語がこれ以上続くことはないので、超えたぶんは切り詰める。
WORD_MAX_SEC = 1.6
# これ未満のブロックは直前に併合する。0.1秒だけ光って消える取り残しを防ぐ
MIN_BLOCK_SEC = 0.45

# ASSは &HAABBGGRR (AA=00で不透明)
COLOR_WHITE = "&H00FFFFFF"
COLOR_KARAOKE = "&H0000E5FF"  # カラオケ未発話色(オレンジ)
COLOR_OUTLINE = "&H00301A10"  # 濃紺寄りの黒。純黒より締まって見える
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
# テンプレートの選び方
#   雑談・トーク  → D (Live2Dを大きく。誰が喋っているかが主役)
#   ゲーム実況    → B / C (ゲーム画面を含める。プレイ内容が主役)
# 同じ配信でも場面によって変わるため、依頼時に切り抜く場面の性質を確認する。
TEMPLATE_IDS = ("A", "B", "C", "D")
DEFAULT_TEMPLATE = "B"

TEMPLATE_LABELS = {
    "A": "上下分割(上:ゲーム画面 / 下:Live2D)",
    "B": "背景ぼかし + 中央原寸(領域指定不要・既定)",
    "C": "ゲーム中央 + Live2D右下",
    "D": "Live2D主役(上:ゲーム小 / 下:Live2D大)。雑談向け",
}

# テンプレートDでゲーム画面に割く高さ。残りがLive2Dになる。
# 760/1920 で上から4割。参考動画はアバターが6割を占めていた。
TEMPLATE_D_GAME_H = 760

# --- 効果音 ---
# 効果音ラボ等の配布サイトは直リンクを弾く(403)ため、ffmpegで自前生成した音を
# assets/se/ に同梱している。生成音なので配布・商用利用の制約が一切ない。
#   pop.wav     笑いのテロップに合わせる軽い音
#   impact.wav  強調(叫び)に合わせる低い衝撃音
#   whoosh.wav  未使用(場面転換用に用意)
SE_ENABLED = True
SE_DIR = "se"
SE_LAUGH = "pop.wav"
SE_EMPHASIS = "impact.wav"
# 元の配信音声に対する音量。上げすぎると喋りが聞き取れなくなる。
# -18dB は「言われないと気づかないが、無いと物足りない」程度。
SE_VOLUME_DB = -18.0
SE_MAX_COUNT = 24        # 1本あたりの上限。鳴らしすぎるとうるさい

# --- 透かし ---
WATERMARK_WIDTH = 260
WATERMARK_MARGIN_X = 40
WATERMARK_MARGIN_Y = 120
