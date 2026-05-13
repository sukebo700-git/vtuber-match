"use client";

import { useState } from "react";
import { BadgeCheck, Crown, ImagePlus, Send } from "lucide-react";
import { PLAN_FEATURES } from "@/lib/constants";

type ApplicationFormProps = {
  categories: string[];
  tags: string[];
};

type CompletionInfo = {
  email: string;
  password: string;
};

const creatorDraftKey = "vtuber-match-creator-profile-draft";

const planRows = [
  {
    id: "free",
    name: "無料プラン",
    price: "0円",
    summary: "まず掲載したい方向け。写真、名前、YouTubeチャンネルURLのみでシンプルに表示します。"
  },
  {
    id: "paid",
    name: "ベーシックプラン",
    price: "月額500円",
    summary: "公式バッジ、タグ、カテゴリ、メッセージ、マッチ数表示、上位表示で見つけてもらいやすくします。"
  },
  {
    id: "boost",
    name: "プレミアムプラン",
    price: "月額980円",
    summary: "ベーシックプランの内容に加えて、おすすめアーカイブ表示と視聴者へのいいね機能が使えます。"
  }
];

export function ApplicationForm({ categories, tags }: ApplicationFormProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [selectedPlan, setSelectedPlan] = useState("free");
  const [status, setStatus] = useState("");
  const [completion, setCompletion] = useState<CompletionInfo | null>(null);

  const isFree = selectedPlan === "free";
  const categoryLimit = isFree ? 0 : 3;
  const tagLimit = isFree ? 0 : 5;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCompletion(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const desiredPlan = String(form.get("desired_plan") || "free");
    const email = String(form.get("email") || "");
    const password = String(form.get("creator_password") || "");
    const payload = {
      name: form.get("name"),
      email,
      youtube_url: form.get("youtube_url"),
      youtube_channel_id: form.get("youtube_channel_id"),
      description: desiredPlan === "free" ? "" : form.get("description"),
      one_liner: desiredPlan === "free" ? "" : form.get("one_liner"),
      stream_time: desiredPlan === "free" ? "" : form.get("stream_time"),
      creator_password: password,
      desired_plan: desiredPlan,
      thumbnails: images,
      categories: desiredPlan === "free" ? [] : selectedCategories,
      tags: desiredPlan === "free" ? [] : selectedTags
    };

    setStatus("送信中です...");
    const response = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(data.error || "送信に失敗しました。入力内容を確認してください。");
      return;
    }

    const data = await response.json();
    const applicationId = data.application?.id || data.id || "";
    const streamerId = data.streamer_id || data.streamer?.id || "";
    const creatorLoginId = data.creator_login_id || data.application?.creator_login_id || "";
    if (applicationId) localStorage.setItem("vtuber-match-creator-application-id", applicationId);
    if (streamerId) localStorage.setItem("vtuber-match-creator-streamer-id", streamerId);
    if (creatorLoginId) localStorage.setItem("vtuber-match-creator-login-id", creatorLoginId);
    localStorage.setItem("vtuber-match-creator-email", email);
    localStorage.setItem("vtuber-match-creator-name", String(form.get("name") || email));
    localStorage.setItem("vtuber-match-creator-plan", desiredPlan);
    localStorage.setItem("vtuber-match-creator-youtube-url", String(form.get("youtube_url") || ""));
    localStorage.setItem("vtuber-match-creator-youtube-channel-id", String(form.get("youtube_channel_id") || ""));
    localStorage.setItem(creatorDraftKey, JSON.stringify({
      name: String(form.get("name") || ""),
      youtube_url: String(form.get("youtube_url") || ""),
      youtube_channel_id: String(form.get("youtube_channel_id") || ""),
      description: String(form.get("description") || ""),
      one_liner: String(form.get("one_liner") || ""),
      stream_time: String(form.get("stream_time") || ""),
      image: images[0] || "",
      categories: selectedCategories,
      tags: selectedTags,
      desired_plan: desiredPlan
    }));
    window.dispatchEvent(new Event("vtuber-match-auth-changed"));

    if (desiredPlan === "paid" || desiredPlan === "boost") {
      window.location.assign(`/checkout?application_id=${applicationId}`);
      return;
    }

    setStatus("無料プランの申し込みを受け付け、掲載しました。");
    setCompletion({ email, password });
    formElement.reset();
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
    if (plan === "free") {
      setSelectedCategories([]);
      setSelectedTags([]);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <section className="status-band">
        <h2>プランの違い</h2>
        <div className="plan-table">
          {planRows.map((plan) => (
            <label className={`plan-card ${selectedPlan === plan.id ? "selected" : ""}`} key={plan.id}>
              <input
                type="radio"
                name="desired_plan"
                value={plan.id}
                checked={selectedPlan === plan.id}
                onChange={(event) => changePlan(event.target.value)}
              />
              <strong>{plan.name}</strong>
              <span className="plan-price">{plan.price}</span>
              <p>{plan.summary}</p>
              <ul>
                {PLAN_FEATURES[plan.id as keyof typeof PLAN_FEATURES].map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </label>
          ))}
        </div>
      </section>

      <div className="field">
        <label htmlFor="name">配信者名</label>
        <input id="name" name="name" required maxLength={60} />
      </div>
      <div className="field">
        <label htmlFor="email">ログイン用メールアドレス</label>
        <input id="email" name="email" type="email" required />
        <p className="help-text">このメールアドレスとパスワードで、後から修正申請やアップグレードができます。スワイプ画面には表示されません。</p>
      </div>
      <div className="field">
        <label htmlFor="creator_password">ログイン用パスワード</label>
        <input id="creator_password" name="creator_password" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <div className="field">
        <label htmlFor="youtube_url">YouTubeチャンネルURL</label>
        <input id="youtube_url" name="youtube_url" type="url" required placeholder="https://www.youtube.com/@channel" />
      </div>
      <div className="field">
        <label htmlFor="youtube_channel_id">YouTube Channel ID 任意</label>
        <input id="youtube_channel_id" name="youtube_channel_id" placeholder="UC..." />
      </div>
      <div className="field">
        <label htmlFor="images">
          <ImagePlus size={16} /> 掲載写真 最大3枚
        </label>
        <input id="images" name="images" type="file" accept="image/*" multiple onChange={onFilesChange} />
        {!!images.length && (
          <div className="image-preview-row">
            {images.map((image, index) => (
              <img src={image} alt={`アップロード画像 ${index + 1}`} key={image.slice(0, 40)} />
            ))}
          </div>
        )}
      </div>

      {isFree ? (
        <section className="status-band">
          <h2>無料プランの表示内容</h2>
          <p>無料プランでは、写真・名前・YouTubeチャンネルURLのみを表示します。タグ、カテゴリ、メッセージ、公式バッジ、上位表示はベーシックプランから使えます。</p>
        </section>
      ) : (
        <>
          <div className="field">
            <label htmlFor="description">プロフィール画面に表示する自己アピール</label>
            <textarea id="description" name="description" required maxLength={500} />
          </div>
          <div className="field">
            <label htmlFor="one_liner">今日のひとこと</label>
            <input id="one_liner" name="one_liner" required maxLength={80} />
            <p className="help-text">ベーシックプラン以上では、スワイプ画面の画像上に表示されます。</p>
          </div>
          <div className="field">
            <label htmlFor="stream_time">配信時間帯</label>
            <input id="stream_time" name="stream_time" placeholder="例: 平日 22:00-24:00" />
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
          {selectedPlan === "paid" && (
            <p className="notice-text"><BadgeCheck size={16} /> ベーシックプランでは公式バッジと上位表示が付き、視聴者に見つけてもらいやすくなります。</p>
          )}
          {selectedPlan === "boost" && (
            <p className="notice-text"><Crown size={16} /> プレミアムではおすすめアーカイブと視聴者へのいいね機能も使えます。</p>
          )}
        </>
      )}

      <button className="primary-button" type="submit">
        <Send size={18} />
        申し込む
      </button>
      {status && <p className="notice-text">{status}</p>}
      {completion && (
        <section className="status-band">
          <h2>ログイン情報</h2>
          <p>こちらの画面をスクリーンショット等で保管してください。</p>
          <dl className="data-list">
            <div><dt>ログイン用メールアドレス</dt><dd>{completion.email}</dd></div>
            <div><dt>パスワード</dt><dd>{completion.password}</dd></div>
          </dl>
          <p className="help-text">管理ID、申込ID、掲載IDは運営管理用のため、この画面には表示していません。</p>
        </section>
      )}
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
