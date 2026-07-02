import { unstable_cache } from "next/cache";
import { FieldPath } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { findLocalStreamer } from "@/lib/localStore";

const cacheControl = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

export const runtime = "nodejs";

type CachedStreamerImage =
  | { type: "data"; mime: string; base64: string }
  | { type: "redirect"; url: string }
  | null;

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const index = clampIndex(new URL(request.url).searchParams.get("i"));
  const image = await readCachedStreamerImage(params.id, index);

  if (!image) {
    return new Response("not found", {
      status: 404,
      headers: { "Cache-Control": cacheControl },
    });
  }

  if (image.type === "redirect") {
    return new Response(null, {
      status: 302,
      headers: {
        Location: image.url,
        "Cache-Control": cacheControl,
      },
    });
  }

  return new Response(Buffer.from(image.base64, "base64"), {
    headers: {
      "Content-Type": image.mime,
      "Cache-Control": cacheControl,
    },
  });
}

const readCachedStreamerImage = unstable_cache(
  async (id: string, index: number): Promise<CachedStreamerImage> => {
    const db = getAdminDb();
    if (!db) {
      const streamer = await findLocalStreamer(id).catch(() => null);
      return parseImageValue(streamer?.thumbnails?.[index]);
    }

    const snapshot = await db.collection("streamers")
      .where(FieldPath.documentId(), "==", id)
      .select("thumbnails")
      .limit(1)
      .get();
    const doc = snapshot.docs[0];
    if (!doc.exists) return null;
    const thumbnails = doc.data()?.thumbnails;
    return parseImageValue(Array.isArray(thumbnails) ? thumbnails[index] : "");
  },
  ["streamer-image-v1"],
  { revalidate: 3600 },
);

function clampIndex(value: string | null) {
  const index = Number(value || 0);
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(2, Math.floor(index)));
}

function parseImageValue(value: unknown): CachedStreamerImage {
  const source = String(value || "").trim();
  if (!source) return null;
  if (/^https?:\/\//i.test(source)) return { type: "redirect", url: source };
  const match = source.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  return {
    type: "data",
    mime: match[1] || "image/jpeg",
    base64: match[2] || "",
  };
}
