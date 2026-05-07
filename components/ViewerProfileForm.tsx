"use client";

import { useEffect, useState } from "react";
import { Heart, HeartHandshake, Save } from "lucide-react";
import { CATEGORIES } from "@/lib/constants";
import type { ViewerProfile } from "@/lib/types";

const storageKey = "vtuber-match-viewer-profile";
const idKey = "vtuber-match-viewer-id";
const authKey = "vtuber-match-viewer-auth";

const emptyProfile: ViewerProfile = {
  id: "",
  email: "",
  viewer_login_id: "",
  display_name: "",
  youtube_display_name: "",
  image: "",
  profile: "",
  favorite_categories: [],
  visible_to_matched_streamers: true,
  match_count: 0,
  streamer_like_count: 0
};

export function ViewerProfileForm() {
  const [profile, setProfile] = useState<ViewerProfile>(emptyProfile);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const id = localStorage.getItem(idKey) || crypto.randomUUID();
    localStorage.setItem(idKey, id);
    const auth = safeParse(localStorage.getItem(authKey));
    const saved = localStorage.getItem(storageKey);
    const stored = saved ? JSON.parse(saved) : {};
    const nextProfile = {
      ...emptyProfile,
      ...stored,
      id,
      email: auth?.email || stored.email || "",
      viewer_login_id: auth?.viewer_login_id || stored.viewer_login_id || ""
    };
    setProfile(nextProfile);

    fetch(`/api/viewer-profile?id=${encodeURIComponent(id)}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.profile) {
          setProfile((current) => ({
            ...current,
            ...data.profile,
            id,
            email: data.profile.email || current.email || "",
            viewer_login_id: data.profile.viewer_login_id || current.viewer_login_id || "",
            match_count: data.profile.match_count || 0,
            streamer_like_count: data.profile.streamer_like_count || 0
          }));
        }
      })
      .catch(() => undefined);
  }, []);

  function update(patch: Partial<ViewerProfile>) {
    setProfile((current) => ({ ...current, ...patch }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    localStorage.setItem(storageKey, JSON.stringify(profile));
    const auth = safeParse(localStorage.getItem(authKey)) || {};
    localStorage.setItem(authKey, JSON.stringify({
      ...auth,
      id: profile.id,
      email: profile.email,
      viewer_login_id: profile.viewer_login_id,
      name: profile.display_name || profile.youtube_display_name || profile.email || "視聴者"
    }));
    window.dispatchEvent(new Event("vtuber-match-auth-changed"));
    setStatus("保存中...");
    const response = await fetch("/api/viewer-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile)
    });
    setStatus(response.ok
      ? "保存しました。マッチした配信者があなたのプロフィールを確認できます。"
      : "保存に失敗しました。時間をおいてもう一度お試しください。");
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const image = await fileToDataUrl(file);
    update({ image });
    if (!image) setStatus("画像が大きすぎます。別の画像を選んでください。");
  }

  function toggleCategory(category: string) {
    const current = profile.favorite_categories || [];
    update({
      favorite_categories: current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category].slice(0, 5)
    });
  }

  const matchCount = profile.match_count || 0;
  const streamerLikeCount = profile.streamer_like_count || 0;

  return (
    <form className="form compact-form" onSubmit={submit}>
      <div className="viewer-score-card">
        <HeartHandshake size={26} />
        <div>
          <span>マッチ数</span>
          <strong>{matchCount}</strong>
          <p>{fanAppeal(matchCount)}</p>
        </div>
      </div>
      <div className="viewer-score-card">
        <Heart size={26} />
        <div>
          <span>配信者からのいいね</span>
          <strong>{streamerLikeCount}</strong>
          <p>{streamerLikeCount ? "配信者からも反応が届いています。" : "配信者からのいいねが届くとここに表示されます。"}</p>
        </div>
      </div>

      <dl className="data-list">
        <div><dt>視聴者ID</dt><dd>{profile.id || "未発行"}</dd></div>
        <div><dt>視聴者管理ID</dt><dd>{profile.viewer_login_id || "ログイン後に発行"}</dd></div>
        <div><dt>メール</dt><dd>{profile.email || "未登録"}</dd></div>
      </dl>

      <div className="field">
        <label htmlFor="display_name">表示名</label>
        <input id="display_name" value={profile.display_name || ""} onChange={(event) => update({ display_name: event.target.value })} placeholder="未入力でも利用できます" />
      </div>
      <div className="field">
        <label htmlFor="youtube_display_name">YouTube表示名</label>
        <input id="youtube_display_name" value={profile.youtube_display_name || ""} onChange={(event) => update({ youtube_display_name: event.target.value })} placeholder="@name など" />
      </div>
      <div className="field">
        <label htmlFor="viewer_profile">プロフィール</label>
        <textarea id="viewer_profile" value={profile.profile || ""} onChange={(event) => update({ profile: event.target.value })} placeholder="好きな配信ジャンル、応援スタイル、推し活の雰囲気など" />
      </div>
      <div className="field">
        <label htmlFor="viewer_image">プロフィール画像</label>
        <input id="viewer_image" type="file" accept="image/*" onChange={onFile} />
        {profile.image && (
          <div className="image-preview-row">
            <img src={profile.image} alt="視聴者プロフィール画像" />
          </div>
        )}
      </div>
      <div className="field">
        <label>好きなカテゴリ {profile.favorite_categories?.length || 0}/5</label>
        <div className="choice-grid dense">
          {CATEGORIES.map((category) => (
            <label className="choice" key={category}>
              <input type="checkbox" checked={profile.favorite_categories?.includes(category) || false} onChange={() => toggleCategory(category)} />
              {category}
            </label>
          ))}
        </div>
      </div>
      <label className="choice">
        <input type="checkbox" checked={profile.visible_to_matched_streamers} onChange={(event) => update({ visible_to_matched_streamers: event.target.checked })} />
        いいねした配信者にプロフィールを共有する
      </label>
      <p className="help-text">プロフィールを共有すると、マッチした配信者があなたのプロフィールを確認できます。連絡先メールは公開されません。</p>
      <button className="primary-button" type="submit">
        <Save size={18} />
        保存する
      </button>
      {status && <p className="help-text">{status}</p>}
    </form>
  );
}

function fanAppeal(matchCount: number) {
  if (matchCount >= 20) return "たくさんの配信者と出会っている、かなり積極的なファンです。";
  if (matchCount >= 5) return "気になる配信者をしっかり見つけているアクティブなファンです。";
  return "これから推しを見つけていくファンです。";
}

function safeParse(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as { email?: string; viewer_login_id?: string; name?: string };
  } catch {
    return null;
  }
}

async function fileToDataUrl(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  return dataUrl.length > 400000 ? "" : dataUrl;
}
