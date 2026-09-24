import type { AdminAnalyticsSummary } from "@/lib/analytics";

type VisitSources = {
  organic: number;
  direct: number;
  social: number;
  referral: number;
  ads: number;
};

type AdminAnalyticsFunnelPanelProps = {
  stats: { today: number; week: number; total: number };
  sources: VisitSources;
  analytics: AdminAnalyticsSummary;
  // 参照元ホスト別の内訳(2026-09-24以降に記録されたぶんのみ)。
  referrers?: Array<{ key: string; count: number }>;
};

// api/visits の classifyReferrerHost が返す識別子の表示名。
const referrerLabels: Record<string, string> = {
  youtube: "YouTube",
  x: "X (Twitter)",
  discord: "Discord",
  google: "Google",
  yahoo: "Yahoo",
  bing: "Bing",
  bluesky: "Bluesky",
  misskey: "Misskey",
  note: "note",
  reddit: "Reddit",
  tiktok: "TikTok",
  instagram: "Instagram",
  internal: "サイト内",
  none: "参照元なし(直接・アプリ内)",
  other: "その他",
};

type FunnelStage = {
  label: string;
  value: number;
  note?: string;
  // 直前の段からの到達率。先頭の段は分母なので持たない。
  rate?: number;
};

const sourceLabels: Array<{ key: keyof VisitSources; label: string }> = [
  { key: "organic", label: "自然検索" },
  { key: "social", label: "SNS" },
  { key: "direct", label: "直接" },
  { key: "referral", label: "外部リンク" },
  { key: "ads", label: "広告" },
];

// 2026-09-22: 以前は「訪問者数」「流入元」「スワイプ集計」が別々のカードに分かれ、
// 全期間の絶対値だけが14個並んでいた。どこで離脱しているかが読めなかったため、
// 訪問 → スワイプ → 登録導線 のファネルと到達率を主役に作り直した。
export function AdminAnalyticsFunnelPanel({ stats, sources, analytics, referrers = [] }: AdminAnalyticsFunnelPanelProps) {
  const today = buildFunnel(
    stats.today,
    analytics.today_swiped_visitors,
    analytics.today_viewer_register_clicks,
    analytics.today_creator_register_clicks,
  );
  const week = buildFunnel(
    stats.week,
    analytics.week_swiped_visitors,
    analytics.week_viewer_register_clicks,
    analytics.week_creator_register_clicks,
  );
  const sourceTotal = sourceLabels.reduce((sum, item) => sum + Number(sources[item.key] || 0), 0);

  return (
    <section className="status-band">
      <div className="section-title-row">
        <div>
          <h2>訪問からの流れ</h2>
          <p>サイトに来た人が、スワイプして、登録に進むまでの落ち方を見ます。数字の右の % は、直前の段からの到達率です。</p>
        </div>
        <a className="secondary-button" href="/admin/analytics">詳細分析を見る</a>
      </div>

      <Funnel title="今日" stages={today} />
      <Funnel title="直近7日間" stages={week} />

      <h3 className="analytics-funnel-subheading">流入元(全期間)</h3>
      {sourceTotal === 0 ? (
        <p className="help-text">まだ流入元のデータがありません。</p>
      ) : (
        <ul className="analytics-source-list">
          {sourceLabels.map((item) => {
            const value = Number(sources[item.key] || 0);
            const share = Math.round((value / sourceTotal) * 100);
            return (
              <li key={item.key}>
                <span className="analytics-source-label">{item.label}</span>
                <span className="analytics-source-bar" aria-hidden="true">
                  <i style={{ width: `${share}%` }} />
                </span>
                <span className="analytics-source-value">
                  {share}%<small>{value.toLocaleString("ja-JP")}</small>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {referrers.length ? (
        <>
          <h3 className="analytics-funnel-subheading">参照元サイト(2026-09-24以降の記録分)</h3>
          <ul className="analytics-source-list">
            {referrers.map((row) => {
              const total = referrers.reduce((sum, item) => sum + item.count, 0);
              const share = total ? Math.round((row.count / total) * 100) : 0;
              return (
                <li key={row.key}>
                  <span className="analytics-source-label">{referrerLabels[row.key] || row.key}</span>
                  <span className="analytics-source-bar" aria-hidden="true">
                    <i style={{ width: `${share}%` }} />
                  </span>
                  <span className="analytics-source-value">
                    {share}%<small>{row.count.toLocaleString("ja-JP")}</small>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      <p className="analytics-total-line">
        全期間: 訪問 {stats.total.toLocaleString("ja-JP")} / スワイプした人 {analytics.swiped_visitors.toLocaleString("ja-JP")}
        {" / "}総スワイプ {analytics.total_swipes.toLocaleString("ja-JP")}
        {" / "}登録導線 {(analytics.viewer_register_clicks + analytics.creator_register_clicks).toLocaleString("ja-JP")}
      </p>
    </section>
  );
}

function Funnel({ title, stages }: { title: string; stages: FunnelStage[] }) {
  const top = stages[0]?.value || 0;
  return (
    <div className="analytics-funnel">
      <h3>{title}</h3>
      {top === 0 ? (
        <p className="help-text">この期間の訪問はまだありません。</p>
      ) : (
        <ol>
          {stages.map((stage) => (
            <li key={stage.label}>
              <div className="analytics-funnel-head">
                <span className="analytics-funnel-label">{stage.label}</span>
                <strong>{stage.value.toLocaleString("ja-JP")}</strong>
                {stage.rate === undefined ? null : <em>{stage.rate}%</em>}
              </div>
              {/* カード幅を数値比で変えると、値が小さく注記が長い最終段が細長く潰れる。
                  幅は固定してバーで比率を示す。 */}
              <span className="analytics-funnel-bar" aria-hidden="true">
                <i style={{ width: `${barWidth(stage.value, top)}%` }} />
              </span>
              {stage.note ? <small>{stage.note}</small> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function buildFunnel(visits: number, swiped: number, viewerClicks: number, creatorClicks: number): FunnelStage[] {
  const registers = viewerClicks + creatorClicks;
  const overall = rate(registers, visits);
  const breakdown = `視聴者 ${viewerClicks.toLocaleString("ja-JP")} / 配信者 ${creatorClicks.toLocaleString("ja-JP")}`;
  return [
    { label: "訪問", value: visits },
    { label: "スワイプした人", value: swiped, rate: rate(swiped, visits) },
    {
      label: "登録へ進んだ人",
      value: registers,
      rate: rate(registers, swiped),
      // 段ごとの到達率だけだと「結局どれだけ登録に繋がったか」が見えないため、
      // 最終段にだけ訪問全体からの率を添える。
      note: overall === undefined ? breakdown : `${breakdown}・訪問全体の ${overall}%`,
    },
  ];
}

// 分母が0なら率は出さない。0で割って NaN/Infinity を出さないのはもちろん、
// スワイプ0なのに登録導線だけ発生した場合(ランディングから直接登録へ進んだ場合)に
// 「0%」と表示して実態を誤らせないため、undefined を返して率自体を隠す。
function rate(value: number, base: number) {
  if (!base) return undefined;
  return Math.round((value / base) * 100);
}

// 先頭の段(訪問)を100%として各段の比率を出す。登録導線がスワイプを上回る
// ケース(ランディングから直接登録へ進む)もあり得るので、100%で頭打ちにする。
function barWidth(value: number, top: number) {
  if (!top) return 0;
  return Math.min(Math.round((value / top) * 100), 100);
}
