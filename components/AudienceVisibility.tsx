"use client";

import { useEffect, useState } from "react";
import { AUDIENCE_EVENT, readAudience, type Audience } from "@/lib/audience";

type AudienceVisibilityProps = {
  audience: Audience;
  children: React.ReactNode;
};

// AuthVisibility(ログイン状態での出し分け)と同じ考え方で、
// TOPページのセクションを「視聴者向け/VTuber向け」で出し分ける。
export function AudienceVisibility({ audience, children }: AudienceVisibilityProps) {
  const [current, setCurrent] = useState<Audience | null>(null);

  useEffect(() => {
    function refresh() {
      setCurrent(readAudience());
    }
    refresh();
    window.addEventListener(AUDIENCE_EVENT, refresh);
    return () => {
      window.removeEventListener(AUDIENCE_EVENT, refresh);
    };
  }, []);

  if (current !== audience) return null;
  return <>{children}</>;
}
