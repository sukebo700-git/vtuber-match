"use client";

import { useState } from "react";
import { BadgeCheck, Crown, ImagePlus, Send } from "lucide-react";
import { PushNotificationButton } from "@/components/PushNotificationButton";
import { PLAN_FEATURES } from "@/lib/constants";
import { LofiPlanBenefits } from "@/components/LofiPlanBenefits";

type ApplicationFormProps = {
  categories: string[];
  tags: string[];
};

type CompletionInfo = {
  email: string;
  password: string;
};

const creatorDraftKey = "vtuber-match-creator-profile-draft";
const imageSlotCount = 3;
const maxTotalImagePayload = 520_000;
const maxSingleImagePayload = 130_000;

const planRows = [
  {
    id: "free",
    name: "無料プラン",
    price: "0円",
    summary: "まず掲載したい方向け。画像、名前、配信サイトURL、100文字までの自己アピールを表示できます。",
  },
  {
    id: "paid",
    name: "ベーシックプラン",
    price: "月額500円",
    summary: "画像3枚、X表示、カテゴリ・タグ、無料プランより上位表示に加えて、紹介動画の掲載特典が使えます。",
  },
  {
    id: "boost",
    name: "プレミアムプラン",
    price: "月額980円",
    summary: "常時優先表示、プレミアムフレーム、アーカイブ表示、Lo-Fi配信での優先紹介が使えます。",
  },
];

export function ApplicationForm({ categories, tags }: ApplicationFormProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>(Array(imageSlotCount).fill(""));
  const [selectedPlan, setSelectedPlan] = useState("free");
  const [status, setStatus] = useState("");
  const [completion, setCompletion] = useState<CompletionInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const isFree = selectedPlan === "free";
  const categoryLimit = 3;
  const tagLimit = 3;
  const visibleImages = isFree ? images.slice(0, 1) : images;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setCompletion(null);

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const desiredPlan = String(form.get("desired_plan") || "free");
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("creator_password") || "");
    const thumbnails = images.slice(0, desiredPlan === "free" ? 1 : imageSlotCount).filter(Boolean);
    const totalImageSize = thumbnails.reduce((sum, image) => sum + image.length, 0);

    if (thumbnails.length === 0) {
      setStatus("画像を1枚以上登録してください。");
      setBusy(false);
      return;
    }

    if (totalImageSize > maxTotalImagePayload) {
      setStatus("画像容量が大きすぎます。画像を少し小さくするか、登録枚数を減らしてもう一度お試しください。");
      setBusy(false);
      return;
    }

    const payload = {
      name: form.get("name"),
      email,
      youtube_url: form.get("youtube_url"),
      youtube_channel_id: form.get("youtube_channel_id"),
      x_account: form.get("x_account"),
      description: form.get("description"),
      one_liner: form.get("one_liner"),
      stream_time: String(form.get("stream_time") || "").slice(0, 50),
      creator_password: password,
      desired_plan: desiredPlan,
      thumbnails,
      categories: selectedCategories.slice(0, 3),
      tags: selectedTags.slice(0, 3),
    };

    setStatus("登録内容を送信しています...");
    let response: Response;
    try {
      response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      setStatus("送信に失敗しました。通信が不安定な可能性があります。画像を減らしてもう一度お試しください。");
      setBusy(false);
      return;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.error || `登録に失敗しました。エラーコード: ${response.status}`);
      setBusy(false);
      return;
    }

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
    localStorage.setItem("vtuber-match-creator-x-account", String(form.get("x_account") || ""));
    localStorage.setItem(creatorDraftKey, JSON.stringify({
      name: String(form.get("name") || ""),
      youtube_url: String(form.get("youtube_url") || ""),
      youtube_channel_id: String(form.get("youtube_channel_id") || ""),
      x_account: String(form.get("x_account") || ""),
      description: String(form.get("description") || ""),
      one_liner: String(form.get("one_liner") || "").slice(0, 20),
      stream_time: String(form.get("stream_time") || "").slice(0, 50),
      image: images.find(Boolean) || "",
      images: thumbnails,
      categories: selectedCategories,
      tags: selectedTags.slice(0, 3),
      desired_plan: desiredPlan,
    }));
    window.dispatchEvent(new Event("vtuber-match-auth-changed"));

    if (desiredPlan === "paid" || desiredPlan === "boost") {
      window.location.assign(`/checkout?application_id=${applicationId}`);
      return;
    }

    setStatus(data.already_registered ? "このメールアドレスは登録済みです。配信者ページへ移動できます。" : "無料プランの申し込みを受け付け、掲載しました。");
    setCompletion({ email, password });
    formElement.reset();
    setSelectedCategories([]);
    setSelectedTags([]);
    setImages(Array(imageSlotCount).fill(""));
    setSelectedPlan("free");
    setBusy(false);
    window.location.assign("/creator/edit?notify=1");
  }

  async function onFileChange(index: number, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus("画像を調整しています...");
    const encoded = await fileToDataUrl(file);
    if (!encoded) {
      setStatus("画像を読み込めませんでした。JPEG、PNG、WebP画像を選んでください。");
      return;
    }
    setImages((current) => current.map((image, imageIndex) => (imageIndex === index ? encoded : image)));
    setStatus("画像を登録枠に入れました。");
    event.target.value = "";
  }

  function removeImage(index: number) {
    setImages((current) => current.map((image, imageIndex) => (imageIndex === index ? "" : image)));
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
      setImages((current) => [current.find(Boolean) || "", ...Array(imageSlotCount - 1).fill("")]);
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
              <LofiPlanBenefits planId={plan.id === "free" ? "registered" : plan.id === "paid" ? "paid" : "boost"} />
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
        <p className="help-text">このメールアドレスとパスワードで、あとからプロフィール修正やアップグレードができます。</p>
      </div>
      <div className="field">
        <label htmlFor="creator_password">ログイン用パスワード</label>
        <input id="creator_password" name="creator_password" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <div className="field">
        <label htmlFor="youtube_url">動画・配信サイトURL</label>
        <input id="youtube_url" name="youtube_url" type="url" required placeholder="https://www.youtube.com/@channel または https://www.twitch.tv/channel" />
        <p className="help-text">YouTube、Twitch、ニコニコ、ツイキャスなどのURLを登録できます。</p>
      </div>
      <div className="field">
        <label htmlFor="youtube_channel_id">YouTube Channel ID 任意</label>
        <input id="youtube_channel_id" name="youtube_channel_id" placeholder="UC..." />
      </div>
      <div className="field">
        <label htmlFor="x_account">Xアカウント 任意</label>
        <input id="x_account" name="x_account" placeholder="@vtubermatch" />
      </div>
      <div className="field">
        <span className="field-label">
          <ImagePlus size={16} /> 掲載画像 {isFree ? "1枚" : "最大3枚"}
        </span>
        <div className="image-slot-grid">
          {visibleImages.map((image, index) => (
            <div className="image-slot" key={index}>
              <label htmlFor={`image_slot_${index}`}>
                <span>{index + 1}枚目</span>
                <strong>{image ? "画像を変更" : "画像を選択"}</strong>
              </label>
              <input id={`image_slot_${index}`} name={`image_slot_${index}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => onFileChange(index, event)} />
              {image ? (
                <>
                  <img src={image} alt={`アップロード画像 ${index + 1}`} />
                  <button className="mini-button" type="button" onClick={() => removeImage(index)}>削除</button>
                </>
              ) : (
                <p>1枠につき1枚ずつ登録できます。</p>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="description">プロフィール画面に表示する自己アピール</label>
        <textarea id="description" name="description" required={!isFree} maxLength={isFree ? 100 : 500} />
        <p className="help-text">{isFree ? "無料プランでは100文字までプロフィール画面に表示されます。" : "プロフィール画面に表示されます。"}</p>
      </div>
      <div className="field">
        <label htmlFor="one_liner">今日のひとこと</label>
        <input id="one_liner" name="one_liner" required={!isFree} maxLength={20} />
        <p className="help-text">{isFree ? "無料プランでもプロフィールとスワイプ画面に表示されます。" : "スワイプ画面の詳細欄に表示されます。"}</p>
      </div>

      {isFree ? (
        <section className="status-band">
          <h2>無料プランの表示内容</h2>
          <p>無料プランでは、写真、名前、配信サイトURL、100文字までの自己アピール、今日のひとことを表示します。カテゴリ、タグ、公式バッジ、上位表示はベーシックプランから使えます。</p>
        </section>
      ) : (
        <>
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
            <p className="notice-text"><BadgeCheck size={16} /> ベーシックプランでは公式バッジ、上位表示、紹介動画の掲載特典が使えます。</p>
          )}
          {selectedPlan === "boost" && (
            <p className="notice-text"><Crown size={16} /> プレミアムプランでは常時優先表示、プレミアムフレーム、Lo-Fi配信での優先紹介が使えます。</p>
          )}
        </>
      )}

      <button className="primary-button" type="submit" disabled={busy}>
        <Send size={18} />
        {busy ? "送信中..." : "申し込む"}
      </button>
      {status && <p className="notice-text">{status}</p>}
      {status && !completion && !busy && (
        <p className="help-text">
          もう一度お試しいただいても解決しない場合は、表示された文言と入力状況を添えて
          <a href="https://x.com/vtubermatch" target="_blank" rel="noreferrer"> XのDM </a>
          または
          <a href="mailto:vtubermatch@gmail.com"> vtubermatch@gmail.com </a>
          までご連絡ください。
        </p>
      )}
      {completion && (
        <section className="status-band">
          <h2>ログイン情報</h2>
          <p>この画面をスクリーンショット等で保管してください。</p>
          <dl className="data-list">
            <div><dt>ログイン用メールアドレス</dt><dd>{completion.email}</dd></div>
            <div><dt>パスワード</dt><dd>{completion.password}</dd></div>
          </dl>
          <p className="help-text">申込ID、掲載IDは運営管理用のため、この画面には表示していません。</p>
          <div style={{ marginTop: 12 }}>
            <PushNotificationButton targetType="creator" intent="onboarding" />
          </div>
          <p className="inline-actions" style={{ marginTop: 12 }}>
            <a className="secondary-button" href="/creator">配信者ページへ</a>
          </p>
        </section>
      )}
    </form>
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(compressImage(image));
      image.onerror = () => resolve("");
      image.src = String(reader.result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function compressImage(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return "";

  let best = "";
  for (const max of [640, 560, 480, 420, 360, 320, 280]) {
    const scale = Math.min(1, max / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.68, 0.58, 0.48, 0.4, 0.32, 0.26]) {
      const encoded = canvas.toDataURL("image/jpeg", quality);
      if (!best || encoded.length < best.length) best = encoded;
      if (encoded.length <= maxSingleImagePayload) return encoded;
    }
  }

  return best || canvas.toDataURL("image/jpeg", 0.3);
}
