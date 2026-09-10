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
  title: "VTuber向け無料掲載",
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
          <a href="/clip" className="nav-clip-highlight">切り抜き作成</a>
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
            <a className="creator-action-card featured" href="/clip">
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
            <source srcSet="/promo/creator-plans/creator-plans.webp?v=20260910" type="image/webp" />
            <img
              src="/promo/creator-plans/creator-plans.jpg?v=20260910"
              alt="VtuberMatchプラン比較。無料登録でも掲載・宣伝・マッチングに加えて切り抜き動画1本まで使えます。無料登録0円: Lo-Fi 24時間配信に掲載(1日2回程度)、公式YouTubeチャンネル用の紹介ショート動画を無料制作、掲載ページを作成、画像1枚・自己アピール100文字まで、リスナーからのいいねやVTYPE診断に参加。切り抜き動画は初回1本無料(お一人様1回、2本目以降は1本2,000円、透かしロゴあり)。プレミアムプラン月額980円(1,000円お得): Lo-Fi配信で夕方〜深夜を優先掲載(1日5回程度)、紹介ショート動画にナレーション+テロップ、YouTube概要欄にチャンネルリンクを常時掲載、画像5枚・自己アピール500文字まで、カテゴリ各3件・タグ各8件、スワイプで常時優先表示・プレミアムフレーム。切り抜き動画は毎月1本目が1,000円引き(2,000円→1,000円、透かしロゴなし)。PROプラン月額3,980円(4,000円お得): プレミアムの掲載・宣伝・プロフィール表示の特典をすべて含み、切り抜き動画は毎月4本まで0円(5本目以降は1本2,000円、透かしロゴなし、プレミアムの1,000円引きクーポンとの併用不可)。利用にはVtuberMatchへの配信者登録・ログインが必要。切り抜き動画の機能は全プラン共通: 配信URLと範囲を送るだけで全自動生成、見せ場の時刻指定でズーム演出、縦動画変換・自動字幕・無音カット・漫画風エフェクト、1本3分以内(2区間の結合も可)、納品後7日以内2回までテロップ修正可能、VtuberMatch未登録でも単発購入(1本2,000円)が可能。"
              loading="lazy"
            />
          </picture>
        </section>
      </main>
    </div>
  );
}
