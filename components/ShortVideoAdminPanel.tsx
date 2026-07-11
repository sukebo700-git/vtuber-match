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
  intro_text: string;
  status: string;
  youtube_video_id: string;
  requested_at?: string;
  approved_at?: string;
  uploaded_at?: string;
  updated_at?: string;
};

type ShortVideoAdminPanelProps = {
  adminKey: string;
};

const statusLabels: Record<string, string> = {
  open: "依頼受付",
  approved: "GO済み(制作待ち)",
  rendering: "制作中",
  uploaded: "アップ済み(公開待ち)",
  published: "公開済み",
  rejected: "見送り",
};

const statusOrder = ["open", "approved", "rendering", "uploaded", "published", "rejected"];

export function ShortVideoAdminPanel({ adminKey }: ShortVideoAdminPanelProps) {
  const [requests, setRequests] = useState<ShortVideoAdminRequest[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/admin/short-video-requests", { headers: adminHeaders(adminKey) })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setRequests((data?.requests as ShortVideoAdminRequest[]) || []))
      .catch(() => setRequests([]))
      .finally(() => setLoaded(true));
  }, [adminKey]);

  async function update(id: string, patch: { intro_text?: string; status?: string }) {
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
          ? { ...item, status: data.request?.status || item.status, intro_text: data.request?.intro_text ?? item.intro_text }
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

  const sorted = [...requests].sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));

  return (
    <section className="status-band">
      <h2>紹介ショート動画の依頼({requests.length}件)</h2>
      <p>紹介テキストを入力して「GO」を押すと、ローカルの動画ワーカーが動画を制作してYouTubeへ非公開アップロードします。公開はYouTube Studioで確認後に行い、「公開済みにする」を押してください。</p>
      {message ? <p className="form-status">{message}</p> : null}
      {sorted.length === 0 ? <p>依頼はまだありません。</p> : null}
      {sorted.map((request) => {
        const draft = drafts[request.id] ?? request.intro_text;
        const locked = ["rendering", "uploaded", "published"].includes(request.status);
        return (
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
            <div className="field">
              <label htmlFor={`intro-${request.id}`}>紹介テキスト(動画のナレーション・テロップに使用、500文字まで)</label>
              <textarea
                id={`intro-${request.id}`}
                value={draft}
                rows={4}
                maxLength={500}
                disabled={locked}
                onChange={(event) => setDrafts((current) => ({ ...current, [request.id]: event.target.value.slice(0, 500) }))}
              />
            </div>
            <div className="admin-card-actions">
              {request.status === "open" || request.status === "rejected" ? (
                <button
                  className="primary-button"
                  type="button"
                  disabled={busyId === request.id || !draft.trim()}
                  onClick={() => update(request.id, { intro_text: draft, status: "approved" })}
                >
                  GO(制作を開始する)
                </button>
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
              {request.status === "approved" ? (
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busyId === request.id}
                  onClick={() => update(request.id, { intro_text: draft, status: "approved" })}
                >
                  紹介テキストを保存
                </button>
              ) : null}
              {request.status === "uploaded" ? (
                <button
                  className="primary-button"
                  type="button"
                  disabled={busyId === request.id}
                  onClick={() => update(request.id, { status: "published" })}
                >
                  公開済みにする
                </button>
              ) : null}
              {!locked && request.status !== "open" && request.status !== "rejected" ? null : null}
            </div>
          </article>
        );
      })}
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
