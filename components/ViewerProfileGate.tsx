"use client";

import { useEffect, useState } from "react";
import { ViewerProfileForm } from "@/components/ViewerProfileForm";
import { isXCampaignActive } from "@/lib/campaign";

const authKey = "vtuber-match-viewer-auth";

export function ViewerProfileGate() {
  const [checked, setChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(Boolean(localStorage.getItem(authKey)));
    setChecked(true);
  }, []);

  if (!checked) return null;

  if (!loggedIn && isXCampaignActive()) {
    return (
      <section className="status-band">
        <a href="/viewer/register?src=x_campaign">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/promo/x-campaign-gift.png"
            alt="Xキャンペーン: フォロー&amp;リポスト&amp;無料登録でAmazonギフトカード10,000円分が当たる"
            style={{ display: "block", width: "100%", height: "auto", borderRadius: 12 }}
          />
        </a>
      </section>
    );
  }

  if (!loggedIn) return null;

  return <ViewerProfileForm />;
}
