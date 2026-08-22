import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { SwipeClient } from "@/components/SwipeClient";
import { getStreamersForSwipe } from "@/lib/streamers";
import { activeSwipeAdCards, getSwipeAdSettings } from "@/lib/swipeAds";
import { getApprovedGoodsCards } from "@/lib/vtuberGoods";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VTuberをスワイプで探す",
  description: "登録なしでVTuberをスワイプ。気になる配信者を直感で見つけて、YouTubeチャンネルへ移動できます。",
  alternates: {
    canonical: "/swipe",
  },
};

export default async function SwipePage() {
  // 広告設定は5分キャッシュの1 read、グッズも同様にキャッシュ済みの一覧を使う。
  // 広告がオフの間はグッズの読み取りも行わない。
  const [streamers, adSettings] = await Promise.all([
    getStreamersForSwipe(),
    getSwipeAdSettings(),
  ]);
  const goodsCards = adSettings.enabled ? await getApprovedGoodsCards() : [];

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/viewer">視聴者用</a>
          <a href="/creator">配信者用</a>
          <a href="/diagnosis">タイプ診断</a>
          <a href="https://www.youtube.com/@VtuberMatch" target="_blank" rel="noreferrer">公式YouTube</a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>
      <main className="main swipe-page-main">
        <SwipeClient
          initialStreamers={streamers}
          adCards={adSettings.enabled ? activeSwipeAdCards(adSettings) : []}
          goodsCards={goodsCards}
          adIntervals={{ guest: adSettings.guest_interval, free: adSettings.free_interval }}
          houseAdEnabled={adSettings.enabled}
        />
      </main>
    </div>
  );
}
