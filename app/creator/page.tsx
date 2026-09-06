import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { AuthVisibility } from "@/components/AuthVisibility";
import { CreatorSuperBoostNotice } from "@/components/CreatorSuperBoostNotice";
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
              <span>あなたにいいねしたリスナーを確認し、いいねありがとうを送れます。</span>
            </a>
            <a className="creator-action-card" href="/creator/upgrade">
              <strong>アップグレード</strong>
              <span>上位表示、公式紹介、Lo-Fi配信での紹介特典を確認できます。</span>
            </a>
            <a
              className="creator-action-card featured"
              href="https://apply.vtubermatch.com/apply"
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>切り抜きショート動画作成を依頼(βテスト中)</strong>
              <span>配信の切り抜きを自動編集してショート動画にします。無料プランはお一人様1回まで依頼できます。</span>
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

        <section className="status-band creator-plan-panel apply-plan-comparison">
          <h2 style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
            プランの違い
          </h2>
          <picture>
            <source srcSet="/promo/creator-plans/creator-plans.webp" type="image/webp" />
            <img
              src="/promo/creator-plans/creator-plans.jpg"
              alt="プランの違い。無料プラン0円: Lo-Fi 24時間配信に掲載(20秒CM)、YouTube Shortsで紹介動画を無料掲載、無料掲載ページを作成、画像1枚・自己アピール100文字まで、カテゴリ・タグは非表示。ベーシックプラン月額500円(無料プランに加えて): 画像3枚・自己アピール500文字まで、Xアカウント・カテゴリ・タグ(5個まで)を表示、スワイプで上位表示、Lo-Fi配信のCMが1〜3分に拡大、Shortsに音声ナレーション+テキストが付く。プレミアムプラン月額980円(ベーシックプランに加えて): 画像5枚・タグ8個まで、常時優先表示でスワイプの最上位に、ホログラム演出とプレミアムフレームでカードが目立つ、自分のグッズをリスナーのスワイプ画面に掲載できるグッズ掲載枠。"
              loading="lazy"
            />
          </picture>
        </section>
      </main>
    </div>
  );
}
