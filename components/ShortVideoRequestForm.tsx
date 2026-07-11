"use client";

import { useEffect, useState } from "react";

type Profile = {
  streamer_id?: string;
  name?: string;
  youtube_url?: string;
  x_account?: string;
  one_liner?: string;
  image?: string;
  plan_type?: string;
};

type ShortVideoRequest = {
  id: string;
  status: string;
  appeal_points: string;
  notes: string;
  intro_text: string;
  youtube_video_id: string;
  requested_at?: string;
  updated_at?: string;
};

const statusLabels: Record<string, string> = {
  open: "依頼を受け付けました(順番に制作します)",
  published: "公開されました",
  rejected: "今回は見送りになりました",
};

const lockedStatuses = ["published"];

export function ShortVideoRequestForm() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [existing, setExisting] = useState<ShortVideoRequest | null>(null);
  const [appealPoints, setAppealPoints] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/profile-edits").then((response) => (response.ok ? response.json() : null)).catch(() => null),
      fetch("/api/short-video-requests").then((response) => (response.ok ? response.json() : null)).catch(() => null),
    ])
      .then(([profileData, requestData]) => {
        setProfile(profileData?.profile || null);
        const request = (requestData?.request as ShortVideoRequest | null) || null;
        setExisting(request);
        if (request) {
          setAppealPoints(request.appeal_points || "");
          setNotes(request.notes || "");
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus("送信しています...");
    try {
      const response = await fetch("/api/short-video-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appeal_points: appealPoints, notes }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(data.error || "送信できませんでした。配信者としてログインしているか確認してください。");
        return;
      }
      setExisting((current) => ({
        id: current?.id || "",
        status: "open",
        appeal_points: appealPoints,
        notes,
        intro_text: current?.intro_text || "",
        youtube_video_id: current?.youtube_video_id || "",
      }));
      setStatus("依頼を受け付けました。運営が内容を確認し、順番に制作します。");
    } catch {
      setStatus("通信に失敗しました。時間をおいてもう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return <section className="status-band"><p>読み込み中...</p></section>;
  }

  if (!profile?.name) {
    return (
      <section className="status-band">
        <h2>紹介ショート動画の依頼</h2>
        <p>紹介ショート動画の依頼には配信者ログインが必要です。</p>
        <div className="creator-hero-actions">
          <a className="primary-button" href="/login">配信者ログイン</a>
          <a className="secondary-button" href="/creator/apply">無料掲載を申し込む</a>
        </div>
      </section>
    );
  }

  const locked = Boolean(existing && lockedStatuses.includes(existing.status));

  return (
    <>
      <section className="status-band">
        <h2>登録済みの情報(自動で使われます)</h2>
        <p>掲載プロフィールの情報をそのまま動画素材に使います。修正したい場合は先にプロフィール修正をしてください。</p>
        <ul>
          <li>名前: {profile.name}</li>
          {profile.youtube_url ? <li>YouTube: {profile.youtube_url}</li> : null}
          {profile.x_account ? <li>X: {profile.x_account}</li> : null}
          {profile.one_liner ? <li>ひとこと: {profile.one_liner}</li> : null}
        </ul>
        <p className="help-text">
          下の「アピールしたいポイント」が空の場合は、この「ひとこと」がそのまま動画のナレーション・テロップになります。誤字や記載漏れがないようご注意ください。
        </p>
        <a className="secondary-button" href="/creator/edit">プロフィールを修正する</a>
      </section>

      {existing ? (
        <section className="status-band">
          <h2>依頼ステータス</h2>
          <p>{statusLabels[existing.status] || existing.status}</p>
          {existing.status === "published" && existing.youtube_video_id ? (
            <a
              className="primary-button"
              href={`https://www.youtube.com/shorts/${existing.youtube_video_id}`}
              target="_blank"
              rel="noreferrer"
            >
              公開された動画を見る
            </a>
          ) : null}
        </section>
      ) : null}

      {locked ? null : (
        <section className="status-band">
          <h2>{existing ? "依頼内容を修正する" : "紹介ショート動画を依頼する"}</h2>
          <form className="form" onSubmit={submit}>
            <div className="field">
              <label htmlFor="short_video_appeal">アピールしたいポイント(300文字まで)</label>
              <p className="help-text">
                ここに書いた内容が、そのまま動画のナレーション・テロップになります。誤字や記載漏れがないようご注意ください。
              </p>
              <textarea
                id="short_video_appeal"
                value={appealPoints}
                maxLength={300}
                rows={5}
                placeholder="例: 歌枠がメインで、毎週金曜21時から配信しています。落ち着いた雰囲気の雑談も人気です。"
                onChange={(event) => setAppealPoints(event.target.value.slice(0, 300))}
              />
            </div>
            <div className="field">
              <label htmlFor="short_video_notes">運営への連絡事項(任意・200文字まで)</label>
              <textarea
                id="short_video_notes"
                value={notes}
                maxLength={200}
                rows={3}
                placeholder="例: この画像は使わないでほしい、名前の読み方 など"
                onChange={(event) => setNotes(event.target.value.slice(0, 200))}
              />
            </div>
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? "送信中..." : existing ? "依頼内容を更新する" : "依頼を送信する"}
            </button>
            {status ? <p className="form-status">{status}</p> : null}
          </form>
        </section>
      )}
    </>
  );
}
