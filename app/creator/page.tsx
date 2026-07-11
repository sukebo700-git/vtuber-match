import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { AuthVisibility } from "@/components/AuthVisibility";
import { CreatorSuperBoostNotice } from "@/components/CreatorSuperBoostNotice";
import { LofiPlanBenefits } from "@/components/LofiPlanBenefits";
import { CreatorProfileSharePanel } from "@/components/CreatorProfileSharePanel";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VTuber向け無料掲載 | VtuberMatch",
  description:
    "VtuberMatchにVTuberとして掲載できます。プロフィール編集、プラン変更、Lo-Fi配信での紹介特典を確認できます。",
  alternates: {
    canonical: "/creator",
  },
};

export default function CreatorPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">VtuberMatch</a>
        <nav className="nav" aria-label="メイン">
          <a href="/swipe">探す</a>
          <a href="/viewer">視聴者向け</a>
          <a href="/login">ログイン</a>
          <a href="/diagnosis">VTYPE診断</a>
          <a href="https://www.youtube.com/@VtuberMatch" target="_blank" rel="noreferrer">公式YouTube</a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>

      <main className="main grid-page creator-page-main">
        <CreatorSuperBoostNotice />

        <section className="status-band creator-hero-panel">
          <span className="creator-page-kicker">For VTubers</span>
          <h1>あなたの活動を、推しを探している人へ。</h1>
          <p>
            VtuberMatchでは、無料掲載からプロフィール公開を始められます。
            上位プランでは表示機会や公式チャンネルでの紹介内容が広がり、Lo-Fi配信内での掲載特典も利用できます。
          </p>
          <div className="creator-hero-actions">
            <a className="primary-button" href="/creator/apply">VTuberとして無料掲載</a>
            <a className="secondary-button" href="/creator/upgrade">プランを見る</a>
          </div>
        </section>

        <AuthVisibility role="creator" mode="logged-out">
          <section className="creator-action-grid creator-entry-grid">
            <a className="creator-action-card featured" href="/creator/apply">
              <strong>無料掲載を始める</strong>
              <span>画像、名前、配信サイトURL、自己アピールを登録して、視聴者に見つけてもらうきっかけを作れます。</span>
            </a>
            <a className="creator-action-card" href="/login">
              <strong>配信者ログイン</strong>
              <span>掲載中のプロフィール修正、プラン変更はこちらから行えます。</span>
            </a>
          </section>
        </AuthVisibility>

        <AuthVisibility role="creator" mode="logged-in">
          <CreatorProfileSharePanel />
          <section className="creator-action-grid creator-entry-grid">
            <a className="creator-action-card featured" href="/creator/edit">
              <strong>プロフィール修正</strong>
              <span>掲載中の名前、画像、自己アピール、カテゴリ、タグなどを更新できます。</span>
            </a>
            <a className="creator-action-card" href="/creator/short-video">
              <strong>紹介ショート動画を依頼</strong>
              <span>公式YouTubeチャンネルで公開する紹介ショート動画を無料で依頼できます。</span>
            </a>
            <a className="creator-action-card" href="/creator/upgrade">
              <strong>アップグレード</strong>
              <span>上位表示、公式紹介、Lo-Fi配信での紹介特典を確認できます。</span>
            </a>
          </section>
        </AuthVisibility>

        <section className="status-band creator-plan-panel">
          <span className="creator-page-kicker">Plans</span>
          <h2>プランの違い</h2>
          <p>
            掲載内容、表示順位、公式チャンネルでの紹介内容をまとめて確認できます。
            上位プランほど、視聴者の目に触れる機会が増えます。
          </p>
          <div className="plan-table creator-plan-table">
            <article className="plan-card">
              <strong>無料プラン</strong>
              <span className="plan-price">0円</span>
              <p>まずは掲載を始めたい方向け。基本プロフィールを登録できます。</p>
              <ul>
                <li>画像1枚</li>
                <li>名前、配信サイトURLを掲載</li>
                <li>自己アピール100文字まで</li>
                <li className="plan-highlight-red">20秒CMとしてLo-Fi 24時間配信に掲載</li>
                <li className="plan-highlight-red">YouTube Shortsにも無料掲載</li>
              </ul>
              <LofiPlanBenefits planId="registered" />
            </article>
            <article className="plan-card">
              <strong>ベーシックプラン</strong>
              <span className="plan-price">月額500円</span>
              <p>もっと見られる機会を増やしたい方向け。掲載情報と公式紹介の内容が広がります。</p>
              <ul>
                <li>画像3枚</li>
                <li>Xアカウント表示</li>
                <li>カテゴリ、タグ表示</li>
                <li>無料プランより上位表示</li>
                <li className="plan-highlight-red">1〜3分のCMをLo-Fi 24時間配信で配信</li>
                <li className="plan-highlight-red">Shortsは音声ナレーション+テキスト付き</li>
              </ul>
              <LofiPlanBenefits planId="paid" />
            </article>
            <article className="plan-card">
              <strong>プレミアムプラン</strong>
              <span className="plan-price">月額980円</span>
              <p>さらに目立たせたい方向け。常時優先表示を利用できます。</p>
              <ul>
                <li>ベーシックプランのすべて</li>
                <li>常時優先表示で宣伝効果を最大化</li>
                <li>より目立つプレミアムフレーム</li>
                <li className="plan-highlight-red">1〜3分のCMをLo-Fi 24時間配信で配信</li>
                <li className="plan-highlight-red">Shortsは音声ナレーション+テキスト付き</li>
              </ul>
              <LofiPlanBenefits planId="boost" />
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
