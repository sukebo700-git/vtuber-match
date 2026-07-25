"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { isXCampaignActive } from "@/lib/campaign";

// ログイン状態に応じて遷移先を出し分けるリンク。
// - creator-promo(無料で宣伝を申し込む等): 配信者ログイン中は/creator(マイページ)へ、
//   それ以外(未ログイン・視聴者ログイン中)は/creator/apply(配信者新規登録)へ。
// - x-campaign(Xキャンペーンに応募する): 配信者ログイン中は/creator、
//   視聴者ログイン中は/viewer、未ログインは/viewer/register(視聴者新規登録)へ。
type SmartPromoLinkKind = "creator-promo" | "x-campaign";

function readLoginKind(): "creator" | "viewer" | null {
  if (typeof window === "undefined") return null;
  const hasCreator = Boolean(
    localStorage.getItem("vtuber-match-creator-id") ||
      localStorage.getItem("vtuber-match-creator-login-id") ||
      localStorage.getItem("vtuber-match-creator-email"),
  );
  if (hasCreator) return "creator";
  const hasViewer = Boolean(
    localStorage.getItem("vtuber-match-viewer-id") || localStorage.getItem("vtuber-match-viewer-email"),
  );
  if (hasViewer) return "viewer";
  return null;
}

function resolveHref(kind: SmartPromoLinkKind, loginKind: "creator" | "viewer" | null): string {
  if (loginKind === "creator") return "/creator";
  if (kind === "x-campaign" && loginKind === "viewer") return "/viewer";
  if (kind === "creator-promo") return "/creator/apply";
  // Xキャンペーン経由での新規登録を後で識別できるよう、遷移先にsrcを付与する
  // (ViewerLoginFormがこのクエリパラメータを読み取りregistration_sourceとして保存する)。
  return "/viewer/register?src=x_campaign";
}

export function SmartPromoLink({
  kind,
  className,
  children,
}: {
  kind: SmartPromoLinkKind;
  className?: string;
  children: ReactNode;
}) {
  const [href, setHref] = useState(() => (kind === "creator-promo" ? "/creator/apply" : "/viewer/register?src=x_campaign"));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setHref(resolveHref(kind, readLoginKind()));
    if (kind === "x-campaign" && !isXCampaignActive()) setVisible(false);
  }, [kind]);

  if (kind === "x-campaign" && !visible) return null;

  return (
    <a className={className} href={href}>
      {children}
    </a>
  );
}
