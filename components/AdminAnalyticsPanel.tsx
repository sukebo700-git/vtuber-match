import type { AdminAnalyticsSummary } from "@/lib/analytics";

type AdminAnalyticsPanelProps = {
  analytics: AdminAnalyticsSummary;
};

export function AdminAnalyticsPanel({ analytics }: AdminAnalyticsPanelProps) {
  return (
    <section className="status-band">
      <div className="section-title-row">
        <div>
          <h2>アクセス・スワイプ集計</h2>
          <p>アクセスはサイト訪問、スワイプは画面内の操作として分けて確認します。</p>
        </div>
        <a className="secondary-button" href="/admin/analytics">詳細分析を見る</a>
      </div>
      <div className="admin-metrics">
        <div className="metric">
          <strong>{analytics.swiped_visitors}</strong>
          <span>1回以上スワイプした人</span>
        </div>
        <div className="metric">
          <strong>{analytics.total_swipes}</strong>
          <span>総スワイプ数</span>
        </div>
        <div className="metric">
          <strong>{analytics.viewer_register_clicks}</strong>
          <span>視聴者登録へ進んだ人</span>
        </div>
        <div className="metric">
          <strong>{analytics.creator_register_clicks}</strong>
          <span>配信者登録へ進んだ人</span>
        </div>
      </div>
    </section>
  );
}
