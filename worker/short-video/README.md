# 紹介ショート動画ワーカー

管理画面で「GO」した依頼(`short_video_requests` の `status: approved`)を検知し、
ナレーション合成(VOICEVOX)→ 動画生成(ffmpeg)→ YouTubeへ非公開アップロードまでを自動で行います。

## 事前準備(初回のみ)

1. **ffmpeg**: PCにインストール済みであること(`ffmpeg -version` で確認)
2. **VOICEVOX**: VOICEVOXアプリまたはEngineを起動しておく(標準: `http://127.0.0.1:50021`)
3. **Google OAuth クライアント**: Google Cloud ConsoleでOAuthクライアント(デスクトップアプリ)を作成し、
   YouTube Data API v3 を有効化。`.env.local` に追記:

   ```env
   YOUTUBE_OAUTH_CLIENT_ID=xxxxx.apps.googleusercontent.com
   YOUTUBE_OAUTH_CLIENT_SECRET=xxxxx
   ```

4. **YouTube認可**(公式チャンネルのGoogleアカウントで):

   ```bash
   npm run worker:short-video:auth
   ```

   トークンは `worker/short-video/.secrets/youtube-token.json` に保存されます(gitには入りません)。

## 実行

```bash
# 1回だけ処理して終了
npm run worker:short-video

# 60秒ごとに監視し続ける
npm run worker:short-video -- --watch
```

## オプション

- `VOICEVOX_SPEAKER`: 話者ID(既定: 1)
- `VOICEVOX_BASE_URL`: VOICEVOXのURL(既定: `http://127.0.0.1:50021`)
- `worker/short-video/assets/bgm.mp3` を置くと、BGMとして小音量でミックスされます(フリー音源を使用してください)

## フロー

1. 管理画面で紹介テキストを入力して「GO」→ `status: approved`
2. ワーカーが `rendering` に変更して制作開始
3. 完了すると `uploaded` + `youtube_video_id` が書き込まれ、動画は**非公開**でアップされます
4. YouTube Studioで内容を確認して公開したら、管理画面で「公開済みにする」を押す → `published`
5. 配信者側の依頼ページに公開動画リンクが表示されます

失敗した場合は `status` が `approved` に戻り、`worker_error` に原因が記録されます(再実行で再試行)。

## 注意

- 紹介テキストは200文字程度までを推奨(長いとナレーションが60秒を超え、Shorts扱いにならない場合があります)
- YouTube API のアップロードは1本あたり1600クォータ(既定の1日10,000クォータで約6本/日)
