# Firestoreインデックス

通知受信箱は `notifications` コレクションを次の条件で検索します。

- 配信者: `target_type == "streamer"` + `streamer_id == 自分のID` + `orderBy("created_at", "desc")`
- 視聴者: `target_type == "viewer"` + `viewer_profile_id == 自分のID` + `orderBy("created_at", "desc")`

本番で初回アクセス時にFirestoreの複合インデックス不足エラーが出た場合は、Vercelログに表示されるFirebase ConsoleのURLを開き、そのままインデックスを作成してください。
