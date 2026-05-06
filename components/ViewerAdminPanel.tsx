import type { ViewerProfileWithStats } from "@/lib/types";

export function ViewerAdminPanel({ viewers }: { viewers: ViewerProfileWithStats[] }) {
  return (
    <>
      <section className="status-band">
        <h2>視聴者管理</h2>
        <p>視聴者プロフィール、好きなカテゴリ、マッチ数、ファンの積極度を確認できます。</p>
      </section>
      <section className="admin-list wide-list">
        {viewers.length ? viewers.map((viewer) => (
          <article className="admin-card" key={viewer.id}>
            <div className="admin-card-head">
              <h3>{viewer.display_name || viewer.youtube_display_name || "名前未入力"}</h3>
              <span className={`state ${viewer.fan_level === "super" ? "approved" : viewer.fan_level === "active" ? "pending" : ""}`}>
                {fanLabel(viewer.fan_level)}
              </span>
            </div>
            {viewer.image && (
              <div className="image-preview-row">
                <img src={viewer.image} alt="視聴者プロフィール画像" />
              </div>
            )}
            <dl className="data-list">
              <div><dt>視聴者ID</dt><dd>{viewer.id}</dd></div>
              <div><dt>YouTube表示名</dt><dd>{viewer.youtube_display_name || "未入力"}</dd></div>
              <div><dt>マッチ数</dt><dd>{viewer.match_count}</dd></div>
              <div><dt>好きなカテゴリ</dt><dd>{viewer.favorite_categories?.join(" / ") || "未選択"}</dd></div>
              <div><dt>プロフィール</dt><dd>{viewer.profile || "未入力"}</dd></div>
              <div><dt>配信者への共有</dt><dd>{viewer.visible_to_matched_streamers ? "共有する" : "共有しない"}</dd></div>
              <div><dt>更新日</dt><dd>{formatDate(viewer.updated_at)}</dd></div>
            </dl>
          </article>
        )) : (
          <article className="admin-card">
            <h3>視聴者プロフィールはまだありません</h3>
            <p>視聴者がプロフィールを保存するとここに表示されます。</p>
          </article>
        )}
      </section>
    </>
  );
}

function fanLabel(level: ViewerProfileWithStats["fan_level"]) {
  if (level === "super") return "積極ファン";
  if (level === "active") return "アクティブ";
  return "これから";
}

function formatDate(value?: string) {
  if (!value) return "未記録";
  return new Date(value).toLocaleString("ja-JP");
}
