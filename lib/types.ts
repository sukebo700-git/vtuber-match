export type PlanType = "free" | "paid" | "boost";
export type ViewerPlanType = "free" | "viewer_paid";

export type Streamer = {
  id: string;
  name: string;
  youtube_url: string;
  youtube_channel_id?: string;
  thumbnails: string[];
  categories: string[];
  tags: string[];
  description: string;
  one_liner: string;
  stream_time?: string;
  latest_video_id?: string;
  last_video_date?: string;
  last_youtube_checked_at?: string;
  plan_type: PlanType;
  is_initial_scout?: boolean;
  is_visible: boolean;
  impressions: number;
  likes: number;
  created_at?: string;
  source_application_id?: string;
};

export type ApplicationStatus = "pending" | "approved" | "rejected";

export type StreamerApplication = {
  id: string;
  name: string;
  email: string;
  youtube_url: string;
  youtube_channel_id?: string;
  thumbnails: string[];
  categories: string[];
  tags: string[];
  description: string;
  one_liner: string;
  stream_time?: string;
  desired_plan: PlanType;
  payment_status?: "not_required" | "pending" | "paid";
  status: ApplicationStatus;
  admin_note?: string;
  created_at?: string;
  reviewed_at?: string;
  paid_at?: string;
  subscription_status?: "active" | "canceled";
  stripe_subscription_id?: string;
  streamer_id?: string;
  creator_login_id?: string;
  creator_password_hash?: string;
};

export type PaymentRecord = {
  id: string;
  application_id?: string;
  streamer_id?: string;
  viewer_id?: string;
  plan_type: "paid" | "boost" | "viewer_paid";
  amount: number;
  status: "paid";
  payer_email: string;
  billing_mode?: "test" | "subscription";
  provider_subscription_id?: string;
  created_at: string;
};

export type ViewerProfile = {
  id: string;
  email?: string;
  viewer_login_id?: string;
  viewer_password_hash?: string;
  viewer_plan?: ViewerPlanType;
  subscription_status?: "active" | "canceled";
  stripe_subscription_id?: string;
  display_name?: string;
  youtube_display_name?: string;
  twitter_id?: string;
  one_liner?: string;
  image?: string;
  profile?: string;
  favorite_categories?: string[];
  visible_to_matched_streamers: boolean;
  match_count?: number;
  streamer_like_count?: number;
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
};
