import { getAdminDb } from "@/lib/firebaseAdmin";
import { creatorSessionCookie, readUserSession } from "@/lib/userSession";
import type { PlanType, Streamer } from "@/lib/types";

export type CollaborationStreamer = {
  id: string;
  name: string;
  plan_type: PlanType;
  collaboration_enabled: boolean;
  collaboration_email_enabled: boolean;
  collaboration_contact_ready: boolean;
  // 2026-07-29決定: 新規登録者はcollaboration_enabled初期値ONのため、
  // 本人が気づけるよう/creatorに一度だけ周知バナーを出す。既存配信者は
  // フィールド自体を持たないため、以下は「持っていない(=false扱い)」で
  // 一致する。持っている=新規登録者かつ未確認、という意味になる。
  collaboration_default_on_notice_seen: boolean;
};

// コラボ機能における「現在の配信者」の解決はここに集約する。他の場所で解決しないこと。
//
// なぜ厳しくするか: セッションの streamer_id が空文字のことがあり(creator-login時に
// application.streamer_id || "" を入れている)、かつ本番データには同一人物の重複
// streamerドキュメントが過去に実際に発生した経緯がある。誤解決すると「他人の送信枠を
// 消費する」「他人の受信箱に配達される」「他人の連絡先が開示される」という、この機能
// で最悪の事故になる。
//
// 既存の /api/profile-edits はメールアドレスやapplication経由の間接解決を行うが、
// あちらは自分のプロフィール編集で被害が本人に閉じる。コラボは第三者に影響するため、
// ここではセッションのstreamer_idが直接ある場合のみを信頼し、間接解決は一切行わない。
export async function resolveCollaborationStreamer(request: Request): Promise<CollaborationStreamer | null> {
  const session = readUserSession<{ streamer_id?: string }>(request, creatorSessionCookie);
  const streamerId = String(session?.streamer_id || "").trim();
  if (!streamerId) return null;

  const db = getAdminDb();
  if (!db) return null;

  const doc = await db.collection("streamers").doc(streamerId).get();
  if (!doc.exists) return null;

  const data = doc.data() as Streamer;
  if (data.withdrawal_status === "requested" || data.is_deleted === true || data.is_visible === false) return null;

  return {
    id: doc.id,
    name: data.name || "",
    plan_type: data.plan_type || "free",
    collaboration_enabled: data.collaboration_enabled === true,
    collaboration_email_enabled: data.collaboration_email_enabled !== false,
    collaboration_contact_ready: data.collaboration_contact_ready === true,
    collaboration_default_on_notice_seen: data.collaboration_default_on_notice_seen === true,
  };
}

// /creator の周知バナーを出すべきか(2026-07-29決定: デフォルトONの新規登録者向け)。
// collaboration_enabledがtrueかつ未確認の場合のみtrue。既存配信者(フィールド無し)は
// collaboration_enabledがfalseになるため、このバナーは絶対に表示されない。
export function shouldShowCollaborationDefaultOnNotice(streamer: CollaborationStreamer): boolean {
  return streamer.collaboration_enabled && !streamer.collaboration_default_on_notice_seen;
}
