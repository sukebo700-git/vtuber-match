import { NextResponse } from "next/server";
import { userSessionCookieOptions } from "@/lib/userSession";

// 一時的な調査用エンドポイント。本番でCookieのdomain属性が実際に
// 付いているか確認するためだけのもの。確認後すぐ消す。
export async function GET() {
  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    opts: userSessionCookieOptions(),
  });
}
