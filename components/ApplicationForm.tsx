"use client";

import { useState } from "react";
import { Send } from "lucide-react";

type ApplicationFormProps = {
  categories: string[];
  tags: string[];
};

export function ApplicationForm({ categories, tags }: ApplicationFormProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [selectedPlan, setSelectedPlan] = useState("free");
  const [status, setStatus] = useState("");

  const categoryLimit = selectedPlan === "free" ? 1 : 3;
  const tagLimit = selectedPlan === "free" ? 1 : 5;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const desiredPlan = String(form.get("desired_plan") || "free");
    const payload = {
      name: form.get("name"),
      email: form.get("email"),
      youtube_url: form.get("youtube_url"),
      youtube_channel_id: form.get("youtube_channel_id"),
      description: form.get("description"),
      one_liner: form.get("one_liner"),
      stream_time: form.get("stream_time"),
      desired_plan: desiredPlan,
      thumbnails: images,
      categories: selectedCategories,
      tags: selectedTags
    };

    setStatus("送信中...");
    const response = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      setStatus("送信に失敗しました。必須項目と選択数を確認してください。");
      return;
    }

    const data = await response.json();
    const applicationId = data.application?.id || data.id;
    if (desiredPlan === "paid" || desiredPlan === "boost") {
      window.location.assign(`/checkout?application_id=${applicationId}`);
      return;
    }

    setStatus("無料掲載の申込を受け付けました。運営確認後に掲載されます。");
    event.currentTarget.reset();
    setSelectedCategories([]);
    setSelectedTags([]);
    setImages([]);
    setSelectedPlan("free");
  }

  async function onFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).slice(0, 3);
    const encoded = await Promise.all(files.map(fileToDataUrl));
    setImages(encoded);
  }

  function toggleCategory(category: string) {
    setSelectedCategories((current) => {
      if (current.includes(category)) return current.filter((value) => value !== category);
      if (current.length >= categoryLimit) return current;
      return [...current, category];
    });
  }

  function toggleTag(tag: string) {
    setSelectedTags((current) => {
      if (current.includes(tag)) return current.filter((value) => value !== tag);
      if (current.length >= tagLimit) return current;
      return [...current, tag];
    });
  }

  function changePlan(plan: string) {
    setSelectedPlan(plan);
    setSelectedCategories((current) => current.slice(0, plan === "free" ? 1 : 3));
    setSelectedTags((current) => current.slice(0, plan === "free" ? 1 : 5));
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="name">配信者名</label>
        <input id="name" name="name" required maxLength={60} />
      </div>
      <div className="field">
        <label htmlFor="email">連絡先メール</label>
        <input id="email" name="email" type="email" required />
        <p className="help-text">連絡先メールは運営確認のみに使用し、公開ページやスワイプ画面には表示されません。</p>
      </div>
      <div className="field">
        <label htmlFor="youtube_url">YouTube URL</label>
        <input id="youtube_url" name="youtube_url" type="url" required placeholder="https://www.youtube.com/@channel" />
      </div>
      <div className="field">
        <label htmlFor="youtube_channel_id">YouTube Channel ID</label>
        <input id="youtube_channel_id" name="youtube_channel_id" placeholder="UC..." />
      </div>
      <div className="field">
        <label htmlFor="desired_plan">希望プラン</label>
        <select id="desired_plan" name="desired_plan" value={selectedPlan} onChange={(event) => changePlan(event.target.value)}>
          <option value="free">無料掲載</option>
          <option value="paid">有料掲載 500円</option>
          <option value="boost">さらに上位表示 980円</option>
        </select>
        {selectedPlan === "free" && (
          <p className="notice-text">
            無料掲載ではカテゴリ1件、タグ1件のみ選択できます。有料掲載にアップグレードすると、公式バッジが付き、カテゴリは最大3件、タグは最大5件まで選択できます。
          </p>
        )}
        {(selectedPlan === "paid" || selectedPlan === "boost") && (
          <p className="notice-text">申込送信後、決済画面へ進みます。決済完了後に運営確認へ進みます。</p>
        )}
      </div>
      <div className="field">
        <label htmlFor="description">プロフィール画面に表示する自己アピール</label>
        <textarea id="description" name="description" required maxLength={500} />
      </div>
      <div className="field">
        <label htmlFor="one_liner">スワイプカードの一言</label>
        <input id="one_liner" name="one_liner" required maxLength={80} />
      </div>
      <div className="field">
        <label htmlFor="stream_time">配信時間帯</label>
        <input id="stream_time" name="stream_time" placeholder="例: 平日 22:00-24:00" />
      </div>
      <div className="field">
        <label htmlFor="images">スワイプ画面に表示する画像 最大3枚</label>
        <input id="images" name="images" type="file" accept="image/*" multiple onChange={onFilesChange} />
        <p className="help-text">本人が掲載してよい画像を選んでください。選択した画像はカード表示用に自動圧縮されます。</p>
        {!!images.length && (
          <div className="image-preview-row">
            {images.map((image, index) => (
              <img src={image} alt={`アップロード画像 ${index + 1}`} key={image.slice(0, 40)} />
            ))}
          </div>
        )}
      </div>
      <div className="field">
        <label>カテゴリ {selectedCategories.length}/{categoryLimit}</label>
        <div className="choice-grid">
          {categories.map((category) => (
            <label className="choice" key={category}>
              <input type="checkbox" checked={selectedCategories.includes(category)} onChange={() => toggleCategory(category)} />
              {category}
            </label>
          ))}
        </div>
      </div>
      <div className="field">
        <label>タグ {selectedTags.length}/{tagLimit}</label>
        <div className="choice-grid">
          {tags.map((tag) => (
            <label className="choice" key={tag}>
              <input type="checkbox" checked={selectedTags.includes(tag)} onChange={() => toggleTag(tag)} />
              {tag}
            </label>
          ))}
        </div>
      </div>
      <button className="primary-button" type="submit">
        <Send size={18} />
        申し込む
      </button>
      {status && <p>{status}</p>}
    </form>
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const max = 900;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(String(reader.result));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.onerror = () => resolve(String(reader.result));
      image.src = String(reader.result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
