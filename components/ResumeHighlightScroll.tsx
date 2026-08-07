"use client";

import { useEffect } from "react";

/** #resume-card へ画面遷移直後にスクロールする(Next.jsのApp RouterはsearchParams付き遷移時に
 * ハッシュへの自動スクロールが効かないことがあるため、明示的に行う)。 */
export function ResumeHighlightScroll() {
  useEffect(() => {
    if (window.location.hash !== "#resume-card") return;
    const el = document.getElementById("resume-card");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  return null;
}
