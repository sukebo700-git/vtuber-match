import type { Metadata } from "next";
import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";

export const metadata: Metadata = {
  title: "生成AI利用ポリシー",
  description: "VtuberMatchにおける生成AIの利用範囲と、応募者様・掲載者様からご提供いただいた素材の取り扱いについての方針です。",
  alternates: {
    canonical: "/ai-policy",
  },
};

export default function AiPolicyPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">VtuberMatch</a>
        <nav className="nav" aria-label="メイン">
          <a href="/creator">配信者用</a>
          <a href="/diagnosis">タイプ診断</a>
          <a href="https://www.youtube.com/@VtuberMatch" target="_blank" rel="noreferrer">公式YouTube</a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>

      <main className="main grid-page">
        <section className="status-band legal-hero">
          <h1>生成AI利用ポリシー</h1>
          <p>
            VtuberMatchでは、応募者様・掲載者様からご提供いただいた素材そのものに対し、生成AIによる加工・改変は行いません。
          </p>
        </section>

        <section className="terms-list">
          <article className="status-band">
            <h2>対象となる素材</h2>
            <p>以下を含みます。</p>
            <ul className="feature-list">
              <li>立ち絵</li>
              <li>イラスト</li>
              <li>写真</li>
              <li>ロゴ</li>
              <li>動画</li>
              <li>音声</li>
              <li>キャラクターデザイン</li>
              <li>その他、応募者様からご提供いただいた制作物</li>
            </ul>
          </article>

          <article className="status-band">
            <h2>行わないこと</h2>
            <p>
              これらの素材を生成AIに読み込ませ、画像生成・動画生成・差分生成・補完・描き直し・高画質化・背景変更・表情変更・ポーズ変更・画風変換などを行うことはありません。
            </p>
            <p>また、以下の目的で使用することもありません。</p>
            <ul className="feature-list">
              <li>AI学習・追加学習</li>
              <li>LoRA等の学習素材</li>
              <li>キャラクターの再現</li>
              <li>類似画像の生成</li>
              <li>音声学習・ボイスクローン</li>
              <li>第三者向けAIサービスへの学習素材提供</li>
              <li>AIモデル・データセットの作成</li>
            </ul>
          </article>

          <article className="status-band">
            <h2>VtuberMatchにおける生成AIの活用範囲</h2>
            <p>
              VtuberMatchにおける生成AIの活用は、テキスト作成補助、背景素材、オープニング・エンディング等の補助素材、動画構成の検討など、応募者様からご提供いただいた素材そのものに影響しない範囲に限定しております。
            </p>
          </article>

          <article className="status-band">
            <h2>ご提供素材の取り扱い</h2>
            <p>
              ご提供素材は、トリミング、サイズ調整、配置、切り替え、字幕追加など、通常の動画編集・掲載作業の範囲で取り扱います。
            </p>
            <p>
              応募者様からご提供いただいた素材そのものを、生成AIによって加工・改変することはありません。
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
