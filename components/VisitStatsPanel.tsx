type VisitStatsPanelProps = {
  stats: {
    today: number;
    week: number;
    total: number;
  };
  sources?: {
    organic: number;
    direct: number;
    social: number;
    referral: number;
    ads: number;
  };
};

export function VisitStatsPanel({ stats, sources }: VisitStatsPanelProps) {
  return (
    <section className="status-band">
      <h2>サイト訪問者数</h2>
      <div className="admin-metrics">
        <div className="metric">
          <strong>{stats.today}</strong>
          <span>今日</span>
        </div>
        <div className="metric">
          <strong>{stats.week}</strong>
          <span>7日間</span>
        </div>
        <div className="metric">
          <strong>{stats.total}</strong>
          <span>全期間</span>
        </div>
      </div>
      {sources && (
        <>
          <h3 style={{ marginTop: 18 }}>直近7日間の流入元</h3>
          <div className="admin-metrics">
            <div className="metric">
              <strong>{sources.organic}</strong>
              <span>自然検索</span>
            </div>
            <div className="metric">
              <strong>{sources.direct}</strong>
              <span>直接</span>
            </div>
            <div className="metric">
              <strong>{sources.social}</strong>
              <span>SNS</span>
            </div>
            <div className="metric">
              <strong>{sources.referral}</strong>
              <span>外部リンク</span>
            </div>
            <div className="metric">
              <strong>{sources.ads}</strong>
              <span>広告</span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
