import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { notifyAdminClipRequest } from "@/lib/notifications";

// kirinuki(切り抜き依頼フォーム、apply.vtubermatch.com)から、依頼を受け付けた
// 直後にサーバー間で叩かれる。認証は x-admin-key ヘッダ(ADMIN_ACCESS_KEY)のみで、
// ブラウザからは想定していない。
export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({}));
  const plan = String(body.plan || "");
  const streamer = String(body.streamer || "").slice(0, 100);
  const clipTitle = String(body.clip_title || "").slice(0, 60);
  if (!clipTitle) return NextResponse.json({ error: "clip_title is required" }, { status: 400 });

  await notifyAdminClipRequest({ plan, streamer, clipTitle }).catch((error) => {
    console.error("Failed to notify admin about clip request", error);
  });

  return NextResponse.json({ ok: true });
}
