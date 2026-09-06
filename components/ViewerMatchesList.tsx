"use client";

import { useEffect, useState } from "react";
import { getViewerIdentity } from "@/lib/viewerIdentity";
import { youtubeSubscribeUrl } from "@/lib/youtube";

type MatchItem = {
  streamer_id: string;
  streamer_name: string;
  streamer_thumbnail: string;
  streamer_youtube_url: string;
  matched_at: string | null;
};

type MatchesResponse = {
  matches: MatchItem[];
  tier: "guest" | "free" | "elite";
  limit: number;
  total: number;
};

type Status = "loading" | "ready" | "error";

// lib/streamers.ts の publicStreamerSlug/publicStreamerPath と同じロジック。
// あちらは firebase-admin を読み込むサーバー専用モジュールなので、
// クライアントコンポーネントであるここでは同じ生成規則をそのまま複製する。
function slugifyStreamerName(value: string) {
  const slug = value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "vtuber";
}

function publicStreamerPath(id: string, name: string) {
  const base = slugifyStreamerName(name || "vtuber");
  return `/vtuber/${base}--${encodeURIComponent(id)}`;
}

export function ViewerMatchesList() {
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<MatchesResponse | null>(null);

  // このページを訪れたら、ヘッダーメニューの「マッチしました」印を既読にして消す。
  // ログインしていないと/api/notificationsは401を返すだけなので、
  // 未登録・匿名ユーザーでは何も起きない(catchで握りつぶす)。
  useEffect(() => {
    fetch("/api/notifications")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const notifications = Array.isArray(data?.notifications) ? data.notifications : [];
        const unreadMatchNotices = notifications.filter((item: { type?: string; read?: boolean }) => item.type === "MATCH_CREATED" && !item.read);
        return Promise.all(unreadMatchNotices.map((item: { id: string }) => (
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
    fetch(`/api/viewer-matches?id=${encodeURIComponent(identity.id)}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: MatchesResponse) => {
        setData(body);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  if (status === "loading") return <p className="help-text">読み込んでいます...</p>;
  if (status === "error" || !data) {
    return (
      <section className="status-band">
        <p>マッチ一覧を読み込めませんでした。時間をおいてもう一度お試しください。</p>
      </section>
    );
  }

  const hidden = Math.max(0, data.total - data.matches.length);

  return (
    <>
      <section className="status-band">
        <h1>マッチ一覧</h1>
        <p>いいねしたVTuberの一覧です。{data.total}件中{data.matches.length}件を表示しています。</p>
      </section>

      {data.matches.length === 0 && (
        <section className="status-band">
          <p>まだマッチがありません。スワイプで気になるVTuberにいいねしてみましょう。</p>
          <p className="inline-actions" style={{ marginTop: 12 }}>
            <a className="primary-button" href="/swipe">VTuberを探す</a>
          </p>
        </section>
      )}

      {data.matches.length > 0 && (
        <section className="status-band">
          <ul className="match-list">
            {data.matches.map((match) => (
              <li key={match.streamer_id} className="match-list-item">
                {match.streamer_thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={match.streamer_thumbnail} alt={match.streamer_name} className="match-list-thumb" />
                )}
                <div>
                  <p className="match-list-name">{match.streamer_name || "VTuber"}</p>
                  {match.matched_at && (
                    <p className="help-text">
                      {new Date(match.matched_at).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}にマッチ
                    </p>
                  )}
                </div>
                <div className="match-list-actions">
                  <a
                    className="primary-button"
                    href={publicStreamerPath(match.streamer_id, match.streamer_name)}
                  >
                    プロフィールを見る
                  </a>
                  {match.streamer_youtube_url && (
                    <a
                      className="secondary-button"
                      href={youtubeSubscribeUrl(match.streamer_youtube_url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      チャンネルへ
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hidden > 0 && data.tier === "guest" && (
        <section className="status-band push-notice-card">
          <div>
            <h2>あと{hidden}件のマッチがあります</h2>
            <p>無料登録するとマッチ履歴を最新5件まで見られます。</p>
          </div>
          <p className="inline-actions">
            <a className="primary-button" href="/viewer/register">無料登録する</a>
          </p>
        </section>
      )}

      {hidden > 0 && data.tier === "free" && (
        <section className="status-band push-notice-card">
          <div>
            <h2>あと{hidden}件のマッチがあります</h2>
            <p>エリートファンになるとマッチ履歴を無制限に見られます。</p>
          </div>
          <p className="inline-actions">
            <a className="primary-button" href="/viewer/upgrade">エリートファンを見る</a>
          </p>
        </section>
      )}
    </>
  );
}
