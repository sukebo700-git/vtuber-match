import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { UiButton } from "@/components/ui/UiButton";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "切り抜き動画作成",
  description:
    "配信URLと切り抜きたい範囲を送るだけで、縦動画変換・自動字幕・無音カット・演出まで自動でつくる切り抜き動画サービス。登録者は初回1本無料、未登録でも単発購入できます。",
  alternates: {
    canonical: "/clip",
  },
};

/**
 * 切り抜き動画サービスの「統合ページ」。
 *
 * 依頼フォーム(apply.vtubermatch.com)にいきなり飛ばすのではなく、まず
 * 「何ができるか」「プランごとの違い」を1枚で見せてから申し込み先へ誘導する。
 * ログイン不要で見られる(依頼フォーム側の会員確認はプラン別の各リンク先で行う)。
 *
 * 今はまだ作例動画を載せていない(先に本体だけ作る方針)。動画を用意したら
 * TOPページのClipDemoVideoと同じ要領でこのページにも埋め込む予定。
 */
export default function ClipLandingPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark" />
          VtuberMatch
        </a>
        <nav className="nav" aria-label="メイン">
          <a href="/swipe">探す</a>
          <a href="/clip" aria-current="page">切り抜き作成</a>
          <a href="/viewer">視聴者向け</a>
          <a href="/creator">VTuber向け</a>
          <a href="https://www.youtube.com/@VtuberMatch" target="_blank" rel="noreferrer">
            公式YouTube
          </a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>

      <main className="main grid-page clip-landing">
        <section className="status-band clip-landing-hero">
          <h1>配信を、ショート動画に。</h1>
          <p>
            配信URLと切り抜きたい範囲を送るだけ。縦動画への変換・自動字幕・無音カット・
            ズームや漫画風エフェクトまで、全自動でつくります。
          </p>
          <div className="clip-landing-hero-actions">
            <UiButton href="#plans">プランを見る</UiButton>
            <UiButton variant="secondary" href="https://apply.vtubermatch.com/apply/onetime">
              登録せずに単発購入(1本2,000円)
            </UiButton>
          </div>
        </section>

        <section className="status-band clip-landing-features">
          <h2>切り抜き動画の機能は全プラン共通</h2>
          <div className="clip-landing-feature-grid">
            <ul>
              <li>配信URLと切り抜きたい範囲を送るだけで全自動生成</li>
              <li>見せ場の時刻を指定すると、そこにズーム・強調演出が寄る</li>
              <li>納品後7日以内・2回まで、テロップの文字を直せます</li>
            </ul>
            <ul>
              <li>縦動画変換/自動字幕/無音カット/漫画風エフェクト</li>
              <li>1本3分以内。離れた2つの場面をつないで1本にもできます</li>
              <li>VtuberMatchに登録していなくても、単発購入(1本2,000円)が可能</li>
            </ul>
          </div>
        </section>

        <section id="plans" className="status-band apply-plan-comparison">
          <h2 style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
            プラン比較
          </h2>
          <picture>
            <source srcSet="/promo/plan-comparison/plan-comparison.webp" type="image/webp" />
            <img
              src="/promo/plan-comparison/plan-comparison.jpg"
              alt="VtuberMatchプラン比較。無料登録でも掲載・宣伝・マッチングに加えて切り抜き動画1本まで使えます。無料登録0円: 切り抜き動画は初回1本無料(お一人様1回、2本目以降は1本2,000円、透かしロゴあり)。プレミアムプラン月額980円(1,000円お得): 切り抜き動画は毎月1本目が1,000円引き(2,000円→1,000円、透かしロゴなし)。PROプラン月額3,980円(4,000円お得): 切り抜き動画は毎月4本まで0円(5本目以降は1本2,000円、透かしロゴなし)。利用にはVtuberMatchへの配信者登録・ログインが必要。単発購入(1本2,000円)は登録不要。"
              loading="lazy"
            />
          </picture>
        </section>

        <section className="status-band clip-landing-cta">
          <h2>申し込む</h2>
          <div className="clip-landing-cta-grid">
            <div className="clip-landing-cta-card">
              <strong>無料登録</strong>
              <p>初回1本無料。まずは配信者登録から。</p>
              <UiButton variant="secondary" href="/creator/apply">無料で登録する</UiButton>
            </div>
            <div className="clip-landing-cta-card">
              <strong>プレミアム / PRO</strong>
              <p>登録済みの方はこちらからログインして申し込めます。</p>
              <UiButton variant="secondary" href="https://apply.vtubermatch.com/apply">
                切り抜きを依頼する
              </UiButton>
            </div>
            <div className="clip-landing-cta-card featured">
              <strong>登録不要・単発購入</strong>
              <p>1本2,000円。VtuberMatchに登録していなくても申し込めます。</p>
              <UiButton href="https://apply.vtubermatch.com/apply/onetime">単発購入する</UiButton>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
