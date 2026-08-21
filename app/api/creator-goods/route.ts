import { NextResponse } from "next/server";
import { FieldValue, getAdminDb, stripUndefined } from "@/lib/firebaseAdmin";
import { creatorSessionCookie, readUserSession } from "@/lib/userSession";
import { invalidateGoodsCache, vtuberGoodsCollection } from "@/lib/vtuberGoods";

// グッズ枠はプレミアム(boost)プラン限定。掲載資格と本人確認は必ずサーバー側で行う。
const maxImagePayload = 200_000;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = readUserSession<{ streamer_id?: string }>(request, creatorSessionCookie);
  const streamerId = session?.streamer_id;
  if (!streamerId) return NextResponse.json({ error: "creator login required" }, { status: 401 });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  const [streamerDoc, goodsDoc] = await Promise.all([
    db.collection("streamers").doc(streamerId).get(),
    db.collection(vtuberGoodsCollection).doc(streamerId).get(),
  ]);

  const streamer = streamerDoc.data() || {};
  const goods = goodsDoc.exists ? goodsDoc.data() || {} : null;

  return NextResponse.json({
    eligible: isEligible(streamer),
    plan_type: String(streamer.plan_type || "free"),
    goods: goods
      ? {
          title: String(goods.title || ""),
          url: String(goods.url || ""),
          description: String(goods.description || ""),
          image: String(goods.image || ""),
          status: String(goods.status || "pending"),
          admin_note: String(goods.admin_note || ""),
        }
      : null,
  });
}

export async function POST(request: Request) {
  const session = readUserSession<{ streamer_id?: string }>(request, creatorSessionCookie);
  const streamerId = session?.streamer_id;
  if (!streamerId) return NextResponse.json({ error: "creator login required" }, { status: 401 });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "登録内容を読み取れませんでした。画像が大きすぎる可能性があります。" }, { status: 400 });
  }

  const streamerDoc = await db.collection("streamers").doc(streamerId).get();
  const streamer = streamerDoc.data();
  if (!streamer) return NextResponse.json({ error: "streamer not found" }, { status: 404 });
  if (!isEligible(streamer)) {
    return NextResponse.json({
      error: "グッズ掲載はプレミアムプランの特典です。プランをご確認ください。",
      code: "PLAN_REQUIRED",
    }, { status: 403 });
  }

  const title = String(body.title || "").trim().slice(0, 80);
  const url = String(body.url || "").trim();
  const description = String(body.description || "").trim().slice(0, 100);
  const image = String(body.image || "").trim();

  if (!title) return NextResponse.json({ error: "グッズ名を入力してください。" }, { status: 400 });
  // 中間リダイレクトを挟まず直接遷移させるため、httpsの完全URLのみ許可する
  if (!/^https:\/\//i.test(url)) {
    return NextResponse.json({ error: "購入先URLは https:// から始まるURLを入力してください。" }, { status: 400 });
  }
  if (!image) return NextResponse.json({ error: "グッズ画像を登録してください。" }, { status: 400 });
  if (image.length > maxImagePayload) {
    return NextResponse.json({ error: "画像容量が大きすぎます。もう少し小さい画像でお試しください。" }, { status: 413 });
  }

  const ref = db.collection(vtuberGoodsCollection).doc(streamerId);
  const existing = await ref.get();

  // 内容を変更したら必ず再審査になる(承認済みのまま差し替えられないようにする)
  await ref.set(stripUndefined({
    streamer_id: streamerId,
    streamer_name: String(streamer.name || ""),
    title,
    url,
    description,
    image,
    status: "pending",
    admin_note: "",
    ...(existing.exists ? {} : { created_at: FieldValue.serverTimestamp() }),
    updated_at: FieldValue.serverTimestamp(),
  }), { merge: true });

  invalidateGoodsCache();

  return NextResponse.json({ ok: true, status: "pending" });
}

function isEligible(streamer: FirebaseFirestore.DocumentData) {
  return streamer.plan_type === "boost" &&
    streamer.is_deleted !== true &&
    streamer.withdrawal_status !== "requested";
}
