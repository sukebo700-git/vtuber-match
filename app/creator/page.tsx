import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { AuthVisibility } from "@/components/AuthVisibility";
import { CreatorSuperBoostNotice } from "@/components/CreatorSuperBoostNotice";
import { LofiPlanBenefits } from "@/components/LofiPlanBenefits";
import { CreatorProfileSharePanel } from "@/components/CreatorProfileSharePanel";
import { ResumeDownloadButton } from "@/components/ResumeDownloadButton";
import { ResumeHighlightScroll } from "@/components/ResumeHighlightScroll";
import { NotificationInbox } from "@/components/NotificationInbox";
import { CollaborationDefaultOnBanner } from "@/components/CollaborationDefaultOnBanner";
import { isCollaborationEnabled } from "@/lib/collaboration/config";
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

export default function CreatorPage({
  searchParams,
}: {
  searchParams?: { highlight?: string };
}) {
  const collaborationEnabled = isCollaborationEnabled();
  const highlightResume = searchParams?.highlight === "resume";
  const resumeHighlightClass = highlightResume ? " creator-action-card-highlight" : "";
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
        {highlightResume && <ResumeHighlightScroll />}
        <CreatorSuperBoostNotice />

        <section className="status-band creator-hero-panel">
          <span className="creator-page-kicker">For VTubers</span>
          <h1>あなたの活動を、推しを探している人へ。</h1>
          <p>
            無料プランに申し込むと、Lo-Fi 24時間配信への掲載、紹介ショート動画での宣伝、
            あなた専用の無料掲載ページの作成をまとめて利用できます。
            上位プランでは、CMの長さや掲載回数が広がり、宣伝効果がさらに高まります。
          </p>
          <div className="creator-hero-actions">
            <a className="primary-button" href="/creator/apply">無料で宣伝を申し込む</a>
            <a className="secondary-button" href="/creator/upgrade">プランを見る</a>
          </div>
        </section>

        <AuthVisibility role="creator" mode="logged-out">
          <section className="creator-action-grid creator-entry-grid">
            <a className="creator-action-card featured" href="/creator/apply">
              <strong>無料で宣伝を申し込む</strong>
              <span>Lo-Fi 24時間配信への掲載、紹介ショート動画での宣伝、無料掲載ページの作成をまとめて申し込めます。</span>
            </a>
            <a id="resume-card" className={`creator-action-card${resumeHighlightClass}`} href="/login">
              <strong>配信者ログイン</strong>
              <span>掲載中のプロフィール修正、プラン変更はこちらから行えます。履歴書を作るにはログインが必要です。</span>
            </a>
          </section>
        </AuthVisibility>

        <AuthVisibility role="creator" mode="logged-in">
          <NotificationInbox />
          {collaborationEnabled && <CollaborationDefaultOnBanner />}
          <CreatorProfileSharePanel />
          <section className="creator-action-grid creator-entry-grid">
            <a className="creator-action-card" href="/creator/edit">
              <strong>プロフィール修正</strong>
              <span>掲載中の名前、画像、自己アピール、カテゴリ、タグなどを更新できます。</span>
            </a>
            <ResumeDownloadButton
              id="resume-card"
              className={`creator-action-card${resumeHighlightClass}`}
            >
              <strong>履歴書を作る</strong>
              <span>登録済みプロフィールから、VTuber専用履歴書(PNG画像)をプレビューしてダウンロードできます。</span>
            </ResumeDownloadButton>
            <a className="creator-action-card featured" href="/creator/short-video">
              <strong>紹介ショート動画を依頼</strong>
              <span>公式YouTubeチャンネルで公開する紹介ショート動画を無料で依頼できます。</span>
            </a>
            <a className="creator-action-card" href="/creator/merch">
              <strong>グッズ掲載枠</strong>
              <span>プレミアムプラン特典。あなたのグッズをリスナーのスワイプ画面に掲載できます。</span>
            </a>
            <a className="creator-action-card" href="/creator/viewer-likes">
              <strong>気になるリスナー</strong>
              <span>あなたにいいねしたリスナーを確認し、いいね返しができます。</span>
            </a>
            <a className="creator-action-card" href="/creator/upgrade">
              <strong>アップグレード</strong>
              <span>上位表示、公式紹介、Lo-Fi配信での紹介特典を確認できます。</span>
            </a>
            {collaborationEnabled && (
              <a className="creator-action-card" href="/creator/collaboration/settings">
                <strong>コラボのお誘い設定</strong>
                <span>他のVTuberとのコラボ受付・非公開連絡先を設定できます。</span>
              </a>
            )}
            <a className="creator-action-card" href="/diagnosis">
              <strong>VTYPE診断</strong>
              <span>視聴者との相性がわかる16タイプ診断を受けられます。</span>
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
              <p>Lo-Fi配信への掲載、ショート動画での宣伝、無料掲載ページの作成をまとめて申し込めます。</p>
              <ul>
                <li className="plan-highlight-red">Lo-Fi 24時間配信に掲載(20秒CM)</li>
                <li className="plan-highlight-red">紹介ショート動画で宣伝(YouTube Shorts)</li>
                <li className="plan-highlight-red">無料掲載ページを作成</li>
                <li>画像1枚、名前、配信サイトURL、自己アピール100文字まで</li>
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
                <li>画像5枚</li>
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
