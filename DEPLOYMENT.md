# Vtuberマッチ 本番公開手順

## 1. 環境変数

`.env.example` を参考に、公開先の環境変数を設定します。

- `ADMIN_ACCESS_KEY`: 管理画面用パスワード。本番では `kiya0110` から必ず変更します。
- `NEXT_PUBLIC_APP_URL`: 公開URL。例: `https://example.com`
- `ENABLE_TEST_PAYMENTS`: 本番は `false`
- `NEXT_PUBLIC_ENABLE_TEST_PAYMENT`: 本番は `false`
- `STRIPE_SECRET_KEY`: Stripeのシークレットキー
- `STRIPE_WEBHOOK_SECRET`: Stripe Webhookの署名シークレット
- `STRIPE_PRICE_PAID`: 有料掲載500円のPrice ID
- `STRIPE_PRICE_BOOST`: さらに上位表示980円のPrice ID
- Firebase Admin系: Firestore更新、管理画面、決済反映に必要
- YouTube API key: 最新動画取得に必要

## 2. Stripe設定

Stripeで500円と980円の月額継続課金Priceを作成し、Webhook送信先を次に設定します。

`https://公開URL/api/stripe/webhook`

受け取るイベントは次の2つです。

- `checkout.session.completed`
- `customer.subscription.deleted`

## 3. Firebase設定

Firestore、Auth、Cloud Messaging、Functionsを有効化します。Firestore rulesとindexesを反映します。

```bash
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only functions
```

## 4. Next.js公開

```bash
npm run build
npm run start
```

Vercelなどへ出す場合は、同じ環境変数を管理画面で設定します。

## 5. 公開前チェック

- `/` でスワイプ画面が表示される
- `/apply` で無料掲載、有料掲載、さらに上位表示の申込ができる
- 有料プラン申込後にStripe決済画面へ進む
- 決済完了後、管理画面の申込が `決済済み` になる
- `/terms` 下部から管理画面に入り、申込承認と表示/非表示変更ができる
- 管理APIにパスワードなしでアクセスできない
