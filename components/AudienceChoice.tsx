"use client";

import { useEffect, useState } from "react";
import { AUDIENCE_EVENT, readAudience, setAudience, type Audience } from "@/lib/audience";

// TOPページのヒーロー直下に出す「視聴者の方/VTuberの方」の2択。
// 既にログイン中(または過去に選択済み)なら判定できるので表示しない。
export function AudienceChoice() {
  const [audience, setCurrent] = useState<Audience | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    function refresh() {
      setCurrent(readAudience());
      setChecked(true);
    }
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(AUDIENCE_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(AUDIENCE_EVENT, refresh);
    };
  }, []);

  if (!checked || audience) return null;

  return (
    <div className="landing-audience-choice" aria-label="ご利用の目的を選択してください">
      <button type="button" className="landing-audience-card" onClick={() => setAudience("viewer")}>
        <strong>視聴者の方</strong>
        <span>推しのVTuberを探す</span>
      </button>
      <button type="button" className="landing-audience-card" onClick={() => setAudience("creator")}>
        <strong>VTuberの方</strong>
        <span>掲載・切り抜き動画</span>
      </button>
    </div>
  );
}
