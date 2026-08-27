# 切り抜きShorts 生成CLI

配信の指定区間から、字幕入り・縦型9:16のShortsを作るローカルツール。
運営PC上で動かす前提。Webアプリ（Next.js側）からは独立している。

## 必要なもの

| | 状態 |
|---|---|
| ffmpeg / ffprobe | libx264 + libass + libopus + fontconfig 入りのビルド |
| Python | 3.10 以上 |
| Noto Sans JP | `C:/Windows/Fonts/NotoSansJP-VF.ttf` または `assets/` に配置 |
| budoux | `pip install budoux`（日本語の改行品質に効く。無くても動く） |
| 文字起こし | 下記のいずれか |

環境の充足は次で確認できる。

```bash
python clip.py check
```

## 文字起こしエンジン

`--asr` で切り替える。**既定は `faster-whisper`（暫定）**。

| `--asr` | 必要なもの | 単語タイムスタンプ | 備考 |
|---|---|---|---|
| **`faster-whisper`（既定）** | `pip install faster-whisper` + CUDAランタイム | **実測OK** | ローカルGPU。無料・音声を外部送信しない |
| `openai` | 環境変数 `OPENAI_API_KEY` | 対応（公式仕様） | whisper-1。$0.006/分。**未実測** |
| `ffmpeg-whisper` | `--whisper-model <ggml.bin>` | **未検証** | ffmpeg内蔵。単語単位が取れない可能性がある |

単語タイムスタンプが取れないとカラオケ強調（`\k`）は使えない。
OpenAIでは **whisper-1 のみ**が対応し、gpt-4o-transcribe 系は非対応。

既定を `faster-whisper` にしたのは、無料・外部送信なしで単語タイムスタンプも取れることを
実測で確認したため。**OpenAI whisper-1 との精度比較（正解テキスト付きの素材）はまだ未実施**なので、
比較後に見直すこと。

### GPUを使うための準備（Windows）

```bash
pip install faster-whisper nvidia-cublas-cu12 nvidia-cudnn-cu12
```

ctranslate2 は実行時に `LoadLibrary` で cuBLAS/cuDNN を遅延ロードするため、
`os.add_dll_directory` だけでは見つけられない。`cliplib.transcribe.register_cuda_dlls()` が
`PATH` にも前置きして解決している（`cublas64_12.dll is not found` はこれで直る）。

モデルは初回実行時に自動ダウンロードされる（large-v3 で約3GB、`~/.cache/huggingface`）。
環境変数で変えられる: `CLIP_FW_MODEL` / `CLIP_FW_DEVICE` / `CLIP_FW_COMPUTE`。

## 使い方

### 1. 入力を確認する

```bash
python clip.py probe --in "C:/path/to/配信.mp4"
```

コーデック・尺・解像度に加えて **音声トラック数** を表示する。
2本以上あれば、トラック単位での話者分離（精度100%・追加コストなし）が使える。

### 2. 文字起こしして字幕を作る

```bash
python clip.py subs --in "C:/path/to/配信.mp4" --start 12:34 --end 13:20
```

`work/<日時>/` に `subs.ass`（字幕）と `subs.txt`（目視確認用）を出力して**停止する**。

主なオプション:

| オプション | 内容 |
|---|---|
| `--template A\|B\|C` | レイアウト。既定は `B`（背景ぼかし＋中央原寸、領域指定不要） |
| `--game-rect x,y,w,h` | ゲーム画面の領域（比率 0.0〜1.0）。テンプレA/Cで必須 |
| `--live2d-rect x,y,w,h` | Live2Dの領域（比率）。テンプレA/Cで必須 |
| `--dict terms.txt` | 固有名詞辞書（1行1語）。ゲーム名・キャラ名・リスナー名を入れる |
| `--speakers tracks\|single` | `tracks`（既定）は音声トラックごとに話者を分ける |
| `--no-karaoke` | カラオケ強調を付けない |

### 3. 字幕を直す

`subs.ass` をテキストエディタで開いて誤字を修正する。
動画を見ながら直せる **Aegisub**（無料のASS専用エディタ）を使うと大幅に速い。

- **話者の色を変える**: 各 `Dialogue:` 行の Style 列を `Speaker0` / `Speaker1` … に書き換える
  （ミックス音声のコラボはここで手動割当する。3分クリップで3〜5分）
- 色の定義は `[V4+ Styles]` の `PrimaryColour`

### 4. レンダリングする

```bash
python clip.py render --work "work/20260826-120000"
```

- `out.mp4` … 納品用（透かしなし）
- `out_wm.mp4` … プレビュー用（透かしあり）

`--outputs clean` / `--outputs wm` で片方だけにもできる。
両方作る場合、デコードとフィルタは1回だけ走る。

### 確認用の軽いプレビュー

```bash
python clip.py preview --work "work/20260826-120000"
```

360×640 / 15fps / 先頭30秒。本番の約1/20の原価なので回数を気にしなくてよい。

### まとめて実行

```bash
python clip.py all --in "配信.mp4" --start 12:34 --end 13:20
```

字幕の手直しを挟まないので、辞書が効いている素材向け。

## 出力仕様

YouTube Shortsの推奨設定に合わせてある（変更する場合は根拠を添えること）。

| | |
|---|---|
| 映像 | H.264 High@4.2 / 1080×1920 / 30fps CFR / CRF 22 / maxrate 8M |
| 音声 | AAC-LC 192kbps / 48kHz / ステレオ |
| ラウドネス | −14 LUFS / TP −1.5 dBTP（2パス loudnorm） |
| コンテナ | MP4 + faststart |

## 入力制限

| | |
|---|---|
| ファイルサイズ | 2 GB |
| 動画の長さ | 30分 |
| 解像度 | 3840×2160 まで |
| フレームレート | 60fps まで |
| 切り抜き長 | 5〜180秒 |
| 映像コーデック | h264 / hevc / vp9 / av1（ProRes・DNxHDは拒否） |

## 動作確認

```bash
python selftest.py            # 字幕生成ロジックのみ（ASR不要）
python selftest.py --render   # 実素材でレンダリングまで通す
```

改行位置・話者色分け・ASSタグ注入対策・カラオケタグ・
Whisperセグメント境界の尊重（13項目）を検証する。

```bash
python asrtest.py --in 動画.mp4 --start 60 --dur 60 --model large-v3 --device cuda
```

文字起こしの疎通・速度・単語タイムスタンプ有無を確認する。

```bash
# 正解テキストと突き合わせてCER・固有名詞正解率を出す
python score.py --in work/bench/voice.m4a --compare

# マイクから録音する
python record.py --test                          # レベルチェック
python record.py --seconds 200 --out work/bench/voice.wav

# BGM/ゲーム音を指定SNRで混ぜる
python mixbgm.py --voice work/bench/voice.m4a --noise work/bench/game-noise.wav --sweep 20,15,10,5
```

## 実測値（2026-08-26 / Ryzen 16コア + RTX 3060 Ti）

### レンダリング

| | |
|---|---|
| 3分・テンプレB・単一出力・`-threads 4` | **128.9秒**（1.40x realtime）／73.6 MB |
| 90秒・テンプレB・二重出力（透かし有無）・スレッド制限なし | **89.5秒**（1.01x realtime）／33.6 MB |
| 出力ラウドネス | −14.08 / −13.82 LUFS（目標 −14） |
| True Peak | −1.42 / −1.15 dBTP（目標 −1.5） |

True Peak が目標を 0.1〜0.4 dB 上回ることがある。入力が非常に小さい
（−26.9 LUFS → +12.9 dB のゲイン）ときに loudnorm の linear モードが
わずかにオーバーシュートするため。YouTube の上限は 0 dBTP なので実害はない。

### 文字起こし（faster-whisper large-v3 / float16 / RTX 3060 Ti）

| | |
|---|---|
| 推論速度 | **7.8〜9.0x realtime**（60秒の音声を 6.7〜7.7秒） |
| モデル読込（ウォーム） | 15秒前後（初回はダウンロード込みで81秒） |
| 単語タイムスタンプ | **取得できる**（カラオケ強調が可能） |
| 90秒クリップの実測 | 92語 / 21.4秒（モデル読込込み） |

`base` モデルは誤認識が多く実用外だった（「マジにブックワースキで」→ large-v3 では
「マジにぶっ壊す気で」と正しく認識）。**large-v3 を使うこと。**

### 精度（読み上げ台本 121秒 / large-v3 / 正解テキストとの突き合わせ）

固有名詞辞書の渡し方で結果が大きく変わる。

| 辞書の渡し方 | CER | 固有名詞正解率 |
|---|---:|---:|
| 辞書なし | 22.9% | 50.0% |
| `initial_prompt` | 19.9% | 63.6% |
| **`hotwords`（採用）** | **15.3%** | **81.8%** |

`initial_prompt` は最初のウィンドウにしか効きにくく、固有名詞辞書としては弱い。
`hotwords` は各ウィンドウに効くため、**辞書は必ず `hotwords` で渡すこと**。
これだけで固有名詞の正解率が +31.8 ポイント改善する。

CERのうち3〜4ポイントは録音側の要因（台本の指示行を読み上げてしまった、
台本にないアドリブを足した）なので、実質のCERは11〜12%程度。

残る弱点:

| 誤り | 種類 |
|---|---|
| XxKotaroxX → カタロックス | 英数字混じりの固有名詞 |
| たろう2000 → たろう2003 | 数字 |
| ミゼリィ → ミゼリー | 長音の揺れ |
| 歌枠 → 歌 | 辞書にあるのに脱落 |

いずれも運営の目視確認で数十秒で直る範囲。**人間確認を挟む単品販売モデルなら許容できるが、
完全セルフサービスの月額モデルには足りない**（調査報告書のGo基準は固有名詞85%・字幕修正率5%）。

### BGM耐性（同じ音声にゲーム音を指定SNRで混合）

| SNR | CER | 固有名詞正解率 | 相当する状況 |
|---|---:|---:|---|
| クリーン | 15.3% | 81.8% | BGMなし |
| 20dB | 15.0% | 81.8% | BGMが小さめ |
| 15dB | 15.9% | 86.4% | 一般的な配信のBGM音量 |
| 10dB | 18.2% | 86.4% | BGMがかなり大きい |
| **5dB** | **45.7%** | 77.3% | 声とノイズがほぼ同じ |

**SNR 10dB までは実用上ほぼ劣化しない。5dB で崖が来る。**
一般的な配信のBGM音量（15〜20dB）は安全圏。

※ n=1 の測定であり、15/10dB で正解率がクリーンを上回っているのは測定ゆらぎ。
　傾向を読むための数字であって、小数点以下の差に意味はない。

### 未実測

- OpenAI whisper-1 との精度比較（APIキー未設定。同じ素材で測れる状態にはある）
- 実配信の汚い音声での挙動（台本読み上げは明瞭すぎる）
- 実配信素材でのテンプレート A / C（合成した矩形指定では動作確認済み）
- 実際のコラボ収録での話者分離（合成した2トラック素材では動作確認済み）
- Cloud Run コンテナ上でのレンダリング時間（上記は16コア機での測定。1.2〜1.5倍遅くなる想定）

## サーバ実装へ移すときの差分

このCLIはローカル用に割り切っており、以下はサーバ版で追加が要る。

- 元動画を毎回シークして読むため、R2から都度ダウンロードすると無駄になる。
  3分の `cut.mp4` を切り出して24時間保持し、再レンダはそれを使う
- `/tmp` はCloud Runでは tmpfs（RAM）なので、ephemeral-disk を使う
- 入力検証（`probe.py`）はそのまま流用できる
- 字幕の手直しはWeb UI（Phase 3）か、運営コンソールからのASS差し替えで代替する
