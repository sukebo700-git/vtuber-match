"use client";

import { useEffect, useState } from "react";
import { ViewerProfileForm } from "@/components/ViewerProfileForm";

const authKey = "vtuber-match-viewer-auth";

export function ViewerProfileGate() {
  const [checked, setChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(Boolean(localStorage.getItem(authKey)));
    setChecked(true);
  }, []);

  if (!checked) return null;

  if (!loggedIn) {
    return (
      <section className="status-band">
        <h2>無料登録でプロフィールを保存できます</h2>
        <p>プロフィールや画像、スーパーいいね履歴は無料登録後に利用できます。</p>
        <p style={{ marginTop: 12 }}>
          <a className="primary-button" href="/viewer/register">無料登録する</a>
        </p>
      </section>
    );
  }

  return <ViewerProfileForm />;
}
