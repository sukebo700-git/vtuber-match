import { NextResponse } from "next/server";
import { notifyAdminRevisionReady } from "@/lib/notifications";

// kirinuki(切り抜き制作、apply.vtubermatch.com)から、依頼者の希望で演出を
// 作り直した版が完成した直後にサーバー間で叩かれる。認証は
// admin-notify/clip-request と同じ x-admin-key 専用の鍵
// (KIRINUKI_ADMIN_NOTIFY_KEY)のみ。まだ依頼者へは渡していない段階の通知で、
// 管理者が内容を確認してから送るかどうかを判断する(自動で依頼者へは送らない)。
export async function POST(request: Request) {
  const expected = process.env.KIRINUKI_ADMIN_NOTIFY_KEY || "";
  const provided = request.headers.get("x-admin-key") || "";
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const streamer = String(body.streamer || "").slice(0, 100);
  const clipTitle = String(body.clip_title || "").slice(0, 60);
  if (!clipTitle) return NextResponse.json({ error: "clip_title is required" }, { status: 400 });

  await notifyAdminRevisionReady({ streamer, clipTitle }).catch((error) => {
    console.error("Failed to notify admin about revision ready", error);
  });

  return NextResponse.json({ ok: true });
}
