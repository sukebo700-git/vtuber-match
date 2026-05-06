"use client";

import { useMemo, useState } from "react";
import { Edit3, Eye, EyeOff, Plus, Save, Trash2, Wand2, X } from "lucide-react";
import { CATEGORIES, PLAN_LABELS, TAGS } from "@/lib/constants";
import type { PlanType, Streamer, StreamerApplication } from "@/lib/types";

type AdminDashboardProps = {
  initialApplications: StreamerApplication[];
  initialStreamers: Streamer[];
  adminKey: string;
};

type StreamerView = "application" | "paid" | "boost";
type EditState = Pick<Streamer, "id" | "name" | "youtube_url" | "youtube_channel_id" | "description" | "one_liner" | "stream_time" | "plan_type" | "thumbnails" | "categories" | "tags">;

export function AdminDashboard({ initialApplications, initialStreamers, adminKey }: AdminDashboardProps) {
  const [streamers, setStreamers] = useState(initialStreamers);
  const [busyId, setBusyId] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [directStatus, setDirectStatus] = useState("");
  const [directPlan, setDirectPlan] = useState<PlanType>("free");
  const [directCategories, setDirectCategories] = useState<string[]>([]);
  const [directTags, setDirectTags] = useState<string[]>([]);
  const [streamerView, setStreamerView] = useState<StreamerView>("application");
  const [editing, setEditing] = useState<EditState | null>(null);

  const directCategoryLimit = directPlan === "free" ? 1 : 3;
  const directTagLimit = directPlan === "free" ? 1 : 5;
  const editCategoryLimit = editing?.plan_type === "free" ? 1 : 3;
  const editTagLimit = editing?.plan_type === "free" ? 1 : 5;
  const applicationCount = initialApplications.length;

  const visibleStreamers = useMemo(() => {
    const sorted = [...streamers].sort((a, b) => {
      const left = a.created_at ? new Date(a.created_at).getTime() : 0;
      const right = b.created_at ? new Date(b.created_at).getTime() : 0;
      return right - left;
    });
    if (streamerView === "paid") return sorted.filter((streamer) => streamer.plan_type === "paid" || streamer.plan_type === "boost");
    if (streamerView === "boost") return sorted.filter((streamer) => streamer.plan_type === "boost");
    return sorted;
  }, [streamerView, streamers]);

  async function updateStreamer(id: string, patch: Partial<Streamer>) {
    setBusyId(id);
    const response = await fetch(`/api/admin/streamers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify(patch)
    });
    if (response.ok) {
      setStreamers((current) => current.map((streamer) => streamer.id === id ? { ...streamer, ...patch } : streamer));
      setActionMessage("配信者情報を更新しました。");
    } else {
      setActionMessage("更新に失敗しました。");
    }
    setBusyId("");
  }

  async function saveEdit() {
    if (!editing) return;
    await updateStreamer(editing.id, {
      name: editing.name,
      youtube_url: editing.youtube_url,
      youtube_channel_id: editing.youtube_channel_id,
      description: editing.description,
      one_liner: editing.one_liner,
      stream_time: editing.stream_time,
      plan_type: editing.plan_type,
      thumbnails: editing.thumbnails,
      categories: editing.categories.slice(0, editCategoryLimit),
      tags: editing.tags.slice(0, editTagLimit)
    });
    setEditing(null);
  }

  async function deleteStreamer(id: string) {
    const target = streamers.find((streamer) => streamer.id === id);
    if (!target || target.is_visible) return;
    if (!window.confirm(`${target.name} を削除します。非表示データのみ削除できます。`)) return;
    setBusyId(id);
    const response = await fetch(`/api/admin/streamers/${id}`, {
      method: "DELETE",
      headers: { "x-admin-key": adminKey }
    });
    if (response.ok) {
      setStreamers((current) => current.filter((streamer) => streamer.id !== id));
      setActionMessage("非表示の配信者データを削除しました。");
    } else {
      setActionMessage("削除に失敗しました。先に非表示にしてください。");
    }
    setBusyId("");
  }

  async function seedDemoStreamers() {
    setDirectStatus("架空Vtuberデータを追加中...");
    const response = await fetch("/api/admin/seed-demo", {
      method: "POST",
      headers: { "x-admin-key": adminKey }
    });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.streamers) && data.streamers.length) {
        setStreamers((current) => {
          const byId = new Map(current.map((streamer) => [streamer.id, streamer]));
          data.streamers.forEach((streamer: Streamer) => byId.set(streamer.id, { ...(byId.get(streamer.id) || {}), ...streamer }));
          return Array.from(byId.values());
        });
      }
      setDirectStatus(`架空Vtuberデータを${data.created}件追加しました。`);
    } else {
      setDirectStatus("架空Vtuberデータの追加に失敗しました。");
    }
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

  async function onEditFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!editing) return;
    const files = Array.from(event.target.files || []).slice(0, 3);
    const nextImages = await Promise.all(files.map(fileToDataUrl));
    setEditing({ ...editing, thumbnails: nextImages });
  }

  function startEdit(streamer: Streamer) {
    setEditing({
      id: streamer.id,
      name: streamer.name,
      youtube_url: streamer.youtube_url,
      youtube_channel_id: streamer.youtube_channel_id || "",
      description: streamer.description,
      one_liner: streamer.one_liner,
      stream_time: streamer.stream_time || "",
      plan_type: streamer.plan_type,
      thumbnails: streamer.thumbnails || [],
      categories: streamer.categories || [],
      tags: streamer.tags || []
    });
  }

  function setPlan(plan: PlanType) {
    setDirectPlan(plan);
    setDirectCategories((current) => current.slice(0, plan === "free" ? 1 : 3));
    setDirectTags((current) => current.slice(0, plan === "free" ? 1 : 5));
  }

  function setEditPlan(plan: PlanType) {
    if (!editing) return;
    setEditing({
      ...editing,
      plan_type: plan,
      categories: editing.categories.slice(0, plan === "free" ? 1 : 3),
      tags: editing.tags.slice(0, plan === "free" ? 1 : 5)
    });
  }

  function toggleDirectCategory(category: string) {
    setDirectCategories((current) => toggleChoice(current, category, directCategoryLimit));
  }

  function toggleDirectTag(tag: string) {
    setDirectTags((current) => toggleChoice(current, tag, directTagLimit));
  }

  function toggleEditCategory(category: string) {
    if (!editing) return;
    setEditing({ ...editing, categories: toggleChoice(editing.categories, category, editCategoryLimit) });
  }

  function toggleEditTag(tag: string) {
    if (!editing) return;
    setEditing({ ...editing, tags: toggleChoice(editing.tags, tag, editTagLimit) });
  }

  return (
    <div className="admin-layout">
      <section className="status-band">
        <h2>管理画面</h2>
        <p>申し込みは自動承認です。現在の申込記録は {applicationCount} 件あります。</p>
        {actionMessage && <p className="notice-text">{actionMessage}</p>}
        <p style={{ marginTop: 12 }}>
          <button className="secondary-button" type="button" onClick={seedDemoStreamers}>
            <Wand2 size={18} />
            架空Vtuberを10件追加
          </button>
        </p>
        {directStatus && <p className="help-text">{directStatus}</p>}
      </section>

      <section className="status-band">
        <h2>運営が直接掲載する</h2>
        <form className="form compact-form" onSubmit={createStreamer}>
          <div className="field"><label htmlFor="admin_name">配信者名</label><input id="admin_name" name="name" required /></div>
          <div className="field"><label htmlFor="admin_youtube">YouTube URL</label><input id="admin_youtube" name="youtube_url" type="url" required /></div>
          <div className="field"><label htmlFor="admin_channel">YouTube Channel ID</label><input id="admin_channel" name="youtube_channel_id" placeholder="UC..." /></div>
          <PlanSelect id="admin_plan" value={directPlan} onChange={setPlan} />
          <label className="choice"><input type="checkbox" name="is_initial_scout" />初期スカウトとして登録</label>
          <label className="choice"><input type="checkbox" name="is_visible" defaultChecked />表示する</label>
          <div className="field"><label htmlFor="admin_description">自己アピール</label><textarea id="admin_description" name="description" required /></div>
          <div className="field"><label htmlFor="admin_one_liner">スワイプカードの一言</label><input id="admin_one_liner" name="one_liner" required /></div>
          <div className="field"><label htmlFor="admin_stream_time">配信時間帯</label><input id="admin_stream_time" name="stream_time" /></div>
          <div className="field">
            <label htmlFor="admin_images">掲載画像 最大3枚</label>
            <input id="admin_images" type="file" accept="image/*" multiple onChange={onFilesChange} />
            {!!images.length && <ImagePreview images={images} label="掲載画像" />}
          </div>
          <ChoiceSection title="カテゴリ" values={CATEGORIES} selected={directCategories} max={directCategoryLimit} onToggle={toggleDirectCategory} />
          <ChoiceSection title="タグ" values={TAGS} selected={directTags} max={directTagLimit} onToggle={toggleDirectTag} />
          <button className="primary-button" type="submit"><Plus size={18} />掲載する</button>
        </form>
      </section>

      <section className="status-band">
        <h2>掲載中の配信者</h2>
        <p>申し込み順、有料登録のみ、上位表示のみで切り替えできます。</p>
        <div className="admin-filter-row">
          <button type="button" className={streamerView === "application" ? "selected" : ""} onClick={() => setStreamerView("application")}>申し込み順</button>
          <button type="button" className={streamerView === "paid" ? "selected" : ""} onClick={() => setStreamerView("paid")}>有料登録のみ</button>
          <button type="button" className={streamerView === "boost" ? "selected" : ""} onClick={() => setStreamerView("boost")}>上位表示のみ</button>
        </div>
      </section>

      <section className="admin-list">
        {visibleStreamers.map((streamer) => (
          <article className="admin-card" key={streamer.id}>
            <div className="admin-card-head">
              <h3>{streamer.name}</h3>
              <span className={`state ${streamer.is_visible ? "approved" : "rejected"}`}>{streamer.is_visible ? "表示中" : "非表示"}</span>
            </div>
            {streamer.thumbnails?.[0] && <ImagePreview images={[streamer.thumbnails[0]]} label={streamer.name} />}
            <dl className="data-list">
              <div><dt>掲載ID</dt><dd>{streamer.id}</dd></div>
              <div><dt>プラン</dt><dd>{PLAN_LABELS[streamer.plan_type]}{streamer.is_initial_scout ? " / 初期スカウト" : ""}</dd></div>
              <div><dt>カテゴリ</dt><dd>{streamer.categories.join(" / ") || "未設定"}</dd></div>
              <div><dt>タグ</dt><dd>{streamer.tags.map((tag) => `#${tag}`).join(" ") || "未設定"}</dd></div>
            </dl>
            <div className="metrics">
              <div className="metric"><strong>{streamer.impressions ?? 0}</strong><span>表示</span></div>
              <div className="metric"><strong>{streamer.likes ?? 0}</strong><span>いいね</span></div>
            </div>
            {editing?.id === streamer.id ? (
              <div className="form compact-form">
                <div className="field"><label htmlFor={`edit-name-${streamer.id}`}>配信者名</label><input id={`edit-name-${streamer.id}`} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></div>
                <div className="field"><label htmlFor={`edit-url-${streamer.id}`}>YouTube URL</label><input id={`edit-url-${streamer.id}`} type="url" value={editing.youtube_url} onChange={(event) => setEditing({ ...editing, youtube_url: event.target.value })} /></div>
                <div className="field"><label htmlFor={`edit-channel-${streamer.id}`}>YouTube Channel ID</label><input id={`edit-channel-${streamer.id}`} value={editing.youtube_channel_id || ""} onChange={(event) => setEditing({ ...editing, youtube_channel_id: event.target.value })} /></div>
                <PlanSelect id={`edit-plan-${streamer.id}`} value={editing.plan_type} onChange={setEditPlan} />
                <div className="field"><label htmlFor={`edit-one-${streamer.id}`}>スワイプカードの一言</label><input id={`edit-one-${streamer.id}`} value={editing.one_liner} onChange={(event) => setEditing({ ...editing, one_liner: event.target.value })} /></div>
                <div className="field"><label htmlFor={`edit-desc-${streamer.id}`}>自己アピール</label><textarea id={`edit-desc-${streamer.id}`} value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} /></div>
                <div className="field"><label htmlFor={`edit-time-${streamer.id}`}>配信時間帯</label><input id={`edit-time-${streamer.id}`} value={editing.stream_time || ""} onChange={(event) => setEditing({ ...editing, stream_time: event.target.value })} /></div>
                <div className="field">
                  <label htmlFor={`edit-images-${streamer.id}`}>画像を差し替え 最大3枚</label>
                  <input id={`edit-images-${streamer.id}`} type="file" accept="image/*" multiple onChange={onEditFilesChange} />
                  {!!editing.thumbnails.length && <ImagePreview images={editing.thumbnails} label="編集画像" />}
                </div>
                <ChoiceSection title="カテゴリ" values={CATEGORIES} selected={editing.categories} max={editCategoryLimit} onToggle={toggleEditCategory} />
                <ChoiceSection title="タグ" values={TAGS} selected={editing.tags} max={editTagLimit} onToggle={toggleEditTag} />
                <button className="primary-button" type="button" disabled={busyId === streamer.id} onClick={saveEdit}><Save size={16} />保存する</button>
                <button className="secondary-button" type="button" onClick={() => setEditing(null)}><X size={16} />キャンセル</button>
              </div>
            ) : (
              <>
                <button className="secondary-button" type="button" onClick={() => startEdit(streamer)}><Edit3 size={16} />編集</button>
                <select value={streamer.plan_type} onChange={(event) => updateStreamer(streamer.id, { plan_type: event.target.value as PlanType })}>
                  <option value="free">無料掲載</option>
                  <option value="paid">有料掲載 500円</option>
                  <option value="boost">さらに上位表示 980円</option>
                </select>
                <button className="secondary-button" type="button" disabled={busyId === streamer.id} onClick={() => updateStreamer(streamer.id, { is_visible: !streamer.is_visible })}>
                  {streamer.is_visible ? <EyeOff size={16} /> : <Eye size={16} />}
                  {streamer.is_visible ? "非表示にする" : "表示する"}
                </button>
                {!streamer.is_visible && (
                  <button className="danger-button" type="button" disabled={busyId === streamer.id} onClick={() => deleteStreamer(streamer.id)}>
                    <Trash2 size={16} />
                    非表示データを削除
                  </button>
                )}
                <label className="choice"><input type="checkbox" checked={Boolean(streamer.is_initial_scout)} onChange={(event) => updateStreamer(streamer.id, { is_initial_scout: event.target.checked })} />初期スカウト</label>
              </>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}

function PlanSelect({ id, value, onChange }: { id: string; value: PlanType; onChange: (plan: PlanType) => void }) {
  return (
    <div className="field">
      <label htmlFor={id}>プラン</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value as PlanType)}>
        <option value="free">無料掲載</option>
        <option value="paid">有料掲載 500円</option>
        <option value="boost">さらに上位表示 980円</option>
      </select>
    </div>
  );
}

function ChoiceSection({ title, values, selected, max, onToggle }: { title: string; values: string[]; selected: string[]; max: number; onToggle: (value: string) => void }) {
  return (
    <div className="field">
      <label>{title} {selected.length}/{max}</label>
      <div className="choice-grid dense">
        {values.map((value) => (
          <label className="choice" key={value}>
            <input type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(value)} />
            {value}
          </label>
        ))}
      </div>
    </div>
  );
}

function ImagePreview({ images, label }: { images: string[]; label: string }) {
  return (
    <div className="image-preview-row">
      {images.map((image, index) => (
        <img src={image} alt={`${label}${index + 1}`} key={`${image.slice(0, 40)}-${index}`} />
      ))}
    </div>
  );
}

function toggleChoice(current: string[], value: string, max: number) {
  if (current.includes(value)) return current.filter((item) => item !== value);
  if (current.length >= max) return current;
  return [...current, value];
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
