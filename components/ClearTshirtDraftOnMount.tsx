"use client";

import { useEffect } from "react";

// Tシャツ注文の決済が完了した画面でだけ呼ぶ。途中入力の下書きは決済完了まで
// 保持し(Stripeの決済ページから「戻る」で復帰しても選択内容が残るように)、
// 実際に決済が完了したこのタイミングで初めて消す。
export function ClearTshirtDraftOnMount() {
  useEffect(() => {
    try {
      localStorage.removeItem("vtuber-match-tshirt-order-draft");
    } catch {
      // no-op
    }
  }, []);
  return null;
}
