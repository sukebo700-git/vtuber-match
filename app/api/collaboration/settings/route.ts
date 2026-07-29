import { NextResponse } from "next/server";
import { FieldValue, getAdminDb, stripUndefined } from "@/lib/firebaseAdmin";
import { isCollaborationEnabled } from "@/lib/collaboration/config";
import { resolveCollaborationStreamer } from "@/lib/collaboration/session";
import type { CollaborationContact, CollaborationPreferredContact } from "@/lib/collaboration/types";

export async function GET(request: Request) {
  if (!isCollaborationEnabled()) return NextResponse.json({ error: "not available" }, { status: 503 });

  const streamer = await resolveCollaborationStreamer(request);
  if (!streamer) return NextResponse.json({ error: "creator login required" }, { status: 401 });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "not available" }, { status: 503 });

  const contactDoc = await db.collection("collaboration_contacts").doc(streamer.id).get();
  const contact = contactDoc.exists ? (contactDoc.data() as CollaborationContact) : null;

  // 設定画面を実際に開いた時点で、デフォルトON周知バナーを既読化する(初回閲覧時だけ書き込む)。
  // /creator側のバナー表示チェック(GET /api/collaboration/summary)はここを呼ばないため、
  // バナーを見ただけでは既読にならない(設定画面を開いて初めて既読になる)。
  if (streamer.collaboration_enabled && !streamer.collaboration_default_on_notice_seen) {
    await db.collection("streamers").doc(streamer.id).set(
      { collaboration_default_on_notice_seen: true },
      { merge: true },
    );
  }

  return NextResponse.json({
    collaboration_enabled: streamer.collaboration_enabled,
    collaboration_email_enabled: streamer.collaboration_email_enabled,
    contact: contact
      ? {
        preferred_contact: contact.preferred_contact,
        x_account: contact.x_account || "",
        discord_username: contact.discord_username || "",
        contact_email: contact.contact_email || "",
      }
      : null,
    source: "firestore",
  });
}

export async function POST(request: Request) {
  if (!isCollaborationEnabled()) return NextResponse.json({ error: "not available" }, { status: 503 });

  const streamer = await resolveCollaborationStreamer(request);
  if (!streamer) return NextResponse.json({ error: "creator login required" }, { status: 401 });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "not available" }, { status: 503 });

  const body = await request.json().catch(() => ({} as Record<string, unknown>));

  const collaborationEnabled = body.collaboration_enabled === true;
  const collaborationEmailEnabled = body.collaboration_email_enabled !== false;

  const preferredContact = normalizePreferredContact(body.preferred_contact);
  const xAccount = normalizeXAccount(body.x_account);
  const discordUsername = clean(body.discord_username, 60);
  const contactEmail = clean(body.contact_email, 120).toLowerCase();
  const hasAnyContact = Boolean(xAccount || discordUsername || contactEmail);

  // 指示書5章: 最低1つの連絡先登録を必須にする。ただし「受付をOFFのまま連絡先も
  // 未入力で保存する」ことまでは禁止しない(受付ONにする時にだけ要求する)。
  if (collaborationEnabled && !hasAnyContact) {
    return NextResponse.json(
      { error: "コラボ受付をONにするには、連絡先を最低1つ登録してください。" },
      { status: 400 },
    );
  }

  await db.collection("streamers").doc(streamer.id).set(
    stripUndefined({
      collaboration_enabled: collaborationEnabled,
      collaboration_email_enabled: collaborationEmailEnabled,
      collaboration_contact_ready: hasAnyContact,
      // 設定を保存した=本人が画面を見て操作したということなので、周知バナーも既読化する。
      collaboration_default_on_notice_seen: true,
      updated_at: FieldValue.serverTimestamp(),
    }),
    { merge: true },
  );

  if (hasAnyContact) {
    await db.collection("collaboration_contacts").doc(streamer.id).set(
      stripUndefined({
        streamer_id: streamer.id,
        preferred_contact: preferredContact,
        x_account: xAccount || undefined,
        discord_username: discordUsername || undefined,
        contact_email: contactEmail || undefined,
        updated_at: FieldValue.serverTimestamp(),
      }),
      { merge: true },
    );
  }

  return NextResponse.json({ ok: true, source: "firestore" });
}

function normalizePreferredContact(value: unknown): CollaborationPreferredContact {
  return value === "discord" || value === "email" ? value : "x";
}

function clean(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

function normalizeXAccount(value: unknown) {
  const input = String(value || "").trim();
  if (!input) return "";
  return input.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "@").replace(/^([^@])/, "@$1").slice(0, 40);
}
