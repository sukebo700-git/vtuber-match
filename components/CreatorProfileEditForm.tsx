"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { CATEGORIES, TAGS } from "@/lib/constants";

export function CreatorProfileEditForm() {
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [image, setImage] = useState("");
  const [status, setStatus] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("送信中...");
    const response = await fetch("/api/profile-edits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        youtube_url: form.get("youtube_url"),
        name: form.get("name"),
        description: form.get("description"),
        one_liner: form.get("one_liner"),
        stream_time: form.get("stream_time"),
        image,
        categories,
        tags
      })
    });
    setStatus(response.ok ? "修正申請を送信しました。運営確認後に反映されます。" : "送信に失敗しました。必須項目を確認してください。");
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
      <div className="field">
        <label htmlFor="edit_email">登録メール</label>
        <input id="edit_email" name="email" type="email" required />
      </div>
      <div className="field">
        <label htmlFor="edit_youtube">YouTube URL</label>
        <input id="edit_youtube" name="youtube_url" type="url" required />
      </div>
      <div className="field">
        <label htmlFor="edit_name">配信者名</label>
        <input id="edit_name" name="name" />
      </div>
      <div className="field">
        <label htmlFor="edit_one_liner">スワイプカードの一言</label>
        <input id="edit_one_liner" name="one_liner" maxLength={80} />
      </div>
      <div className="field">
        <label htmlFor="edit_description">自己アピール</label>
        <textarea id="edit_description" name="description" />
      </div>
      <div className="field">
        <label htmlFor="edit_stream_time">配信時間帯</label>
        <input id="edit_stream_time" name="stream_time" />
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
      <p className="help-text">
        不正な書き換えを防ぐため、プロフィール変更は直接反映されません。運営確認後に掲載情報へ反映します。
      </p>
      <button className="primary-button" type="submit">
        <Send size={18} />
        修正申請を送る
      </button>
      {status && <p className="help-text">{status}</p>}
    </form>
  );
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
