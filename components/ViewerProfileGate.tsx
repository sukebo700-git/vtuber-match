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
        <h2>プロフィール登録にはログインが必要です</h2>
        <p>スワイプ画面はログインなしで利用できます。プロフィール登録、画像登録、YouTube表示名、マッチ数の表示はログイン後に使えます。</p>
        <p style={{ marginTop: 12 }}>
          <a className="primary-button" href="/viewer/login">視聴者ログインへ</a>
        </p>
      </section>
    );
  }

  return <ViewerProfileForm />;
}
