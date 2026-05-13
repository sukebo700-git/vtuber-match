"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";

export function ProfileShareButton({ title, text }: { title: string; text: string }) {
  const [status, setStatus] = useState("");

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title, text, url }).catch(() => undefined);
      return;
    }

    await navigator.clipboard?.writeText(url).catch(() => undefined);
    setStatus("URLをコピーしました。");
  }

  return (
    <>
      <button className="secondary-button" type="button" onClick={share}>
        <Share2 size={18} />
        共有
      </button>
      {status && <p className="help-text">{status}</p>}
    </>
  );
}
