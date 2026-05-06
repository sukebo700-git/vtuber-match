"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, Plus, RefreshCw } from "lucide-react";
import { CATEGORIES, PLAN_LABELS, TAGS } from "@/lib/constants";
import type { PlanType, Streamer, StreamerApplication } from "@/lib/types";

type AdminDashboardProps = {
  initialApplications: StreamerApplication[];
  initialStreamers: Streamer[];
  adminKey: string;
};

export function AdminDashboard({ initialApplications, initialStreamers, adminKey }: AdminDashboardProps) {
  const [applications, setApplications] = useState(initialApplications);
  const [streamers, setStreamers] = useState(initialStreamers);
  const [busyId, setBusyId] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [directStatus, setDirectStatus] = useState("");
  const [directPlan, setDirectPlan] = useState<PlanType>("free");
  const [directCategories, setDirectCategories] = useState<string[]>([]);
  const [directTags, setDirectTags] = useState<string[]>([]);

  const directCategoryLimit = directPlan === "free" ? 1 : 3;
  const directTagLimit = directPlan === "free" ? 1 : 5;

  async function approve(id: string) {
    setBusyId(id);
    setActionMessage("");
    const response = await fetch(`/api/admin/applications/${id}/approve`, {
      method: "POST",
      headers: { "x-admin-key": adminKey }
    });
    if (response.ok) {
      const data = await response.json();
      setApplications((current) => current.map((item) => (
        item.id === id ? { ...item, status: "approved", reviewed_at: new Date().toISOString() } : item
      )));
      if (data.streamer) setStreamers((current) => [data.streamer, ...current]);
      setActionMessage("掲載を承認しました。トップページに反映されます。");
    } else {
      const data = await response.json().catch(() => ({}));
      setActionMessage(data.error === "payment required" ? "決済反映がまだ確認できません。少し待ってページを更新してください。" : "承認に失敗しました。");
    }
    setBusyId("");
  }

  async function updateStreamer(id: string, patch: Partial<Pick<Streamer, "is_visible" | "plan_type" | "is_initial_scout">>) {
    setBusyId(id);
    const response = await fetch(`/api/admin/streamers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify(patch)
    });
    if (response.ok) {
      setStreamers((current) => current.map((streamer) => (
        streamer.id === id ? { ...streamer, ...patch } : streamer
      )));
    }
    setBusyId("");
  }

  async function createStreamer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get("name"),
      youtube_url: form.get("youtube_url"),
      youtube_channel_id: form.get("youtube_channel_id"),
      description: form.get("description"),
      one_liner: form.get("one_liner"),
      stream_time: form.get("stream_time"),
      plan_type: directPlan,
      is_initial_scout: form.get("is_initial_scout") === "on",
      is_visible: form.get("is_visible") === "on",
      thumbnails: images,
      categories: directCategories,
      tags: directTags
    };

    setDirectStatus("登録中...");
    const response = await fetch("/api/streamers", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const data = await response.json();
      if (data.streamer) setStreamers((current) => [data.streamer, ...current]);
      setDirectStatus("掲載登録しました。");
      setImages([]);
      setDirectCategories([]);
      setDirectTags([]);
      setDirectPlan("free");
      event.currentTarget.reset();
    } else {
      setDirectStatus("登録に失敗しました。選択数と必須項目を確認してください。");
    }
  }

  async function onFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).slice(0, 3);
    setImages(await Promise.all(files.map(fileToDataUrl)));
  }

  function setPlan(plan: PlanType) {
    setDirectPlan(plan);
    setDirectCategories((current) => current.slice(0, plan === "free" ? 1 : 3));
    setDirectTags((current) => current.slice(0, plan === "free" ? 1 : 5));
  }

  function toggleDirectCategory(category: string) {
    setDirectCategories((current) => {
      if (current.includes(category)) return current.filter((value) => value !== category);
      if (current.length >= directCategoryLimit) return current;
      return [...current, category];
    });
  }

  function toggleDirectTag(tag: string) {
    setDirectTags((current) => {
      if (current.includes(tag)) return current.filter((value) => value !== tag);
      if (current.length >= directTagLimit) return current;
      return [...current, tag];
    });
  }

  const pending = applications.filter((item) => item.status === "pending");

  return (
    <div className="admin-layout">
      <section className="status-band">
        <h2>管理画面</h2>
        <p>申込内容、決済状態、掲載状態、プラン、表示非表示を確認・管理できます。</p>
      </section>

      <section className="status-band">
        <h2>運営が直接掲載する</h2>
        <form className="form compact-form" onSubmit={createStreamer}>
          <div className="field">
            <label htmlFor="admin_name">配信者名</label>
            <input id="admin_name" name="name" required />
          </div>
          <div className="field">
            <label htmlFor="admin_youtube">YouTube URL</label>
            <input id="admin_youtube" name="youtube_url" type="url" required />
          </div>
          <div className="field">
            <label htmlFor="admin_channel">YouTube Channel ID</label>
            <input id="admin_channel" name="youtube_channel_id" placeholder="UC..." />
          </div>
          <div className="field">
            <label htmlFor="admin_plan">プラン</label>
            <select id="admin_plan" name="plan_type" value={directPlan} onChange={(event) => setPlan(event.target.value as PlanType)}>
              <option value="free">無料掲載</option>
              <option value="paid">有料掲載 500円</option>
              <option value="boost">さらに上位表示 980円</option>
            </select>
            <p className="help-text">無料掲載はカテゴリ1件・タグ1件。有料掲載以上はカテゴリ最大3件・タグ最大5件です。</p>
          </div>
          <label className="choice">
            <input type="checkbox" name="is_initial_scout" />
            初期スカウトとして登録
          </label>
          <label className="choice">
            <input type="checkbox" name="is_visible" defaultChecked />
            表示する
          </label>
          <div className="field">
            <label htmlFor="admin_description">プロフィール画面に表示する自己アピール</label>
            <textarea id="admin_description" name="description" required />
          </div>
          <div className="field">
            <label htmlFor="admin_one_liner">スワイプカードの一言</label>
            <input id="admin_one_liner" name="one_liner" required />
          </div>
          <div className="field">
            <label htmlFor="admin_stream_time">配信時間帯</label>
            <input id="admin_stream_time" name="stream_time" />
          </div>
          <div className="field">
            <label htmlFor="admin_images">掲載画像 最大3枚</label>
            <input id="admin_images" type="file" accept="image/*" multiple onChange={onFilesChange} />
            {!!images.length && (
              <div className="image-preview-row">
                {images.map((image, index) => <img src={image} alt={`掲載画像 ${index + 1}`} key={image.slice(0, 40)} />)}
              </div>
            )}
          </div>
          <div className="field">
            <label>カテゴリ {directCategories.length}/{directCategoryLimit}</label>
            <div className="choice-grid dense">
              {CATEGORIES.map((category) => (
                <label className="choice" key={category}>
                  <input type="checkbox" checked={directCategories.includes(category)} onChange={() => toggleDirectCategory(category)} />
                  {category}
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label>タグ {directTags.length}/{directTagLimit}</label>
            <div className="choice-grid dense">
              {TAGS.map((tag) => (
                <label className="choice" key={tag}>
                  <input type="checkbox" checked={directTags.includes(tag)} onChange={() => toggleDirectTag(tag)} />
                  {tag}
                </label>
              ))}
            </div>
          </div>
          <button className="primary-button" type="submit">
            <Plus size={18} />
            掲載する
          </button>
          {directStatus && <p>{directStatus}</p>}
        </form>
      </section>

      <section className="status-band">
        <h2>申込確認</h2>
        <p>未承認 {pending.length}件。申込時の全データ、申込日、決済日時、審査日時を確認できます。</p>
      </section>

      <section className="admin-list wide-list">
        {applications.map((application) => (
          <article className="admin-card" key={application.id}>
            <div className="admin-card-head">
              <h3>{application.name}</h3>
              <span className={`state ${application.status}`}>{statusLabel(application.status)}</span>
            </div>
            <dl className="data-list">
              <div><dt>申込ID</dt><dd>{application.id}</dd></div>
              <div><dt>非公開メール</dt><dd>{application.email}</dd></div>
              <div><dt>YouTube URL</dt><dd>{application.youtube_url}</dd></div>
              <div><dt>Channel ID</dt><dd>{application.youtube_channel_id || "未入力"}</dd></div>
              <div><dt>希望プラン</dt><dd>{PLAN_LABELS[application.desired_plan]}</dd></div>
              <div><dt>決済状態</dt><dd>{paymentLabel(application.payment_status)}</dd></div>
              <div><dt>申込日</dt><dd>{formatDate(application.created_at)}</dd></div>
              <div><dt>有料課金日時</dt><dd>{formatDate(application.paid_at)}</dd></div>
              <div><dt>審査日時</dt><dd>{formatDate(application.reviewed_at)}</dd></div>
              <div><dt>配信時間帯</dt><dd>{application.stream_time || "未入力"}</dd></div>
              <div><dt>スワイプカードの一言</dt><dd>{application.one_liner}</dd></div>
              <div><dt>自己アピール</dt><dd>{application.description}</dd></div>
              <div><dt>カテゴリ</dt><dd>{application.categories.join(" / ") || "未選択"}</dd></div>
              <div><dt>タグ</dt><dd>{application.tags.map((tag) => `#${tag}`).join(" ") || "未選択"}</dd></div>
            </dl>
            {!!application.thumbnails.length && (
              <div className="image-preview-row">
                {application.thumbnails.map((image, index) => <img src={image} alt={`申込画像 ${index + 1}`} key={image.slice(0, 40)} />)}
              </div>
            )}
            <button
              className="secondary-button"
              type="button"
              disabled={application.status !== "pending" || needsPayment(application) || busyId === application.id}
              onClick={() => approve(application.id)}
            >
              {busyId === application.id ? <RefreshCw size={16} /> : <Check size={16} />}
              承認して掲載
            </button>
          </article>
        ))}
      </section>

      <section className="status-band">
        <h2>掲載中の配信者</h2>
        <p>プラン変更と表示・非表示を切り替えます。非表示にするとスワイプ一覧から外れます。</p>
      </section>

      <section className="admin-list">
        {streamers.map((streamer) => (
          <article className="admin-card" key={streamer.id}>
            <div className="admin-card-head">
              <h3>{streamer.name}</h3>
              <span className={`state ${streamer.is_visible ? "approved" : "rejected"}`}>
                {streamer.is_visible ? "表示中" : "非表示"}
              </span>
            </div>
            <p>{PLAN_LABELS[streamer.plan_type]}{streamer.is_initial_scout ? " / 初期スカウト" : ""}</p>
            <p>カテゴリ: {streamer.categories.join(" / ") || "未設定"}</p>
            <p>タグ: {streamer.tags.map((tag) => `#${tag}`).join(" ") || "未設定"}</p>
            <div className="metrics">
              <div className="metric"><strong>{streamer.impressions ?? 0}</strong><span>表示</span></div>
              <div className="metric"><strong>{streamer.likes ?? 0}</strong><span>いいね</span></div>
            </div>
            <select value={streamer.plan_type} onChange={(event) => updateStreamer(streamer.id, { plan_type: event.target.value as PlanType })}>
              <option value="free">無料掲載</option>
              <option value="paid">有料掲載 500円</option>
              <option value="boost">さらに上位表示 980円</option>
            </select>
            <button className="secondary-button" type="button" disabled={busyId === streamer.id} onClick={() => updateStreamer(streamer.id, { is_visible: !streamer.is_visible })}>
              {streamer.is_visible ? <EyeOff size={16} /> : <Eye size={16} />}
              {streamer.is_visible ? "非表示にする" : "表示する"}
            </button>
            <label className="choice">
              <input type="checkbox" checked={Boolean(streamer.is_initial_scout)} onChange={(event) => updateStreamer(streamer.id, { is_initial_scout: event.target.checked })} />
              初期スカウト
            </label>
          </article>
        ))}
      </section>
    </div>
  );
}

function statusLabel(status: StreamerApplication["status"]) {
  if (status === "approved") return "承認済み";
  if (status === "rejected") return "却下";
  return "未承認";
}

function paymentLabel(status: StreamerApplication["payment_status"]) {
  if (status === "paid") return "決済済み";
  if (status === "pending") return "決済待ち";
  return "不要";
}

function needsPayment(application: StreamerApplication) {
  return application.desired_plan !== "free"
    && application.payment_status !== "paid"
    && application.subscription_status !== "active"
    && !application.stripe_subscription_id;
}

function formatDate(value?: string) {
  if (!value) return "未記録";
  return new Date(value).toLocaleString("ja-JP");
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
