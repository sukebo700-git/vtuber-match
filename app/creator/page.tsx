import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { AuthVisibility } from "@/components/AuthVisibility";
import { CreatorSuperBoostNotice } from "@/components/CreatorSuperBoostNotice";
import { BasicPremiumTrialPanel } from "@/components/BasicPremiumTrialPanel";
import { PushNotificationButton } from "@/components/PushNotificationButton";
import { NotificationInbox } from "@/components/NotificationInbox";
import { LofiPlanBenefits } from "@/components/LofiPlanBenefits";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VTuber向け無料掲載",
  description: "VtuberMatchにVTuberとして掲載できます。プロフィール編集、上位表示、Lo-Fi配信での紹介特典を確認できます。",
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
          <a href="/viewer">視聴者用</a>
          <a href="/login">ログイン</a>
          <a href="/diagnosis">タイプ診断</a>
          <a href="https://www.youtube.com/@VtuberMatch" target="_blank" rel="noreferrer">公式YouTube</a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>

      <main className="main grid-page">
        <CreatorSuperBoostNotice />

        <section className="status-band">
          <h1>配信者用ページ</h1>
          <p>
            VTuberとして掲載申請、ログイン、プロフィール修正、アップグレードを行えます。
            上位プランでは表示順位や公式チャンネルでの紹介特典を強化できます。
          </p>
        </section>

        <AuthVisibility role="creator" mode="logged-out">
          <section className="creator-action-grid">
            <a className="creator-action-card featured" href="/creator/apply">
              <strong>VTuberとして無料掲載</strong>
              <span>画像、名前、配信サイトURL、自己アピールを登録して、視聴者に見つけてもらえます。</span>
            </a>
            <a className="creator-action-card" href="/login">
              <strong>配信者ログイン</strong>
              <span>掲載中のプロフィール修正、通知、アップグレードはこちらから行えます。</span>
            </a>
          </section>
        </AuthVisibility>

        <AuthVisibility role="creator" mode="logged-in">
          <PushNotificationButton targetType="creator" intent="onboarding" />
          <NotificationInbox />
          <BasicPremiumTrialPanel />
          <section className="creator-action-grid">
            <a className="creator-action-card featured" href="/creator/edit">
              <strong>プロフィール修正</strong>
              <span>掲載中の名前、画像、自己アピール、カテゴリ、タグなどを更新できます。</span>
            </a>
            <a className="creator-action-card" href="/creator/upgrade">
              <strong>アップグレード</strong>
              <span>上位表示、公式紹介、Lo-Fi配信での宣伝特典を確認できます。</span>
            </a>
          </section>
        </AuthVisibility>

        <section className="status-band">
          <h2>プランの違い</h2>
          <p>
            掲載内容、表示順位、公式チャンネルでの紹介内容をまとめて確認できます。
            上位プランほど、見つけてもらうための露出が強くなります。
          </p>
          <div className="plan-table">
            <article className="plan-card">
              <strong>無料プラン</strong>
              <span className="plan-price">0円</span>
              <p>まず掲載を始めたい方向け。基本プロフィールを登録できます。</p>
              <ul>
                <li>画像1枚</li>
                <li>名前、配信サイトURLを掲載</li>
                <li>自己アピール100文字まで</li>
                <li className="plan-highlight-red">紹介ショート動画制作無料</li>
              </ul>
              <LofiPlanBenefits planId="registered" />
            </article>
            <article className="plan-card">
              <strong>ベーシックプラン</strong>
              <span className="plan-price">月額500円</span>
              <p>見つけてもらう力を上げたい方向け。掲載情報と公式紹介の露出が増えます。</p>
              <ul>
                <li>画像3枚</li>
                <li>Xアカウント表示</li>
                <li>カテゴリ、タグ表示</li>
                <li>無料プランより上位表示</li>
                <li>月1回・72時間のプレミアム体験</li>
                <li className="plan-highlight-red">ショート動画制作無料</li>
                <li className="plan-highlight-red">24時間生配信での宣伝無料</li>
              </ul>
              <LofiPlanBenefits planId="paid" />
            </article>
            <article className="plan-card selected">
              <strong>プレミアムプラン</strong>
              <span className="plan-price">月額980円</span>
              <p>もっと目立たせたい方向け。常時優先表示と強い公式紹介枠が入ります。</p>
              <ul>
                <li>ベーシックプランのすべて</li>
                <li>常時優先表示</li>
                <li>おすすめアーカイブ表示</li>
                <li>より目立つプレミアムフレーム</li>
                <li className="plan-highlight-red">ショート動画制作無料</li>
                <li className="plan-highlight-red">24時間生配信での宣伝無料</li>
              </ul>
              <LofiPlanBenefits planId="boost" />
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
