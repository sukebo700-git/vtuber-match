# VtuberMatch Code Review Request

このリポジトリは VtuberMatch という、視聴者とVtuber/配信者をマッチングする Next.js アプリです。
他AIまたはレビュアーに渡すときは、このファイルとソースコード一式をセットで確認してください。

## 依頼したいこと

致命的な不具合、登録導線の破綻、データ不整合、表示崩れ、セキュリティ上の危険、Vercel本番反映時に問題になりそうな箇所を優先して診断してください。
全面的な作り直しではなく、現在の仕様を保ちながら安全に直せる範囲の指摘をお願いします。

## 技術構成

- Next.js 14 App Router
- React 18
- TypeScript
- Firebase / Firestore / Firebase Admin
- Vercel deploy
- 画像は現在、登録フォームからBase64化して送信し、Firestore側に保存する実装が含まれています

## 特に重点的に見てほしい箇所

1. 配信者登録
   - `/creator/apply`
   - `components/ApplicationForm.tsx`
   - `app/api/applications/route.ts`
   - 同じメールアドレスで複数プロフィールが作られないか
   - 画像3枚登録時に容量・送信・Firestore制限で失敗しないか
   - エラー時にユーザーへ分かる文言が出るか

2. 視聴者登録・ログイン
   - `/viewer/register`
   - `/viewer/login`
   - `app/api/viewer-profile/route.ts`
   - `app/api/viewer-login/route.ts`
   - Firestoreに `undefined` が入らないか
   - 新規登録とログイン処理が混ざっていないか

3. 配信者ログイン・プロフィール修正
   - `/creator/login`
   - `/creator/edit`
   - `app/api/creator-login/route.ts`
   - `app/api/profile-edits/route.ts`
   - 登録時の画像がプロフィール詳細・修正画面に正しく表示されるか
   - 画像差し替え時に既存画像や3枚登録が壊れないか

4. スワイプ・詳細表示
   - `/swipe`
   - `/detail/[id]`
   - 画像が枠内に全体表示されるか
   - PC版カードサイズ、スマホ表示、画像拡大表示が破綻していないか
   - 名前の下の一言コメントが全プランで表示されるか

5. いいね・通知・視聴者導線
   - `app/api/likes/route.ts`
   - `app/api/viewer-activity/route.ts`
   - 視聴者から配信者への通常いいねが維持されているか
   - スーパーいいね購入・反映が維持されているか
   - 通知ON誘導が自然に表示されるか

6. 管理画面
   - `/admin`
   - `components/AdminDashboard.tsx`
   - 情報量が多すぎて操作しづらくないか
   - 退会申請、非表示、NEW表示、承認処理などの管理導線

7. OGP / X共有
   - `app/layout.tsx`
   - `lib/seo.ts`
   - `public/og-image-v2.png`
   - XにURLを貼った時に画像が出る設定になっているか

## 現在の重要仕様

- 新規登録から1か月間は配信者カード左上にNEW表示
- 配信者画像は3枚登録、複数選択ではなく3つの枠に1枚ずつ登録
- 画像は初期表示で必ず全体が見える
- 画像タップで全体拡大表示
- 無料プランもプロフィールとスワイプ画面に一言コメントを表示
- 無料プランの自己アピールは100文字まで
- 有料プランはスワイプ画面の名前付近にも一言を表示
- プロフィール詳細画面でもいいね可能
- 配信サイト埋め込みが再生不可の場合は、壊れて見せずに該当チャンネルへ遷移する導線を出す
- 退会申請はヘルプから遷移し、有料プラン解約を先に案内する
- データ削除は即時削除ではなく、実態は自動非表示・管理画面に退会申請表示

## ローカル確認コマンド

```powershell
Set-Location -LiteralPath "C:\Users\kk\Documents\Codex\2026-05-16\https-vtuber-match-vercel-app-top"
npm.cmd install
npm.cmd run build
npm.cmd run dev
```

## デプロイ確認コマンド

```powershell
Set-Location -LiteralPath "C:\Users\kk\Documents\Codex\2026-05-16\https-vtuber-match-vercel-app-top"
npm.cmd run build
npx.cmd vercel deploy --prod --force
```

## レビュー結果の希望形式

以下の形式で、重要度順に出してください。

```text
【重大度】
Critical / High / Medium / Low

【場所】
ファイル名、関数名、画面URL

【問題】
何が起きるか

【再現手順】
できるだけ具体的に

【原因】
コード上の原因

【修正案】
最小変更での修正案

【壊してはいけない仕様】
修正時に維持すべき既存挙動
```

## 注意

- `.env` や本番の秘密情報は共有しないでください。
- `node_modules`, `.next`, `.vercel`, `.git` は診断用zipに含めなくてよいです。
- 大規模リライト案より、現在の実装に安全に当てられる修正案を優先してください。
