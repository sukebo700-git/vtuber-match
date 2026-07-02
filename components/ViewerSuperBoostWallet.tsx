"use client";

import { Star } from "lucide-react";

export function ViewerSuperBoostWallet() {
  return (
    <section className="status-band viewer-super-wallet">
      <h2><Star size={20} fill="currentColor" /> スーパーいいねとは？</h2>
      <p>
        スーパーいいねは、スワイプ画面で送りたいVtuberを選んで送れます。
        購入後すぐに応援したいVtuberさんに72時間のエフェクト効果と上位表示が発動し、全力応援できます。
      </p>
    </section>
  );
}
