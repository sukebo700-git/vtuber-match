"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { CATEGORIES, TAGS } from "@/lib/constants";

type CreatorDraft = {
  name?: string;
  youtube_url?: string;
  description?: string;
  one_liner?: string;
  stream_time?: string;
  image?: string;
  categories?: string[];
  tags?: string[];
};

const creatorDraftKey = "vtuber-match-creator-profile-draft";

export function CreatorProfileEditForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [description, setDescription] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [streamTime, setStreamTime] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [image, setImage] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const draft = safeParseDraft(localStorage.getItem(creatorDraftKey));
    setEmail(localStorage.getItem("vtuber-match-creator-email") || "");
    setName(draft?.name || localStorage.getItem("vtuber-match-creator-name") || "");
    setYoutubeUrl(draft?.youtube_url || localStorage.getItem("vtuber-match-creator-youtube-url") || "");
    setDescription(draft?.description || "");
    setOneLiner(draft?.one_liner || "");
    setStreamTime(draft?.stream_time || "");
    setImage(draft?.image || "");
    setCategories(Array.isArray(draft?.categories) ? draft.categories : []);
    setTags(Array.isArray(draft?.tags) ? draft.tags : []);
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("プロフィールを更新しています...");

    const response = await fetch("/api/profile-edits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        application_id: localStorage.getItem("vtuber-match-creator-application-id") || "",
        streamer_id: localStorage.getItem("vtuber-match-creator-streamer-id") || "",
        creator_login_id: localStorage.getItem("vtuber-match-creator-login-id") || "",
        youtube_url: form.get("youtube_url"),
        name: form.get("name"),
        description: form.get("description"),
        one_liner: form.get("one_liner"),
        stream_time: form.get("stream_time"),
        image,
        categories,
        tags,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.error || "更新に失敗しました。メールアドレスとパスワードを確認してください。");
      return;
    }

    const nextDraft = {
      name: String(form.get("name") || ""),
      youtube_url: String(form.get("youtube_url") || ""),
      description: String(form.get("description") || ""),
      one_liner: String(form.get("one_liner") || ""),
      stream_time: String(form.get("stream_time") || ""),
      image,
      categories,
      tags,
    };

    localStorage.setItem("vtuber-match-creator-name", nextDraft.name);
    localStorage.setItem("vtuber-match-creator-youtube-url", nextDraft.youtube_url);
    localStorage.setItem(creatorDraftKey, JSON.stringify(nextDraft));
    window.dispatchEvent(new Event("vtuber-match-auth-changed"));
    setStatus("プロフィールを更新しました。");
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const nextImage = await fileToDataUrl(file);
    setImage(nextImage);
    if (!nextImage) setStatus("画像が大きすぎます。別の画像を選んでください。");
  }

  function toggle(list: string[], setList: (value: string[]) => void, value: string, max: number) {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value].slice(0, max));
  }

  return (
    <form className="form compact-form" onSubmit={submit}>
      <section className="status-band soft">
        <h2>プロフィール修正</h2>
        <p>申し込み時に入力した配信者名やYouTubeチャンネルURLは、この画面にも引き継がれます。</p>
      </section>

      <div className="field">
        <label htmlFor="edit_email">登録メールアドレス</label>
        <input id="edit_email" name="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="edit_password">パスワード</label>
        <input id="edit_password" name="password" type="password" required placeholder="申し込み時のパスワード" />
      </div>

      <div className="field">
        <label htmlFor="edit_youtube">YouTubeチャンネルURL</label>
        <input id="edit_youtube" name="youtube_url" type="url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://www.youtube.com/@channel" />
      </div>

      <div className="field">
        <label htmlFor="edit_name">配信者名</label>
        <input id="edit_name" name="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="変更する場合のみ入力" />
      </div>

      <div className="field">
        <label htmlFor="edit_one_liner">今日のひとこと</label>
        <input id="edit_one_liner" name="one_liner" value={oneLiner} onChange={(event) => setOneLiner(event.target.value)} maxLength={80} />
      </div>

      <div className="field">
        <label htmlFor="edit_description">自己アピール</label>
        <textarea id="edit_description" name="description" value={description} onChange={(event) => setDescription(event.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="edit_stream_time">配信時間帯</label>
        <input id="edit_stream_time" name="stream_time" value={streamTime} onChange={(event) => setStreamTime(event.target.value)} placeholder="例: 平日22時から24時" />
      </div>

      <div className="field">
        <label htmlFor="edit_image">プロフィール画像</label>
        <input id="edit_image" type="file" accept="image/*" onChange={onFile} />
        {image && (
          <div className="image-preview-row">
            <img src={image} alt="修正画像" />
          </div>
        )}
      </div>

      <div className="field">
        <label>カテゴリ {categories.length}/3</label>
        <div className="choice-grid dense">
          {CATEGORIES.map((category) => (
            <label className="choice" key={category}>
              <input type="checkbox" checked={categories.includes(category)} onChange={() => toggle(categories, setCategories, category, 3)} />
              {category}
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <label>タグ {tags.length}/5</label>
        <div className="choice-grid dense">
          {TAGS.map((tag) => (
            <label className="choice" key={tag}>
              <input type="checkbox" checked={tags.includes(tag)} onChange={() => toggle(tags, setTags, tag, 5)} />
              {tag}
            </label>
          ))}
        </div>
      </div>

      <button className="primary-button" type="submit">
        <Save size={18} />
        プロフィールを更新する
      </button>
      {status && <p className="notice-text">{status}</p>}
    </form>
  );
}

function safeParseDraft(value: string | null): CreatorDraft | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as CreatorDraft;
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
