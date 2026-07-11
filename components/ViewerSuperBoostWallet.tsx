"use client";

import { Star } from "lucide-react";

export function ViewerSuperBoostWallet() {
  return (
    <section className="status-band viewer-super-wallet">
      <h2><Star size={20} fill="currentColor" /> スーパーいいねとは？</h2>
      <p>
        スーパーいいねは、スワイプ画面から気になるVTuberに送れる特別ないいねです。
        送った相手には72時間のエフェクトと上位表示が付き、いつもより目立つ形で応援できます。
      </p>
    </section>
  );
}
