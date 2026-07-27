"use client";

import { useEffect, useState } from "react";
import { isXCampaignActive } from "@/lib/campaign";

// TOPページのXキャンペーンバナーは視聴者向け登録に固定誘導するため、
// 配信者としてキャンペーンに応募したい未ログインの人向けに、
// 配信者新規登録(?src=x_campaign)への小さな導線リンクを別途用意する。
export function XCampaignCreatorEntryLink() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!isXCampaignActive()) setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <p className="help-text" style={{ textAlign: "center", marginTop: 8 }}>
      配信者としてXキャンペーンに応募する方は<a href="/creator/apply?src=x_campaign">こちら</a>
    </p>
  );
}
