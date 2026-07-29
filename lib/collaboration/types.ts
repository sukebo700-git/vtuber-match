// VTuberコラボお誘い機能の型定義。
// 既存Firestoreデータ(streamers等)がsnake_caseで統一されているため、
// このフィーチャーもcamelCaseではなくsnake_caseで統一する
// (2026-07-29 ユーザー承認。指示書原文はcamelCase指定だが、
//  streamersドキュメントへ追加するフィールドがcamelCaseだと同一ドキュメント内で
//  命名が混在し保守が破綻するため)。

export type CollaborationCategory =
  | "game"
  | "talk"
  | "music"
  | "variety"
  | "short_video"
  | "video_production"
  | "event"
  | "other";

export type CollaborationPreferredTiming =
  | "asap"
  | "within_1_month"
  | "within_3_months"
  | "discuss";

export type CollaborationDistributionPlatform =
  | "sender_youtube"
  | "receiver_youtube"
  | "both_youtube"
  | "twitch"
  | "tiktok"
  | "x_space"
  | "discuss"
  | "other";

export type CollaborationRequestStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "blocked";

export type CollaborationEmailStatus =
  | "pending"
  | "sent"
  | "failed"
  | "skipped_limit"
  | "skipped_disabled"
  | "skipped_no_email";

export type CollaborationPreferredContact = "x" | "discord" | "email";

export type CollaborationRequest = {
  id: string;
  sender_id: string;
  receiver_id: string;
  // 退会後も最低限の履歴表示ができるよう、作成時点の表示名だけをスナップショット保存する。
  // 画像URL・連絡先は複製しない(指示書17章)。
  sender_name_snapshot: string;
  receiver_name_snapshot: string;

  category: CollaborationCategory;
  project_title: string;
  preferred_timing: CollaborationPreferredTiming;
  distribution_platform: CollaborationDistributionPlatform;
  message: string;

  status: CollaborationRequestStatus;
  decline_reason?: string;

  overview_viewed: boolean;
  overview_viewed_at?: unknown;
  contact_released: boolean;

  created_at: unknown;
  updated_at: unknown;
  responded_at?: unknown;
  expires_at: unknown;

  request_email_status?: CollaborationEmailStatus;
  request_email_sent_at?: unknown;
  accepted_email_status?: CollaborationEmailStatus;
  accepted_email_sent_at?: unknown;
};

// collaboration_usage/{streamer_id}_{yyyymm}
export type CollaborationUsage = {
  streamer_id: string;
  year_month: string; // "202607" 形式・JST基準
  sent_count: number;
  created_at: unknown;
  updated_at: unknown;
};

// collaboration_pairs/{sender_id}_{receiver_id}
// 30日再申請制限+未回答判定の軽量ドキュメント。過去申請を複数読み込まないためのもの。
export type CollaborationPair = {
  sender_id: string;
  receiver_id: string;
  latest_request_id: string;
  latest_requested_at: unknown;
  // 期限切れは動的判定(定期バッチ禁止)のため、この2つを併せて見て
  // 「未回答が実在するか」を判定する(has_pending単独では期限切れ後もtrueのまま残るバグになる)。
  has_pending: boolean;
  latest_expires_at: unknown;
};

// collaboration_contacts/{streamer_id}
export type CollaborationContact = {
  streamer_id: string;
  preferred_contact: CollaborationPreferredContact;
  x_account?: string;
  discord_username?: string;
  contact_email?: string;
  updated_at: unknown;
};

// collaboration_blocks/{blocker_id}_{blocked_id}
export type CollaborationBlock = {
  blocker_id: string;
  blocked_id: string;
  created_at: unknown;
};

// collaboration_reports/{auto_id}
export type CollaborationReportStatus = "new" | "reviewing" | "resolved" | "rejected";

export type CollaborationReport = {
  id: string;
  reporter_id: string;
  target_user_id: string;
  request_id: string;
  reason: string;
  detail?: string;
  status: CollaborationReportStatus;
  created_at: unknown;
};
