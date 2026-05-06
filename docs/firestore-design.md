# Firestore設計

## streamers

配信者の表示、詳細、順位計算、数値確認に使うメインコレクション。

| field | type | note |
| --- | --- | --- |
| name | string | 必須 |
| youtube_url | string | 必須 |
| youtube_channel_id | string | YouTube Data API用 |
| thumbnails | string[] | 最大3枚。申込画面でアップロードした画像を保存 |
| categories | string[] | 複数選択 |
| tags | string[] | 最大5個 |
| description | string | プロフィール画面に表示する自己アピール |
| one_liner | string | スワイプカード表示 |
| stream_time | string | 詳細表示 |
| latest_video_id | string | 最新アーカイブ埋め込み |
| last_video_date | timestamp/string | 30日更新判定 |
| last_youtube_checked_at | timestamp | 自動取得の最終確認 |
| plan_type | string | free / paid / boost |
| is_initial_scout | boolean | 初期スカウト永年無料flag。管理画面でのみ設定 |
| is_visible | boolean | falseならスワイプ一覧に出さない |
| impressions | number | 表示回数 |
| likes | number | いいね数 |
| fcm_tokens | string[] | 配信者通知用 |
| created_at | timestamp | 登録日 |

## applications

配信者側の掲載申し込み。連絡先メールは管理画面だけで確認し、公開ページには表示しない。

| field | type | note |
| --- | --- | --- |
| name | string | 配信者名 |
| email | string | 非公開の連絡先 |
| youtube_url | string | YouTube URL |
| youtube_channel_id | string | 最新動画取得用 |
| thumbnails | string[] | 最大3枚 |
| categories | string[] | 複数選択 |
| tags | string[] | 最大5個 |
| description | string | プロフィール画面に表示する自己アピール |
| one_liner | string | スワイプカード表示 |
| stream_time | string | 配信時間帯 |
| desired_plan | string | free / paid / boost |
| payment_status | string | not_required / pending / paid |
| status | string | pending / approved / rejected |
| admin_note | string | 運営メモ |
| created_at | timestamp | 申込日 |
| reviewed_at | timestamp | 審査日 |

## users

| field | type | note |
| --- | --- | --- |
| type | string | viewer / streamer |
| streamer_id | string | 配信者アカウントの場合 |
| fcm_token | string | PWA通知用 |

## likes

片側いいねで即マッチ。

| field | type | note |
| --- | --- | --- |
| user_id | string | Auth uidまたは匿名uid |
| streamer_id | string | streamers id |
| timestamp | timestamp | いいね日時 |

## payments

MVP用の決済記録。実決済ではStripeなどの決済代行に置き換える。

| field | type | note |
| --- | --- | --- |
| application_id | string | applications id |
| plan_type | string | paid / boost |
| amount | number | 500 / 980 |
| payer_email | string | 支払い連絡先 |
| status | string | paid |
| created_at | timestamp | 決済日時 |

## 表示順位

`lib/ranking.ts` で次の順にスコア化する。

1. さらに上位表示 980円
2. 有料掲載 500円
3. 無料掲載
4. 30日以内更新は加点
5. 30日以上更新なしは減点
