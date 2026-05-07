import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { deleteLocalViewerProfile } from "@/lib/localStore";

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const db = getAdminDb();
  if (!db) {
    const deleted = await deleteLocalViewerProfile(id);
    if (!deleted) return NextResponse.json({ error: "viewer not found" }, { status: 404 });
    return NextResponse.json({ deleted: true, source: "local" });
  }

  await db.collection("viewer_profiles").doc(id).delete();
  return NextResponse.json({ deleted: true, source: "firestore" });
}
