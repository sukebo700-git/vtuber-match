"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { UiButton } from "@/components/ui/UiButton";

// スマホTOPページの「渋滞」対策: VTYPE診断・履歴書作成・本日のおすすめの3つは
// VTuberを探すボタンほど優先度が高くないため、スマホでは折りたたんでおき
// 「もっと見る」で展開する。デスクトップは常に展開表示(CSSで上書き)。
export function LandingMoreVtubers() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="landing-more-vtubers">
      <button
        type="button"
        className="landing-more-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "閉じる" : "もっと見る"}
        <ChevronDown size={16} aria-hidden />
      </button>
      <div className={`landing-more-content ${expanded ? "is-open" : ""}`}>
        <div className="landing-actions-row2">
          <UiButton variant="secondary" className="landing-secondary-cta" href="/diagnosis">
            VTYPE診断をする
          </UiButton>
          <UiButton variant="secondary" className="landing-secondary-cta" href="/creator?highlight=resume#resume-card">
            履歴書を作る
          </UiButton>
        </div>
        <a className="landing-promo-banner landing-daily-pickup-banner" href="/recommended">
          <div className="landing-promo-banner-copy">
            <span className="landing-promo-banner-kicker">日替わりピックアップ</span>
            <strong>本日のおすすめVTuber</strong>
          </div>
          <span className="landing-promo-banner-cta">10人を見る</span>
        </a>
      </div>
    </div>
  );
}
