"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";

export function CreatorSuperBoostNotice() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const raw = localStorage.getItem("vtuber-match-creator-super-boost-notice");
    const next = Number(raw || 0);
    if (next > 0) setCount(next);
  }, []);

  if (!count) return null;

  return (
    <div className="like-choice-backdrop" role="dialog" aria-modal="true">
      <div className="like-choice-modal">
        <div className="like-choice-icon"><Star size={28} fill="currentColor" /></div>
        <h2>視聴者さんからスーパーいいねが届きました！</h2>
        <p>あなたのプロフィールが一定期間、より見つけてもらいやすくなっています。</p>
        <button
          className="primary-button"
          type="button"
          onClick={() => {
            localStorage.removeItem("vtuber-match-creator-super-boost-notice");
            setCount(0);
          }}
        >
          確認しました
        </button>
      </div>
    </div>
  );
}
