"use client";

import { useEffect, useState } from "react";

type Candidate = {
  viewer_profile_id: string;
  display_name: string;
  image: string;
  liked_at: string | null;
};

type Status = "loading" | "ready" | "error" | "login_required";

export function CreatorViewerLikesList() {
  const [status, setStatus] = useState<Status>("loading");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [busyId, setBusyId] = useState("");
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");

  // このページを訪れたら、ヘッダーメニューの「いいねが届きました」印を既読にして消す。
  // ログインしていないと/api/notificationsは401を返すだけなので握りつぶす。
  useEffect(() => {
    fetch("/api/notifications")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const notifications = Array.isArray(data?.notifications) ? data.notifications : [];
        const unread = notifications.filter((item: { type?: string; read?: boolean }) => item.type === "LIKE_CREATED" && !item.read);
        return Promise.all(unread.map((item: { id: string }) => (
          fetch("/api/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: item.id }),
          }).catch(() => undefined)
        )));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/creator-viewers")
      .then((response) => {
        if (response.status === 401) {
          setStatus("login_required");
          return null;
        }
        return response.ok ? response.json() : Promise.reject();
      })
      .then((data) => {
        if (!data) return;
        setCandidates(Array.isArray(data?.candidates) ? data.candidates : []);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  async function likeBack(viewerId: string) {
    setBusyId(viewerId);
    setMessage("");
    const response = await fetch("/api/creator-likes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viewer_profile_id: viewerId }),
    });
    setBusyId("");
    if (!response.ok) {
      setMessage("いいね返しに失敗しました。時間をおいてもう一度お試しください。");
      return;
    }
    setLikedIds((current) => new Set(current).add(viewerId));
  }

  if (status === "loading") return <p className="help-text">読み込んでいます...</p>;
  if (status === "login_required") {
    return (
      <section className="status-band">
        <p>配信者ログインが必要です。</p>
        <p className="inline-actions" style={{ marginTop: 12 }}>
          <a className="primary-button" href="/login">配信者ログインへ</a>
        </p>
      </section>
    );
  }
  if (status === "error") {
    return (
      <section className="status-band">
        <p>一覧を読み込めませんでした。時間をおいてもう一度お試しください。</p>
      </section>
    );
  }

  return (
    <section className="status-band">
      <h1>気になるリスナー</h1>
      <p>あなたにいいねしたリスナーの一覧です。いいね返しすると、相手に通知が届きます。</p>

      {candidates.length === 0 ? (
        <p className="help-text">まだいいねが届いていません。</p>
      ) : (
        <ul className="match-list">
          {candidates.map((candidate) => (
            <li key={candidate.viewer_profile_id} className="match-list-item">
              {candidate.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={candidate.image} alt={candidate.display_name} className="match-list-thumb" />
              )}
              <div>
                <p className="match-list-name">{candidate.display_name}</p>
              </div>
              {likedIds.has(candidate.viewer_profile_id) ? (
                <span className="notification-badge active">いいね返し済み</span>
              ) : (
                <button
                  className="primary-button"
                  type="button"
                  disabled={busyId === candidate.viewer_profile_id}
                  onClick={() => likeBack(candidate.viewer_profile_id)}
                >
                  {busyId === candidate.viewer_profile_id ? "処理中..." : "いいね返し"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {message && <p className="help-text">{message}</p>}
    </section>
  );
}
