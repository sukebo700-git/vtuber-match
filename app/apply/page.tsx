import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { AuthVisibility } from "@/components/AuthVisibility";
import { ApplicationForm } from "@/components/ApplicationForm";
import { ReloginEscapeHatch } from "@/components/ReloginEscapeHatch";
import { CATEGORIES, TAGS } from "@/lib/constants";
import type { Metadata } from "next";

// /creator/apply と同一内容(このファイルをそのままre-export)。
// 重複コンテンツと見なされないよう、canonicalは正規URLの方に向ける
export const metadata: Metadata = {
  title: "VTuberとして無料掲載",
  alternates: {
    canonical: "/creator/apply",
  },
};

export default function ApplyPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">VtuberMatch</a>
        <nav className="nav" aria-label="メイン">
          <a href="/viewer">視聴者用</a>
          <a href="/creator">配信者用</a>
          <a href="/diagnosis">タイプ診断</a>
          <a href="https://www.youtube.com/@VtuberMatch" target="_blank" rel="noreferrer">公式YouTube</a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>

      <main className="main grid-page">
        <AuthVisibility
          role="creator"
          mode="logged-out"
          fallback={
            <section className="status-band">
              <h2>すでに配信者としてログイン中です</h2>
              <p>掲載内容の変更は、プロフィール修正画面から行えます。心当たりがない場合は、以前の端末での登録情報が残っている可能性があります。</p>
              <p className="inline-actions" style={{ marginTop: 12 }}>
                <a className="primary-button" href="/creator/edit">プロフィールを修正する</a>
                <ReloginEscapeHatch prefix="vtuber-match-creator" />
              </p>
            </section>
          }
        >
          <section className="status-band apply-plan-comparison">
            <h1 style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
              Lo-Fi配信とショート動画で、あなたを宣伝します
            </h1>
            <picture>
              <source srcSet="/promo/plan-comparison/plan-comparison.webp?v=20260910" type="image/webp" />
              <img
                src="/promo/plan-comparison/plan-comparison.jpg?v=20260910"
                alt="VtuberMatchプラン比較。無料登録でも掲載・宣伝・マッチングに加えて切り抜き動画1本まで使えます。無料登録0円: Lo-Fi 24時間配信に掲載(1日2回程度)、公式YouTubeチャンネル用の紹介ショート動画を無料制作、掲載ページを作成、画像1枚・自己アピール100文字まで、リスナーからのいいねやVTYPE診断に参加。切り抜き動画は初回1本無料(お一人様1回、2本目以降は1本2,000円、透かしロゴあり)。プレミアムプラン月額980円(1,000円お得): Lo-Fi配信で夕方〜深夜を優先掲載(1日5回程度)、紹介ショート動画にナレーション+テロップ、YouTube概要欄にチャンネルリンクを常時掲載、画像5枚・自己アピール500文字まで、カテゴリ各3件・タグ各8件、スワイプで常時優先表示・プレミアムフレーム。切り抜き動画は毎月1本目が1,000円引き(2,000円→1,000円、透かしロゴなし)。PROプラン月額3,980円(4,000円お得): プレミアムの掲載・宣伝・プロフィール表示の特典をすべて含み、切り抜き動画は毎月4本まで0円(5本目以降は1本2,000円、透かしロゴなし、プレミアムの1,000円引きクーポンとの併用不可)。利用にはVtuberMatchへの配信者登録・ログインが必要。切り抜き動画の機能は全プラン共通: 配信URLと範囲を送るだけで全自動生成、見せ場の時刻指定でズーム演出、縦動画変換・自動字幕・無音カット・漫画風エフェクト、1本3分以内(2区間の結合も可)、納品後7日以内2回までテロップ修正可能、VtuberMatch未登録でも単発購入(1本2,000円)が可能。"
                loading="eager"
              />
            </picture>
          </section>
          <ApplicationForm categories={CATEGORIES} tags={TAGS} />
        </AuthVisibility>
      </main>
    </div>
  );
}
