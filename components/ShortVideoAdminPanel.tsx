"use client";

import { useEffect, useState } from "react";

type ShortVideoAdminRequest = {
  id: string;
  streamer_id: string;
  application_id: string;
  name: string;
  email: string;
  youtube_url: string;
  x_account: string;
  one_liner: string;
  plan_type: string;
  appeal_points: string;
  notes: string;
  status: string;
  youtube_video_id: string;
  requested_at?: string;
  updated_at?: string;
};

type ShortVideoAdminPanelProps = {
  adminKey: string;
};

const statusLabels: Record<string, string> = {
  open: "依頼受付(同期対象)",
  published: "対応済み",
  rejected: "見送り",
};

const statusOrder = ["open", "published", "rejected"];

export function ShortVideoAdminPanel({ adminKey }: ShortVideoAdminPanelProps) {
  const [requests, setRequests] = useState<ShortVideoAdminRequest[]>([]);
  const [videoDrafts, setVideoDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [showPublished, setShowPublished] = useState(false);

  useEffect(() => {
    fetch("/api/admin/short-video-requests", { headers: adminHeaders(adminKey) })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setRequests((data?.requests as ShortVideoAdminRequest[]) || []))
      .catch(() => setRequests([]))
      .finally(() => setLoaded(true));
  }, [adminKey]);

  async function update(id: string, patch: { status?: string; youtube_video?: string }) {
    setBusyId(id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/short-video-requests/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...adminHeaders(adminKey) },
        body: JSON.stringify(patch),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.error || "更新に失敗しました。");
        return;
      }
      setRequests((current) => current.map((item) => (
        item.id === id
          ? { ...item, status: data.request?.status || item.status, youtube_video_id: data.request?.youtube_video_id ?? item.youtube_video_id }
          : item
      )));
      setMessage("更新しました。");
    } catch {
      setMessage("通信に失敗しました。");
    } finally {
      setBusyId("");
    }
  }

  if (!loaded) {
    return (
      <section className="status-band">
        <h2>紹介ショート動画の依頼</h2>
        <p>読み込み中...</p>
      </section>
    );
  }

  const visibleRequests = showPublished ? requests : requests.filter((request) => request.status !== "published");
  const publishedCount = requests.length - requests.filter((request) => request.status !== "published").length;
  const sorted = [...visibleRequests].sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));

  return (
    <section className="status-band">
      <h2>紹介ショート動画の依頼({visibleRequests.length}件)</h2>
      <p>
        「依頼受付」の依頼は動画ジェネレーターの同期対象になります(台本はジェネレーター側で人力作成)。
        動画が公開されると自動でURLが反映され「対応済み」になり、この一覧からは自動的に外れます。
      </p>
      {publishedCount > 0 && (
        <label className="choice">
          <input type="checkbox" checked={showPublished} onChange={(event) => setShowPublished(event.target.checked)} />
          対応済み({publishedCount}件)も表示する
        </label>
      )}
      {message ? <p className="form-status">{message}</p> : null}
      {sorted.length === 0 ? <p>{showPublished ? "依頼はまだありません。" : "対応待ちの依頼はありません。"}</p> : null}
      {sorted.map((request) => (
        <article className="admin-card" key={request.id}>
          <header>
            <strong>{request.name || request.id}</strong>
            <span className="badge">{statusLabels[request.status] || request.status}</span>
            <span className="badge">{request.plan_type}</span>
          </header>
          <ul>
            {request.youtube_url ? (
              <li>
                <a href={request.youtube_url} target="_blank" rel="noreferrer">{request.youtube_url}</a>
              </li>
            ) : null}
            {request.x_account ? <li>X: {request.x_account}</li> : null}
            {request.one_liner ? <li>ひとこと: {request.one_liner}</li> : null}
            {request.appeal_points ? <li>アピール: {request.appeal_points}</li> : null}
            {request.notes ? <li>連絡事項: {request.notes}</li> : null}
            <li>依頼日時: {formatDate(request.requested_at)}</li>
            {request.youtube_video_id ? (
              <li>
                動画: <a href={`https://www.youtube.com/watch?v=${request.youtube_video_id}`} target="_blank" rel="noreferrer">
                  {request.youtube_video_id}
                </a>
              </li>
            ) : null}
          </ul>
          <div className="admin-card-actions">
            {request.status !== "published" ? (
              <>
                <input
                  type="text"
                  placeholder="公開したYouTube動画のURL"
                  value={videoDrafts[request.id] ?? ""}
                  onChange={(event) => setVideoDrafts((current) => ({ ...current, [request.id]: event.target.value }))}
                />
                <button
                  className="primary-button"
                  type="button"
                  disabled={busyId === request.id}
                  onClick={() => update(request.id, { status: "published", youtube_video: videoDrafts[request.id] || "" })}
                >
                  対応済みにする
                </button>
              </>
            ) : null}
            {request.status === "open" ? (
              <button
                className="secondary-button"
                type="button"
                disabled={busyId === request.id}
                onClick={() => update(request.id, { status: "rejected" })}
              >
                見送りにする
              </button>
            ) : null}
            {request.status === "rejected" ? (
              <button
                className="secondary-button"
                type="button"
                disabled={busyId === request.id}
                onClick={() => update(request.id, { status: "open" })}
              >
                受付に戻す
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </section>
  );
}

function adminHeaders(adminKey: string): Record<string, string> {
  return adminKey ? { "x-admin-key": adminKey } : {};
}

function formatDate(value?: string) {
  if (!value) return "未記録";
  return new Date(value).toLocaleString("ja-JP");
}
