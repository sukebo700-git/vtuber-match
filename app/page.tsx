import { AuthVisibility } from "@/components/AuthVisibility";
import { GoogleOneTap } from "@/components/GoogleOneTap";
import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { LandingRandomVtuberImage } from "@/components/LandingRandomVtuberImage";
import { SmartPromoLink } from "@/components/SmartPromoLink";
import { XCampaignCreatorEntryLink } from "@/components/XCampaignCreatorEntryLink";
import { UiButton } from "@/components/ui/UiButton";
import { UiPanel } from "@/components/ui/UiPanel";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VtuberMatch | 気になるVTuberと直感で出会える",
  description:
    "VtuberMatchは、スワイプとVTYPE診断で気になるVTuberを探せるサービスです。VTuber向けの掲載申請やLo-Fi配信掲載特典も用意しています。",
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark" />
          VtuberMatch
        </a>
        <nav className="nav" aria-label="メイン">
          <a href="/swipe">探す</a>
          <a href="/diagnosis">VTYPE診断</a>
          <a href="/viewer">視聴者向け</a>
          <a href="/creator">VTuber向け</a>
          <a href="https://www.youtube.com/@VtuberMatch" target="_blank" rel="noreferrer">
            公式YouTube
          </a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>

      <main className="main landing-main landing-refresh-main">
        <section className="landing-hero landing-refresh-hero">
          <div className="landing-copy landing-refresh-copy">
            <div className="landing-hero-badges">
              <div className="landing-milestone landing-hero-milestone" aria-label="登録者数300名突破">
                <span>登録者数</span>
                <strong>300名突破</strong>
              </div>
            </div>
            <h1>
              <span>気になる</span>
              <span>VTuberと、</span>
              <span>直感で</span>
              <span>出会える。</span>
            </h1>
            <div className="landing-actions landing-actions-2row">
              <UiButton className="landing-primary-cta landing-actions-row1" href="/swipe">
                VTuberを探す
              </UiButton>
              <div className="landing-actions-row2">
                <UiButton variant="secondary" className="landing-secondary-cta" href="/diagnosis">
                  VTYPE診断をする
                </UiButton>
                <UiButton
                  variant="secondary"
                  className="landing-secondary-cta"
                  href="/creator?highlight=resume#resume-card"
                >
                  履歴書を作る
                </UiButton>
              </div>
            </div>
          </div>

          <div className="landing-visual landing-refresh-visual" aria-label="VTuberビジュアル">
            <div className="landing-hero-character">
              <LandingRandomVtuberImage randomize variant="hero" />
            </div>
          </div>

          <SmartPromoLink kind="creator-promo" className="landing-promo-banner">
            <div className="landing-promo-banner-copy">
              <span className="landing-promo-banner-kicker">ショート動画&amp;24時間宣伝企画</span>
              <strong>Lo-Fi配信への掲載・紹介ショート動画・無料掲載ページ、すべて0円</strong>
            </div>
            <span className="landing-promo-banner-cta">無料で宣伝を申し込む</span>
          </SmartPromoLink>

          <AuthVisibility role="viewer" mode="logged-out">
            <a className="landing-promo-banner" href="/viewer/register">
              <div className="landing-promo-banner-copy">
                <strong>スワイプ回数、マッチング無制限</strong>
              </div>
              <span className="landing-promo-banner-cta">リスナー登録無料</span>
            </a>
          </AuthVisibility>

          <AuthVisibility role="viewer" mode="logged-out">
            <GoogleOneTap />
          </AuthVisibility>

          <SmartPromoLink kind="x-campaign" className="landing-promo-banner landing-x-campaign-banner">
            <div className="landing-promo-banner-copy">
              <span className="landing-promo-banner-kicker">期間限定キャンペーン</span>
              <strong>Amazonギフトカード10,000円分プレゼント</strong>
            </div>
            <span className="landing-promo-banner-cta">Xのキャンペーンに応募する</span>
          </SmartPromoLink>
          <XCampaignCreatorEntryLink />

          <a className="landing-scroll-cue landing-refresh-scroll" href="#lofi-benefits">
            <span>Lo-Fi配信特典を見る</span>
            <span aria-hidden="true">↓</span>
          </a>
        </section>

        <UiPanel variant="landing" className="landing-lofi-section landing-refresh-section" id="lofi-benefits">
          <div className="landing-section-copy">
            <span className="landing-section-kicker">For VTubers</span>
            <h2>Lo-Fi配信で、あなたの活動をそっと届ける。</h2>
            <p>
              無料プランに申し込むと、Lo-Fi 24時間配信への掲載、紹介ショート動画での宣伝、
              無料掲載ページの作成をまとめて利用できます。
            </p>
          </div>
          <div className="landing-lofi-player" aria-label="Lo-Fi配信ミニプレーヤー">
            <iframe
              src="https://www.youtube.com/embed/D_K9qpR9_rY"
              title="VtuberMatch Lo-Fi配信"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
          <div className="landing-campaign-actions">
            <SmartPromoLink kind="creator-promo" className="primary-button">
              無料で宣伝を申し込む
            </SmartPromoLink>
            <UiButton variant="secondary" href="/creator">
              Lo-Fi特典を見る
            </UiButton>
          </div>
        </UiPanel>

        <UiPanel variant="landing" className="landing-diagnosis-section landing-refresh-section" id="diagnosis-menu">
          <div className="landing-section-copy">
            <span className="landing-section-kicker">VTYPE診断</span>
            <h2>あなたと相性のいいVTuberが見つかる16タイプ診断</h2>
            <p>簡単な質問に答えるだけ。あなたのVTYPEをチェック。</p>
          </div>
          <div className="landing-diagnosis-actions" aria-label="診断メニュー">
            <UiButton variant="secondary" href="/diagnosis">
              VTuber向け簡易診断
            </UiButton>
            <UiButton variant="secondary" href="/diagnosis/advanced">
              VTuber向け本気診断
            </UiButton>
            <UiButton variant="secondary" href="/diagnosis/viewer">
              リスナーの方はこちら
            </UiButton>
          </div>
        </UiPanel>
      </main>
    </div>
  );
}
