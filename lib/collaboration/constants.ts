import type {
  CollaborationCategory,
  CollaborationDistributionPlatform,
  CollaborationPreferredTiming,
} from "./types";
import type { PlanType } from "@/lib/types";

// 指示書2.1・36章: 上限値はドキュメントに固定保存せず、送信時の現在プランから毎回判定する。
// このリポジトリのPlanTypeは "free" | "paid" | "boost"(指示書のbasic/premiumに相当)。
export function getCollaborationMonthlyLimit(plan: PlanType): number {
  return plan === "free" ? 3 : 10;
}

export const COLLABORATION_RESPONSE_DEADLINE_DAYS = 7;
export const COLLABORATION_REAPPLY_COOLDOWN_DAYS = 30;
export const COLLABORATION_CANCEL_WINDOW_HOURS = 24;

export const COLLABORATION_PROJECT_TITLE_MIN = 2;
export const COLLABORATION_PROJECT_TITLE_MAX = 50;
export const COLLABORATION_MESSAGE_MIN = 20;
export const COLLABORATION_MESSAGE_MAX = 200;
export const COLLABORATION_MESSAGE_MAX_URLS = 1;

export const COLLABORATION_CATEGORY_LABELS: Record<CollaborationCategory, string> = {
  game: "ゲーム配信",
  talk: "雑談配信",
  music: "歌・音楽",
  variety: "企画・バラエティ",
  short_video: "ショート動画",
  video_production: "動画制作",
  event: "イベント参加",
  other: "その他",
};

export const COLLABORATION_TIMING_LABELS: Record<CollaborationPreferredTiming, string> = {
  asap: "できるだけ早く",
  within_1_month: "1か月以内",
  within_3_months: "2〜3か月以内",
  discuss: "時期は相談して決めたい",
};

export const COLLABORATION_PLATFORM_LABELS: Record<CollaborationDistributionPlatform, string> = {
  sender_youtube: "自分のYouTube",
  receiver_youtube: "相手のYouTube",
  both_youtube: "双方のYouTube",
  twitch: "Twitch",
  tiktok: "TikTok",
  x_space: "Xスペース",
  discuss: "相談して決めたい",
  other: "その他",
};

// 指示書21章: 辞退理由は任意・送信者へは非公開。選択肢の表示にのみ使う。
export const COLLABORATION_DECLINE_REASONS = [
  "スケジュールが合わない",
  "現在コラボを募集していない",
  "内容が活動方針と合わない",
  "連絡先交換を希望しない",
  "その他",
  "理由を選択しない",
] as const;

// 指示書24章
export const COLLABORATION_REPORT_REASONS = [
  "迷惑な勧誘",
  "性的または不適切な内容",
  "誹謗中傷",
  "金銭要求",
  "投資・副業・情報商材",
  "なりすまし",
  "外部サービスへの強引な誘導",
  "その他",
] as const;

// 指示書12章/32章: 「無視された」「拒否された」「既読」は使用しない。文言はここに集約する。
export const COLLABORATION_STATUS_LABELS = {
  unviewed: "まだ確認されていません",
  viewed: "お誘いが確認されました",
  accepted: "承諾されました",
  declined: "今回は見送りとなりました",
  expired: "回答期限が終了しました",
  cancelled: "お誘いを取り消しました",
  blocked: "このお誘いは終了しました",
} as const;
