"use client";

import { useMemo, useState } from "react";

import type { VisitAnalyticsDetail } from "@/lib/analytics";

type AdminAnalyticsDashboardProps = {
  data: VisitAnalyticsDetail;
};

export function AdminAnalyticsDashboard({ data }: AdminAnalyticsDashboardProps) {
  const maxDaily = Math.max(1, ...data.daily.map((row) => Math.max(row.visits, row.page_views, row.total_swipes)));
  const maxHourly = Math.max(1, ...data.hourly.map((row) => row.visits));
  const maxPage = Math.max(1, ...data.pages.map((row) => row.visits));
  const sourceTotal = Math.max(1, Object.values(data.sources).reduce((sum, count) => sum + count, 0));

  return (
    <div className="analytics-dashboard">
      <section className="status-band">
        <div className="section-title-row">
          <div>
            <h1>アクセス分析</h1>
            <p>来訪・PV・スワイプ・登録導線を分けて確認できます。管理者操作のいいねや表示増加とは別の集計です。</p>
          </div>
          <a className="secondary-button" href="/admin">管理画面へ戻る</a>
        </div>
        <div className="analytics-tab-links" aria-label="分析メニュー">
          <a href="#overview-analysis">全体</a>
          <a href="#viewer-analysis">視聴者側</a>
          <a href="#creator-analysis">配信者側</a>
          <a href="#diagnosis-analysis">診断</a>
        </div>
      </section>

      <section id="overview-analysis" className="status-band">
        <div className="section-title-row">
          <div>
            <h2>全体サマリー</h2>
            <p>アクセスはサイトに来た数、PVはページ閲覧数、スワイプは操作回数です。</p>
          </div>
        </div>
        <div className="admin-metrics">
          <Metric value={data.summary.today} label="今日の訪問者" />
          <Metric value={data.summary.week} label="7日間の訪問者" />
          <Metric value={data.summary.total} label="全期間の訪問者" />
          <Metric value={data.summary.page_views} label="PV数" />
          <Metric value={data.summary.average_duration_seconds} label="平均滞在秒数" />
          <Metric value={data.summary.average_swipes} label="訪問者あたり平均スワイプ" />
        </div>
      </section>

      <section id="viewer-analysis" className="status-band">
        <div className="section-title-row">
          <div>
            <h2>視聴者側分析</h2>
            <p>未登録・視聴者ログイン・スワイプ・視聴者登録導線の反応です。</p>
          </div>
        </div>
        <div className="admin-metrics">
          <Metric value={data.summary.guest_visits} label="未登録ユーザー訪問" />
          <Metric value={data.summary.viewer_visits} label="視聴者ログイン訪問" />
          <Metric value={data.eventSummary.swiped_visitors} label="1回以上スワイプした人" />
          <Metric value={data.eventSummary.total_swipes} label="総スワイプ数" />
          <Metric value={data.eventSummary.viewer_register_clicks} label="視聴者登録へ進んだ人" />
          <Metric value={data.eventSummary.today_total_swipes} label="今日のスワイプ数" />
        </div>
      </section>

      <section id="creator-analysis" className="status-band">
        <div className="section-title-row">
          <div>
            <h2>配信者側分析</h2>
            <p>配信者ログイン、配信者登録導線、掲載ページを見る動きです。</p>
          </div>
        </div>
        <div className="admin-metrics">
          <Metric value={data.summary.creator_visits} label="配信者ログイン訪問" />
          <Metric value={data.eventSummary.creator_register_clicks} label="配信者登録へ進んだ人" />
          <Metric value={data.eventSummary.today_creator_register_clicks} label="今日の配信者登録導線" />
          <Metric value={data.summary.page_views} label="PV数" />
        </div>
      </section>

      <section className="status-band analytics-chart-panel">
        <h2>日別の動き</h2>
        <p className="help-text">青=訪問者、紫=PV、シアン=総スワイプ、黄=登録導線です。</p>
        <div className="daily-chart" role="img" aria-label="日別の訪問者数、PV数、スワイプ数、登録導線数">
          {data.daily.map((row) => (
            <div className="daily-chart-row" key={row.date}>
              <span className="chart-label">{formatShortDate(row.date)}</span>
              <div className="daily-bars">
                <span className="bar visit-bar" style={{ width: `${(row.visits / maxDaily) * 100}%` }} title={`訪問者 ${row.visits}`} />
                <span className="bar pageview-bar" style={{ width: `${(row.page_views / maxDaily) * 100}%` }} title={`PV ${row.page_views}`} />
                <span className="bar swipe-bar" style={{ width: `${(row.total_swipes / maxDaily) * 100}%` }} title={`スワイプ ${row.total_swipes}`} />
                <span className="bar register-bar" style={{ width: `${((row.viewer_register_clicks + row.creator_register_clicks) / maxDaily) * 100}%` }} title={`登録導線 ${row.viewer_register_clicks + row.creator_register_clicks}`} />
              </div>
              <span className="chart-value">{row.visits}</span>
            </div>
          ))}
        </div>
        <div className="chart-legend">
          <span><i className="visit-dot" />訪問者</span>
          <span><i className="pageview-dot" />PV</span>
          <span><i className="swipe-dot" />スワイプ</span>
          <span><i className="register-dot" />登録導線</span>
        </div>
      </section>

      <section className="status-band analytics-chart-panel">
        <h2>時間帯別の訪問者</h2>
        <div className="hour-chart" role="img" aria-label="時間帯別の訪問者数">
          {data.hourly.map((row) => (
            <div className="hour-column" key={row.hour}>
              <span className="hour-bar" style={{ height: `${Math.max(3, (row.visits / maxHourly) * 100)}%` }} title={`${row.hour}時 ${row.visits}`} />
              <span>{row.hour}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="analytics-two-column">
        <section className="status-band analytics-chart-panel">
          <h2>流入元</h2>
          <StackedSource sources={data.sources} total={sourceTotal} />
        </section>
        <section className="status-band analytics-chart-panel">
          <h2>よく見られたページ</h2>
          <div className="page-rank-list">
            {data.pages.length ? data.pages.map((row) => (
              <div className="page-rank-row" key={row.path}>
                <span>{row.path}</span>
                <div><i style={{ width: `${(row.visits / maxPage) * 100}%` }} /></div>
                <strong>{row.visits}</strong>
              </div>
            )) : <p className="help-text">ページ別データはこれから蓄積されます。</p>}
          </div>
        </section>
      </div>

      <section id="diagnosis-analysis" className="status-band">
        <div className="section-title-row">
          <div>
            <h2>診断分析</h2>
            <p>診断した人の名前、結果、回答内容を確認できます。今後のおすすめ表示や広告改善の参考データです。</p>
          </div>
        </div>
        <div className="admin-metrics">
          <Metric value={data.diagnosis.total} label="診断完了数" />
          <Metric value={data.diagnosis.streamer} label="30問診断" />
          <Metric value={data.diagnosis.advanced} label="100問診断" />
          <Metric value={data.diagnosis.viewer} label="リスナー相性診断" />
        </div>
        <DiagnosisTypeSummary rows={data.diagnosis.byType} />
        <DiagnosisResultList rows={data.diagnosis.recent} />
      </section>
    </div>
  );
}

function DiagnosisTypeSummary({ rows }: { rows: VisitAnalyticsDetail["diagnosis"]["byType"] }) {
  if (!rows.length) return <p className="help-text">診断結果はまだありません。</p>;
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="page-rank-list diagnosis-type-summary">
      {rows.slice(0, 10).map((row) => (
        <div className="page-rank-row" key={row.type}>
          <span>{row.type}</span>
          <div><i style={{ width: `${(row.count / max) * 100}%` }} /></div>
          <strong>{row.count}</strong>
        </div>
      ))}
    </div>
  );
}

function DiagnosisResultList({ rows }: { rows: VisitAnalyticsDetail["diagnosis"]["recent"] }) {
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const diff = timestampValue(a.createdAt) - timestampValue(b.createdAt);
        return sortDirection === "asc" ? diff : -diff;
      }),
    [rows, sortDirection]
  );

  if (!rows.length) return <p className="help-text">診断した人の一覧はまだありません。</p>;
  return (
    <div className="diagnosis-admin-list">
      <div className="diagnosis-list-toolbar">
        <span>診断日時で並び替え</span>
        <button
          className="secondary-button compact"
          type="button"
          onClick={() => setSortDirection((current) => (current === "desc" ? "asc" : "desc"))}
        >
          {sortDirection === "desc" ? "新しい順" : "古い順"}
        </button>
      </div>
      {sortedRows.map((row) => (
        <details className="diagnosis-admin-card" key={row.id}>
          <summary>
            <span>{row.vtuberName}</span>
            <b>{row.lightTypeCode ? `${row.lightTypeCode}: ${row.lightType}` : row.lightType}</b>
            <small>{modeLabel(row.diagnosisMode)} / {formatDateTime(row.createdAt)}</small>
          </summary>
          <div className="diagnosis-admin-detail">
            <ScoreMiniList scores={row.lightScores} />
            <div className="diagnosis-answer-table">
              {row.answerDetails.length ? row.answerDetails.map((answer) => (
                <div key={`${row.id}-${answer.questionId || answer.number}`}>
                  <span>Q{answer.number}</span>
                  <p>{answer.question || answer.questionId}</p>
                  <strong>{answer.answer}</strong>
                </div>
              )) : Object.entries(row.answers).map(([key, value]) => (
                <div key={`${row.id}-${key}`}>
                  <span>{key}</span>
                  <p>保存済み回答</p>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}

function ScoreMiniList({ scores }: { scores: Record<string, number> }) {
  const labels: Record<string, string> = {
    f: "テンション",
    t: "交流",
    a: "企画",
    n: "キャラ",
    v: "コンテンツ",
    d: "関係性",
  };
  return (
    <div className="diagnosis-score-mini">
      {Object.entries(labels).map(([key, label]) => (
        <span key={key}>{label}: {Number(scores[key] || 0)}</span>
      ))}
    </div>
  );
}

function modeLabel(mode: string) {
  if (mode === "viewer") return "リスナー";
  if (mode === "advanced") return "100問";
  return "30問";
}

function formatDateTime(value: string | null) {
  if (!value) return "日時不明";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timestampValue(value: string | null) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="metric">
      <strong>{Number(value || 0).toLocaleString("ja-JP")}</strong>
      <span>{label}</span>
    </div>
  );
}

function StackedSource({ sources, total }: { sources: VisitAnalyticsDetail["sources"]; total: number }) {
  const labels: Array<[keyof VisitAnalyticsDetail["sources"], string]> = [
    ["organic", "検索"],
    ["direct", "直接"],
    ["social", "SNS"],
    ["referral", "外部リンク"],
    ["ads", "広告"],
  ];
  return (
    <div className="source-stack">
      {labels.map(([key, label]) => (
        <div className="source-row" key={key}>
          <span>{label}</span>
          <div><i style={{ width: `${(sources[key] / total) * 100}%` }} /></div>
          <strong>{sources[key]}</strong>
        </div>
      ))}
    </div>
  );
}

function formatShortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${month}/${day}`;
}
