import { unstable_cache } from "next/cache";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { vtuberGoodsCollection } from "@/lib/vtuberGoods";

// グッズ画像はFirestoreにbase64で持つが、スワイプのpayloadに載せると重いので
// streamer-image と同じくキャッシュ付きのAPI経由で配信する。
const cacheControl = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

export const runtime = "nodejs";

type CachedGoodsImage =
  | { type: "data"; mime: string; base64: string }
  | { type: "redirect"; url: string }
  | null;

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const version = String(new URL(request.url).searchParams.get("v") || "unversioned").slice(0, 120);
  const image = await readCachedGoodsImage(params.id, version);

  if (!image) {
    return new Response("not found", {
      status: 404,
      headers: { "Cache-Control": cacheControl },
    });
  }

  if (image.type === "redirect") {
    return new Response(null, {
      status: 302,
      headers: { Location: image.url, "Cache-Control": cacheControl },
    });
  }

  return new Response(Buffer.from(image.base64, "base64"), {
    headers: { "Content-Type": image.mime, "Cache-Control": cacheControl },
  });
}

const readCachedGoodsImage = unstable_cache(
  async (id: string, _version: string): Promise<CachedGoodsImage> => {
    const db = getAdminDb();
    if (!db) return null;

    const doc = await db.collection(vtuberGoodsCollection).doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data() || {};
    // 未承認・却下のグッズ画像は配信しない
    if (data.status !== "approved") return null;
    return parseImageValue(data.image);
  },
  ["goods-image-v1"],
  { revalidate: 3600 },
);

function parseImageValue(value: unknown): CachedGoodsImage {
  const source = String(value || "").trim();
  if (!source) return null;
  if (/^https:\/\//i.test(source)) return { type: "redirect", url: source };
  const match = source.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  return {
    type: "data",
    mime: match[1] || "image/jpeg",
    base64: match[2] || "",
  };
}
