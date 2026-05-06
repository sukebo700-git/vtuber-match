"use client";

import { useMemo, useState } from "react";
import { Edit3, Eye, EyeOff, Save, Trash2, Wand2, X } from "lucide-react";
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [seedMessage, setSeedMessage] = useState("");
  const [streamerView, setStreamerView] = useState<StreamerView>("application");
  const [editing, setEditing] = useState<EditState | null>(null);

  const applicationByStreamerId = useMemo(() => {
    const map = new Map<string, StreamerApplication>();
    initialApplications.forEach((application) => {
      if (application.streamer_id) map.set(application.streamer_id, application);
    });
    return map;
  }, [initialApplications]);

  const applicationById = useMemo(() => {
    const map = new Map<string, StreamerApplication>();
    initialApplications.forEach((application) => map.set(application.id, application));
    return map;
  }, [initialApplications]);

  const editCategoryLimit = editing?.plan_type === "free" ? 1 : 3;
  const editTagLimit = editing?.plan_type === "free" ? 1 : 5;

  const listedStreamers = useMemo(() => {
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
      setMessage("配信者情報を更新しました。");
    } else {
      setMessage("更新に失敗しました。");
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
    const response = await fetch(`/api/admin/streamers/${id}`, {
      method: "DELETE",
      headers: { "x-admin-key": adminKey }
    });
    return response.ok;
  }

  async function bulkSetVisible(isVisible: boolean) {
    if (!selectedIds.length) {
      setMessage("対象を選択してください。");
      return;
    }
    setBulkBusy(true);
    await Promise.all(selectedIds.map((id) => updateStreamer(id, { is_visible: isVisible })));
    setSelectedIds([]);
    setBulkBusy(false);
    setMessage(isVisible ? "選択した配信者を表示しました。" : "選択した配信者を非表示にしました。");
  }

  async function bulkDelete() {
    if (!selectedIds.length) {
      setMessage("対象を選択してください。");
      return;
    }
    const selected = streamers.filter((streamer) => selectedIds.includes(streamer.id));
    const visibleCount = selected.filter((streamer) => streamer.is_visible).length;
    if (visibleCount) {
      setMessage("削除は非表示の配信者だけ可能です。先に一括非表示にしてください。");
      return;
    }
    if (!window.confirm(`選択した${selectedIds.length}件を削除します。`)) return;
    setBulkBusy(true);
    const results = await Promise.all(selectedIds.map(deleteStreamer));
    const deletedIds = selectedIds.filter((_, index) => results[index]);
    setStreamers((current) => current.filter((streamer) => !deletedIds.includes(streamer.id)));
    setSelectedIds([]);
    setBulkBusy(false);
    setMessage(`${deletedIds.length}件を削除しました。`);
  }

  async function seedDemoStreamers() {
    setSeedMessage("架空Vtuberデータを追加中...");
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
      setSeedMessage(`架空Vtuberデータを${data.created}件追加・更新しました。`);
    } else {
      setSeedMessage("架空Vtuberデータの追加に失敗しました。");
    }
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

  function setEditPlan(plan: PlanType) {
    if (!editing) return;
    setEditing({
      ...editing,
      plan_type: plan,
      categories: editing.categories.slice(0, plan === "free" ? 1 : 3),
      tags: editing.tags.slice(0, plan === "free" ? 1 : 5)
    });
  }

  async function onEditFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!editing) return;
    const files = Array.from(event.target.files || []).slice(0, 3);
    const thumbnails = await Promise.all(files.map(fileToDataUrl));
    setEditing({ ...editing, thumbnails });
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function toggleAllVisible() {
    const ids = listedStreamers.map((streamer) => streamer.id);
    setSelectedIds((current) => ids.every((id) => current.includes(id)) ? [] : ids);
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
        <h2>掲載中の配信者管理</h2>
        <p>申し込み情報、決済情報、プロフィール情報はこの一覧で確認・修正できます。</p>
        {message && <p className="notice-text">{message}</p>}
        <div className="admin-filter-row">
          <button type="button" className={streamerView === "application" ? "selected" : ""} onClick={() => setStreamerView("application")}>申し込み順</button>
          <button type="button" className={streamerView === "paid" ? "selected" : ""} onClick={() => setStreamerView("paid")}>有料登録のみ</button>
          <button type="button" className={streamerView === "boost" ? "selected" : ""} onClick={() => setStreamerView("boost")}>上位表示のみ</button>
        </div>
        <div className="admin-filter-row">
          <button className="secondary-button" type="button" onClick={toggleAllVisible}>表示中一覧を全選択</button>
          <button className="secondary-button" type="button" disabled={bulkBusy} onClick={() => bulkSetVisible(false)}><EyeOff size={16} />選択を非表示</button>
          <button className="secondary-button" type="button" disabled={bulkBusy} onClick={() => bulkSetVisible(true)}><Eye size={16} />選択を表示</button>
          <button className="danger-button" type="button" disabled={bulkBusy} onClick={bulkDelete}><Trash2 size={16} />選択を削除</button>
        </div>
        <p style={{ marginTop: 12 }}>
          <button className="secondary-button" type="button" onClick={seedDemoStreamers}>
            <Wand2 size={18} />
            架空Vtuberを10件追加・更新
          </button>
        </p>
        {seedMessage && <p className="help-text">{seedMessage}</p>}
      </section>

      <section className="admin-list">
        {listedStreamers.map((streamer) => {
          const application = applicationByStreamerId.get(streamer.id) || (streamer.source_application_id ? applicationById.get(streamer.source_application_id) : undefined);
          return (
            <article className="admin-card" key={streamer.id}>
              <div className="admin-card-head">
                <label className="choice">
                  <input type="checkbox" checked={selectedIds.includes(streamer.id)} onChange={() => toggleSelected(streamer.id)} />
                  選択
                </label>
                <span className={`state ${streamer.is_visible ? "approved" : "rejected"}`}>{streamer.is_visible ? "表示中" : "非表示"}</span>
              </div>
              <h3>{streamer.name}</h3>
              {streamer.thumbnails?.[0] && <ImagePreview images={[streamer.thumbnails[0]]} label={streamer.name} />}
              <dl className="data-list">
                <div><dt>掲載ID</dt><dd>{streamer.id}</dd></div>
                <div><dt>申込ID</dt><dd>{application?.id || streamer.source_application_id || "運営登録/未連携"}</dd></div>
                <div><dt>管理ID</dt><dd>{application?.creator_login_id || "未発行/未連携"}</dd></div>
                <div><dt>パスワード</dt><dd>{application?.creator_password_hash ? "設定済み" : "未設定"}</dd></div>
                <div><dt>非公開メール</dt><dd>{application?.email || "未連携"}</dd></div>
                <div><dt>プラン</dt><dd>{PLAN_LABELS[streamer.plan_type]}{streamer.is_initial_scout ? " / 初期スカウト" : ""}</dd></div>
                <div><dt>決済状態</dt><dd>{formatPayment(application)}</dd></div>
                <div><dt>申込日</dt><dd>{formatDate(application?.created_at || streamer.created_at)}</dd></div>
                <div><dt>有料課金日時</dt><dd>{formatDate(application?.paid_at)}</dd></div>
                <div><dt>YouTube</dt><dd>{streamer.youtube_url}</dd></div>
                <div><dt>配信時間帯</dt><dd>{streamer.stream_time || "未入力"}</dd></div>
                <div><dt>一言</dt><dd>{streamer.one_liner || "未入力"}</dd></div>
                <div><dt>自己アピール</dt><dd>{streamer.description || "未入力"}</dd></div>
                <div><dt>カテゴリ</dt><dd>{streamer.categories.join(" / ") || "未設定"}</dd></div>
                <div><dt>タグ</dt><dd>{streamer.tags.map((tag) => `#${tag}`).join(" ") || "未設定"}</dd></div>
              </dl>
              <div className="metrics">
                <div className="metric"><strong>{streamer.impressions ?? 0}</strong><span>表示</span></div>
                <div className="metric"><strong>{streamer.likes ?? 0}</strong><span>いいね</span></div>
              </div>

              {editing?.id === streamer.id ? (
                <div className="form compact-form">
                  <TextInput label="配信者名" value={editing.name} onChange={(value) => setEditing({ ...editing, name: value })} />
                  <TextInput label="YouTube URL" value={editing.youtube_url} onChange={(value) => setEditing({ ...editing, youtube_url: value })} />
                  <TextInput label="YouTube Channel ID" value={editing.youtube_channel_id || ""} onChange={(value) => setEditing({ ...editing, youtube_channel_id: value })} />
                  <PlanSelect value={editing.plan_type} onChange={setEditPlan} />
                  <TextInput label="スワイプカードの一言" value={editing.one_liner} onChange={(value) => setEditing({ ...editing, one_liner: value })} />
                  <div className="field">
                    <label>自己アピール</label>
                    <textarea value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} />
                  </div>
                  <TextInput label="配信時間帯" value={editing.stream_time || ""} onChange={(value) => setEditing({ ...editing, stream_time: value })} />
                  <div className="field">
                    <label>画像を差し替え 最大3枚</label>
                    <input type="file" accept="image/*" multiple onChange={onEditFilesChange} />
                    {!!editing.thumbnails.length && <ImagePreview images={editing.thumbnails} label="編集画像" />}
                  </div>
                  <ChoiceSection title="カテゴリ" values={CATEGORIES} selected={editing.categories} max={editCategoryLimit} onToggle={toggleEditCategory} />
                  <ChoiceSection title="タグ" values={TAGS} selected={editing.tags} max={editTagLimit} onToggle={toggleEditTag} />
                  <button className="primary-button" type="button" disabled={busyId === streamer.id} onClick={saveEdit}><Save size={16} />保存する</button>
                  <button className="secondary-button" type="button" onClick={() => setEditing(null)}><X size={16} />キャンセル</button>
                </div>
              ) : (
                <>
                  <button className="secondary-button" type="button" onClick={() => startEdit(streamer)}><Edit3 size={16} />プロフィール修正</button>
                  <select value={streamer.plan_type} onChange={(event) => updateStreamer(streamer.id, { plan_type: event.target.value as PlanType })}>
                    <option value="free">無料掲載</option>
                    <option value="paid">有料掲載 500円</option>
                    <option value="boost">さらに上位表示 980円</option>
                  </select>
                  <label className="choice">
                    <input type="checkbox" checked={Boolean(streamer.is_initial_scout)} onChange={(event) => updateStreamer(streamer.id, { is_initial_scout: event.target.checked })} />
                    初期スカウト
                  </label>
                </>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function PlanSelect({ value, onChange }: { value: PlanType; onChange: (plan: PlanType) => void }) {
  return (
    <div className="field">
      <label>プラン</label>
      <select value={value} onChange={(event) => onChange(event.target.value as PlanType)}>
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

function formatPayment(application?: StreamerApplication) {
  if (!application) return "未連携";
  if (application.payment_status === "paid") return "決済済み";
  if (application.payment_status === "pending") return "決済待ち";
  return "無料掲載";
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
