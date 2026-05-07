type VisitStatsPanelProps = {
  stats: {
    today: number;
    week: number;
    total: number;
  };
};

export function VisitStatsPanel({ stats }: VisitStatsPanelProps) {
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
    </section>
  );
}
