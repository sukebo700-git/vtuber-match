"use client";

import { useEffect, useState } from "react";
import { getViewerIdentity } from "@/lib/viewerIdentity";

type ReceivedLike = {
  streamer_id: string;
  streamer_name: string;
  streamer_thumbnail: string;
  liked_at: string | null;
};

type LikesResponse = {
  count: number;
  tier: "guest" | "free" | "elite";
  likes: ReceivedLike[];
};

type Status = "loading" | "ready" | "error";

export function ViewerStreamerLikesList() {
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<LikesResponse | null>(null);

  // このページを訪れたら、ヘッダーメニューの「いいねが届きました」印を既読にして消す。
  // ログインしていないと/api/notificationsは401を返すだけなので、
  // 未登録・匿名ユーザーでは何も起きない(catchで握りつぶす)。
  useEffect(() => {
    fetch("/api/notifications")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const notifications = Array.isArray(data?.notifications) ? data.notifications : [];
        const unread = notifications.filter((item: { type?: string; read?: boolean }) => item.type === "STREAMER_LIKE_RECEIVED" && !item.read);
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
    const identity = getViewerIdentity();
    fetch(`/api/viewer-streamer-likes?id=${encodeURIComponent(identity.id)}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: LikesResponse) => {
        setData(body);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  if (status === "loading") return <p className="help-text">読み込んでいます...</p>;
  if (status === "error" || !data) {
    return (
      <section className="status-band">
        <p>読み込めませんでした。時間をおいてもう一度お試しください。</p>
      </section>
    );
  }

  return (
    <>
      <section className="status-band">
        <h1>VTuberからのいいね</h1>
        <p>{data.count}件のいいねが届いています。</p>
      </section>

      {data.tier === "elite" ? (
        data.likes.length === 0 ? (
          <section className="status-band">
            <p>まだいいねは届いていません。</p>
          </section>
        ) : (
          <section className="status-band">
            <ul className="match-list">
              {data.likes.map((like) => (
                <li key={like.streamer_id} className="match-list-item">
                  {like.streamer_thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={like.streamer_thumbnail} alt={like.streamer_name} className="match-list-thumb" />
                  )}
                  <div>
                    <p className="match-list-name">{like.streamer_name || "VTuber"}</p>
                    {like.liked_at && (
                      <p className="help-text">
                        {new Date(like.liked_at).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}にいいね
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      ) : data.count > 0 ? (
        <section className="status-band push-notice-card">
          <div>
            <h2>誰からいいねされたか気になりませんか？</h2>
            <p>
              {data.tier === "guest"
                ? "無料登録・エリートファンになると、送信元のVTuberを確認できます。"
                : "エリートファンになると、送信元のVTuberを確認できます。"}
            </p>
          </div>
          <p className="inline-actions">
            {data.tier === "guest" ? (
              <a className="primary-button" href="/viewer/register">無料登録する</a>
            ) : (
              <a className="primary-button" href="/viewer/upgrade">エリートファンを見る</a>
            )}
          </p>
        </section>
      ) : (
        <section className="status-band">
          <p>まだいいねは届いていません。</p>
        </section>
      )}
    </>
  );
}
