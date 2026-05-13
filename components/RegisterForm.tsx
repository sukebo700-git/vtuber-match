"use client";

import { useState } from "react";
import { Save } from "lucide-react";

type RegisterFormProps = {
  categories: string[];
  tags: string[];
};

export function RegisterForm({ categories, tags }: RegisterFormProps) {
  const [status, setStatus] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get("name"),
      youtube_url: form.get("youtube_url"),
      description: form.get("description"),
      one_liner: form.get("one_liner"),
      stream_time: form.get("stream_time"),
      plan_type: form.get("plan_type"),
      is_visible: true,
      thumbnails: [],
      categories: form.getAll("categories"),
      tags: form.getAll("tags").slice(0, 5)
    };

    setStatus("登録中...");
    const response = await fetch("/api/streamers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    setStatus(response.ok ? "登録しました" : "登録に失敗しました。");
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="name">配信者名</label>
        <input id="name" name="name" required />
      </div>
      <div className="field">
        <label htmlFor="youtube_url">YouTube URL</label>
        <input id="youtube_url" name="youtube_url" type="url" required />
      </div>
      <div className="field">
        <label htmlFor="plan_type">プラン</label>
        <select id="plan_type" name="plan_type" defaultValue="free">
          <option value="free">無料プラン</option>
          <option value="paid">ベーシックプラン 月額500円</option>
          <option value="boost">さらに上位表示 980円</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="description">プロフィール画面に表示する自己アピール</label>
        <textarea id="description" name="description" required />
      </div>
      <div className="field">
        <label htmlFor="one_liner">スワイプカードの一言</label>
        <input id="one_liner" name="one_liner" required />
      </div>
      <div className="field">
        <label>カテゴリ</label>
        <div className="choice-grid dense">
          {categories.map((category) => (
            <label className="choice" key={category}>
              <input type="checkbox" name="categories" value={category} />
              {category}
            </label>
          ))}
        </div>
      </div>
      <div className="field">
        <label>タグ 最大5個</label>
        <div className="choice-grid dense">
          {tags.map((tag) => (
            <label className="choice" key={tag}>
              <input type="checkbox" name="tags" value={tag} />
              {tag}
            </label>
          ))}
        </div>
      </div>
      <button className="primary-button" type="submit">
        <Save size={18} />
        登録する
      </button>
      {status && <p>{status}</p>}
    </form>
  );
}
