# Vtuberマッチ MVP

YouTube配信者と視聴者をつなぐ、スワイプ型マッチングサービスのMVPです。

## 入っているもの

- Next.js App Router
- PWA設定
- スワイプUI
- 配信者側の掲載申込
- 運営管理画面
- 管理画面からの直接掲載、初期スカウト登録
- 表示/非表示切り替え
- 有料掲載の公式バッジ
- 詳細ページとYouTube埋め込み
- いいね、インプレッション計測
- YouTube最新動画同期
- ヘルプページ
- Stripe Checkout連携
- Firebase未設定でも動くローカルJSONフォールバック

## 起動

PowerShellでnpmが止まる場合は、`npm.cmd` を使います。

```bash
npm.cmd install
npm.cmd run dev
```

ブラウザで `http://localhost:3000` を開きます。

## 主なURL

- `/`: スワイプ画面
- `/apply`: 配信者向け掲載申込
- `/creator`: 配信者用ページ
- `/checkout`: 有料プラン決済
- `/detail/[id]`: プロフィール詳細
- `/terms`: ヘルプ
- `/admin`: 運営管理画面

## プラン

- `free`: 無料掲載
- `paid`: 有料掲載 月額500円、公式バッジ付き
- `boost`: さらに上位表示 月額980円、公式バッジ付き

初期スカウト永年無料は申込画面には表示しません。管理画面で運営が直接登録します。

## 本番運用

本番では `.env.example` を参考に環境変数を設定します。特に次は必須です。

- `ADMIN_ACCESS_KEY`: 管理画面パスワード。本番では必ず変更
- `NEXT_PUBLIC_APP_URL`: 公開URL
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PAID`: 有料掲載 月額500円のPrice ID
- `STRIPE_PRICE_BOOST`: さらに上位表示 月額980円のPrice ID
- Firebase Admin系の値

テスト決済は本番では無効にします。

```env
ENABLE_TEST_PAYMENTS=false
NEXT_PUBLIC_ENABLE_TEST_PAYMENT=false
```

詳しい公開手順は [DEPLOYMENT.md](./DEPLOYMENT.md) を見てください。
