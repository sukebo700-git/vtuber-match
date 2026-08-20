import type { StreamerResumeFields } from "./resume/schema";

export type PlanType = "free" | "paid" | "boost";
export type StreamerPlanType = PlanType;
export type AdminPlacement = "top" | "normal" | "bottom";
export type ViewerPlanType = "free";
export type SuperBoostEffect = "shine" | "shake";
export type VtypeProfileFields = {
  vtype_id?: number;
  vtype_code?: string;
  vtype_name?: string;
  vtype_scores?: Partial<Record<string, number>>;
  vtype_mode?: "light" | "advanced" | "viewer" | string;
  vtype_result_id?: string;
  vtype_updated_at?: string;
};

export type Streamer = VtypeProfileFields & Partial<StreamerResumeFields> & {
  id: string;
  name: string;
  yomi?: string;
  creator_email?: string;
  youtube_url: string;
  youtube_channel_id?: string;
  archive_url?: string;
  x_account?: string;
  thumbnails: string[];
  categories: string[];
  tags: string[];
  description: string;
  one_liner: string;
  stream_time?: string;
  region?: string;
  latest_video_id?: string;
  last_video_date?: string;
  last_youtube_checked_at?: string;
  plan_type: PlanType;
  admin_placement?: AdminPlacement;
  is_initial_scout?: boolean;
  x_introduced_at?: string;
  is_dummy?: boolean;
  dummy_reason?: string;
  is_visible: boolean;
  withdrawal_status?: "none" | "requested";
  withdrawal_requested_at?: string;
  subscription_status?: "active" | "canceled";
  payment_state?: "active" | "past_due";
  stripe_subscription_id?: string;
  is_deleted?: boolean;
  deleted_at?: string;
  grant_source?: "admin" | "stripe";
  has_payment_history?: boolean;
  impressions: number;
  weekly_impressions?: Record<string, number>;
  likes: number;
  /** @deprecated Legacy permanent boost counter. Ranking now uses elite_boost_days. */
  viewer_like_boosts?: number;
  elite_boost_days?: Record<string, number>;
  super_boost_count?: number;
  super_boost_until?: string;
  super_boost_effect?: SuperBoostEffect;
  fcm_tokens?: string[];
  notification_enabled?: boolean;
  last_creator_login_at?: string;
  creator_login_count?: number;
  resume_generated_count?: number;
  resume_last_generated_at?: string;
  registered_at?: string;
  createdAt?: string;
  registeredAt?: string;
  created_at?: string;
  updated_at?: string;
  source_application_id?: string;
  /** コラボお誘い機能: 本人が明示的にONにした場合のみ申請を受け付ける。初期値false */
  collaboration_enabled?: boolean;
  /** コラボお誘い機能: メール補助通知のON/OFF。初期値true(未設定時はtrue扱い) */
  collaboration_email_enabled?: boolean;
  /** コラボお誘い機能: 非公開連絡先(collaboration_contactsコレクション)を1つ以上登録済みか */
  collaboration_contact_ready?: boolean;
  /** コラボお誘い機能: デフォルトON周知バナーを確認済みか(新規登録者のみ持つフィールド) */
  collaboration_default_on_notice_seen?: boolean;
  promo_video_id?: string;
};

export type ApplicationStatus = "pending" | "approved" | "rejected";
export type StreamerClaimStatus = "pending" | "approved" | "rejected";

export type StreamerApplication = VtypeProfileFields & {
  id: string;
  name: string;
  yomi?: string;
  email: string;
  youtube_url: string;
  youtube_channel_id?: string;
  x_account?: string;
  thumbnails: string[];
  categories: string[];
  tags: string[];
  description: string;
  one_liner: string;
  stream_time?: string;
  region?: string;
  desired_plan: PlanType;
  payment_status?: "not_required" | "pending" | "paid";
  status: ApplicationStatus;
  admin_note?: string;
  created_at?: string;
  reviewed_at?: string;
  paid_at?: string;
  subscription_status?: "active" | "canceled";
  payment_state?: "active" | "past_due";
  stripe_subscription_id?: string;
  withdrawal_status?: "none" | "requested";
  withdrawal_requested_at?: string;
  streamer_id?: string;
  creator_login_id?: string;
  creator_password_hash?: string;
  creator_auth_provider?: "password" | "google";
  claim_status?: StreamerClaimStatus;
  claim_target_streamer_id?: string;
  claim_verification_code?: string;
  claim_x_account?: string;
  claim_requested_at?: string;
  claim_expires_at?: string;
  claim_verified_at?: string;
  registration_source?: string;
  x_campaign_entry?: boolean;
  x_campaign_entered_at?: string;
};

export type PaymentRecord = {
  id: string;
  application_id?: string;
  streamer_id?: string;
  viewer_id?: string;
  plan_type: "paid" | "boost" | "super_boost_1";
  amount: number;
  status: "paid";
  payer_email: string;
  billing_mode?: "test" | "subscription";
  provider_subscription_id?: string;
  created_at: string;
};

export type ViewerProfile = VtypeProfileFields & {
  id: string;
  anonymous_viewer_id?: string;
  email?: string;
  viewer_login_id?: string;
  viewer_password_hash?: string;
  auth_provider?: "password" | "google";
  viewer_plan?: ViewerPlanType;
  subscription_status?: "active" | "canceled";
  payment_state?: "active" | "past_due";
  stripe_subscription_id?: string;
  grant_source?: "admin" | "stripe";
  display_name?: string;
  youtube_display_name?: string;
  twitter_id?: string;
  registration_source?: string;
  x_campaign_entry?: boolean;
  x_campaign_entered_at?: string;
  one_liner?: string;
  image?: string;
  profile?: string;
  favorite_categories?: string[];
  visible_to_matched_streamers: boolean;
  is_deleted?: boolean;
  deleted_at?: string;
  match_count?: number;
  streamer_like_count?: number;
  daily_like_count?: number;
  daily_like_date?: string;
  super_like_stock?: number;
  super_like_purchase_count?: number;
  has_paid_history?: boolean;
  fcm_tokens?: string[];
  notification_enabled?: boolean;
  is_admin_viewer?: boolean;
  last_viewer_activity_at?: string;
  last_viewer_login_at?: string;
  created_at?: string;
  updated_at?: string;
};

export type EmbeddedViewerProfile = Partial<ViewerProfile> & {
  id?: string;
  is_anonymous?: boolean;
  source_type?: "viewer" | "creator";
  creator_streamer_id?: string;
  creator_name?: string;
};

export type ViewerActivityType = "view" | "like";

export type ViewerActivity = {
  id: string;
  streamer_id: string;
  viewer_profile_id: string;
  user_id?: string;
  action: ViewerActivityType;
  viewer_profile?: EmbeddedViewerProfile;
  created_at?: string;
  updated_at?: string;
};

export type ViewerProfileWithStats = ViewerProfile & {
  match_count: number;
  streamer_like_count: number;
  fan_level: "starter" | "active" | "super";
};

export type StreamerProfileEdit = {
  id: string;
  application_id?: string;
  streamer_id?: string;
  email: string;
  youtube_url: string;
  name?: string;
  image?: string;
  description?: string;
  one_liner?: string;
  stream_time?: string;
  categories?: string[];
  tags?: string[];
  status: "pending" | "reviewed";
  created_at?: string;
};

export type LikePayload = {
  user_id: string;
  streamer_id: string;
  viewer_profile_id?: string;
  viewer_profile?: Partial<ViewerProfile>;
};

export type StreamerReport = {
  id: string;
  report_type?: "streamer" | "viewer";
  streamer_id: string;
  streamer_name?: string;
  viewer_profile_id?: string;
  viewer_name?: string;
  reason: string;
  detail?: string;
  reporter_contact?: string;
  status: "open" | "reviewed";
  created_at?: string;
};

export type PasswordResetRequest = {
  id: string;
  user_type: "creator" | "viewer";
  email: string;
  name?: string;
  application_id?: string;
  streamer_id?: string;
  viewer_id?: string;
  note?: string;
  status: "open" | "completed";
  created_at?: string;
  completed_at?: string;
  resolved_via?: "admin" | "self";
  // セルフサービス(メールリンク)リセット用。token_hashはトークンのSHA-256、
  // 平文トークンは保存しない。使用済み/期限切れ後はconfirm APIがtoken_hashを
  // 消して再利用不可にする。
  token_hash?: string;
  token_expires_at?: string;
};
