import type { StreamerReport } from "@/lib/types";

export function ReportAdminPanel({ reports }: { reports: StreamerReport[] }) {
  return (
    <>
      <section className="status-band">
        <h2>通報管理</h2>
        <p>詳細プロフィール下部から届いた通報を確認できます。</p>
      </section>
      <section className="admin-list wide-list">
        {reports.length ? reports.map((report) => (
          <article className="admin-card" key={report.id}>
            <div className="admin-card-head">
              <h3>{report.streamer_name || report.streamer_id}</h3>
              <span className={`state ${report.status === "reviewed" ? "approved" : "pending"}`}>
                {report.status === "reviewed" ? "確認済み" : "未確認"}
              </span>
            </div>
            <dl className="data-list">
              <div><dt>通報ID</dt><dd>{report.id}</dd></div>
              <div><dt>配信者ID</dt><dd>{report.streamer_id}</dd></div>
              <div><dt>理由</dt><dd>{report.reason}</dd></div>
              <div><dt>詳細</dt><dd>{report.detail || "未入力"}</dd></div>
              <div><dt>通報者連絡先</dt><dd>{report.reporter_contact || "未入力"}</dd></div>
              <div><dt>通報日</dt><dd>{formatDate(report.created_at)}</dd></div>
            </dl>
          </article>
        )) : (
          <article className="admin-card">
            <h3>通報はまだありません</h3>
            <p>通報が届くとここに表示されます。</p>
          </article>
        )}
      </section>
    </>
  );
}

function formatDate(value?: string) {
  if (!value) return "未記録";
  return new Date(value).toLocaleString("ja-JP");
}
