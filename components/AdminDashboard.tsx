"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { Copy, Edit3, ExternalLink, Eye, EyeOff, Heart, Save, Trash2, X } from "lucide-react";
import { CATEGORIES, PLAN_LABELS, TAGS } from "@/lib/constants";
import type { AdminPlacement, PlanType, Streamer, StreamerApplication, SuperBoostEffect } from "@/lib/types";

type AdminDashboardProps = {
  initialApplications: StreamerApplication[];
  initialStreamers: Streamer[];
  adminKey: string;
};

type StreamerView = "application" | "paid" | "boost";
type EditState = Pick<Streamer, "id" | "name" | "youtube_url" | "youtube_channel_id" | "archive_url" | "description" | "one_liner" | "stream_time" | "plan_type" | "thumbnails" | "categories" | "tags">;

const ADMIN_PLACEMENT_LABELS: Record<AdminPlacement, string> = {
  top: "管理者指定 上位表示",
  normal: "通常表示",
  bottom: "管理者指定 下位表示"
};

const SUPER_BOOST_EFFECT_LABELS: Record<SuperBoostEffect, string> = {
  shine: "キラ",
  shake: "揺れ",
};

export function AdminDashboard({ initialApplications, initialStreamers, adminKey }: AdminDashboardProps) {
  const [streamers, setStreamers] = useState(initialStreamers);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [streamerView, setStreamerView] = useState<StreamerView>("application");
  const [editing, setEditing] = useState<EditState | null>(null);
  const [previewStreamer, setPreviewStreamer] = useState<Streamer | null>(null);
  const [superEffects, setSuperEffects] = useState<Record<string, SuperBoostEffect>>({});
  const [actionFeedback, setActionFeedback] = useState<Record<string, string>>({});

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

  const listedStreamers = useMemo(() => {
    const sorted = [...streamers].sort((a, b) => {
      const aApplication = applicationByStreamerId.get(a.id) || (a.source_application_id ? applicationById.get(a.source_application_id) : undefined);
      const bApplication = applicationByStreamerId.get(b.id) || (b.source_application_id ? applicationById.get(b.source_application_id) : undefined);
      const createdDiff = safeTime(bApplication?.created_at || b.created_at) - safeTime(aApplication?.created_at || a.created_at);
      if (createdDiff) return createdDiff;
      return a.name.localeCompare(b.name, "ja");
    });
    if (streamerView === "paid") return sorted.filter((streamer) => streamer.plan_type === "paid" || streamer.plan_type === "boost");
    if (streamerView === "boost") return sorted.filter((streamer) => streamer.plan_type === "boost");
    return sorted;
  }, [applicationById, applicationByStreamerId, streamerView, streamers]);

  const editCategoryLimit = editing?.plan_type === "free" ? 1 : 3;
  const editTagLimit = editing?.plan_type === "free" ? 1 : 5;

  async function updateStreamer(id: string, patch: Partial<Streamer>) {
    setBusyId(id);
    const response = await fetch(`/api/admin/streamers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify(patch)
    });
    setBusyId("");
    if (response.ok) {
      setStreamers((current) => current.map((streamer) => streamer.id === id ? { ...streamer, ...patch } : streamer));
      setPreviewStreamer((current) => current?.id === id ? { ...current, ...patch } : current);
      setMessage("配信者データを更新しました。");
      return true;
    }
    const data = await response.json().catch(() => ({}));
    setMessage(data.error || "更新に失敗しました。");
    return false;
  }

  async function deleteStreamer(id: string) {
    const response = await fetch(`/api/admin/streamers/${id}`, {
      method: "DELETE",
      headers: { "x-admin-key": adminKey }
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.code === "HAS_PAYMENT_HISTORY" ? "課金履歴がある配信者は削除できません。" : data.error || "削除に失敗しました。");
      return false;
    }
    return true;
  }

  async function bulkSetVisible(isVisible: boolean) {
    if (!selectedIds.length) {
      setMessage("対象を選択してください。");
      return;
    }
    setBulkBusy(true);
    await Promise.all(selectedIds.map((id) => updateStreamer(id, { is_visible: isVisible })));
    setBulkBusy(false);
    setMessage(isVisible ? "選択した配信者を表示しました。" : "選択した配信者を非表示にしました。");
  }

  async function bulkSetXIntroduced(introduced: boolean) {
    if (!selectedIds.length) {
      setMessage("対象を選択してください。");
      return;
    }
    setBulkBusy(true);
    const value = introduced ? new Date().toISOString() : "";
    await Promise.all(selectedIds.map((id) => updateStreamer(id, { x_introduced_at: value })));
    setBulkBusy(false);
    const text = introduced ? "X紹介済みにしました" : "X未紹介に戻しました";
    selectedIds.forEach((id) => showActionFeedback(id, text));
    setMessage(`選択した${selectedIds.length}件を${text}。`);
  }

  async function bulkDelete() {
    if (!selectedIds.length) {
      setMessage("対象を選択してください。");
      return;
    }
    const targets = streamers.filter((streamer) => selectedIds.includes(streamer.id));
    if (targets.some((streamer) => streamer.has_payment_history)) {
      setMessage("課金履歴がある配信者は削除できません。対象から外してください。");
      return;
    }
    if (targets.some((streamer) => streamer.is_visible !== false)) {
      setMessage("削除は非表示の配信者だけ可能です。先に一括非表示にしてください。");
      return;
    }
    if (!window.confirm(`選択した${selectedIds.length}件を削除します。よろしいですか？`)) return;
    setBulkBusy(true);
    const results = await Promise.all(selectedIds.map(deleteStreamer));
    const deletedIds = selectedIds.filter((_, index) => results[index]);
    setStreamers((current) => current.filter((streamer) => !deletedIds.includes(streamer.id)));
    setSelectedIds([]);
    setBulkBusy(false);
    setMessage(`${deletedIds.length}件を削除しました。`);
  }

  async function sendBulkEngagementToAll() {
    const visibleCount = listedStreamers.filter((streamer) => streamer.is_visible !== false && streamer.is_deleted !== true && streamer.is_dummy !== true).length;
    if (!visibleCount) {
      setMessage("対象の配信者がいません。");
      return;
    }
    if (!window.confirm(`表示中の全配信者${visibleCount}件に、匿名いいね1件と表示回数+1を追加します。よろしいですか？`)) return;
    setBulkBusy(true);
    const response = await fetch("/api/admin/streamers/bulk-engagement", {
      method: "POST",
      headers: { "x-admin-key": adminKey },
    });
    setBulkBusy(false);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error || "一括いいね・表示追加に失敗しました。");
      return;
    }
    const count = Number(data.count || 0);
    setStreamers((current) => current.map((streamer) => (
      streamer.is_visible !== false && streamer.is_deleted !== true && streamer.is_dummy !== true
        ? { ...streamer, likes: Number(streamer.likes || 0) + 1, impressions: Number(streamer.impressions || 0) + 1 }
        : streamer
    )));
    setMessage(`表示中の全配信者${count}件に匿名いいねと表示回数+1を追加しました。`);
  }

  async function loadFullStreamer(streamer: Streamer) {
    setBusyId(streamer.id);
    const response = await fetch(`/api/admin/streamers/${streamer.id}`, {
      headers: { "x-admin-key": adminKey },
    });
    setBusyId("");
    if (!response.ok) {
      setMessage("配信者データの詳細取得に失敗しました。一覧の情報で表示します。");
      return streamer;
    }
    const data = await response.json().catch(() => ({}));
    return { ...streamer, ...(data.streamer || {}) } as Streamer;
  }

  async function startEdit(streamer: Streamer) {
    const fullStreamer = await loadFullStreamer(streamer);
    setEditing({
      id: fullStreamer.id,
      name: fullStreamer.name,
      youtube_url: fullStreamer.youtube_url,
      youtube_channel_id: fullStreamer.youtube_channel_id || "",
      archive_url: fullStreamer.archive_url || "",
      description: fullStreamer.description,
      one_liner: fullStreamer.one_liner,
      stream_time: fullStreamer.stream_time || "",
      plan_type: fullStreamer.plan_type,
      thumbnails: fullStreamer.thumbnails || [],
      categories: fullStreamer.categories || [],
      tags: fullStreamer.tags || []
    });
  }

  async function startPreview(streamer: Streamer) {
    setPreviewStreamer(await loadFullStreamer(streamer));
  }

  async function saveEdit() {
    if (!editing) return;
    const imageLimit = editing.plan_type === "free" ? 1 : 3;
    await updateStreamer(editing.id, {
      ...editing,
      thumbnails: editing.thumbnails.slice(0, imageLimit),
      categories: editing.categories.slice(0, editCategoryLimit),
      tags: editing.tags.slice(0, editTagLimit)
    });
    setEditing(null);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAllVisible() {
    const visibleIds = listedStreamers.filter((streamer) => streamer.is_visible !== false).map((streamer) => streamer.id);
    setSelectedIds((current) => current.length === visibleIds.length ? [] : visibleIds);
  }

  function selectedSuperEffect(streamer: Streamer): SuperBoostEffect {
    const value = superEffects[streamer.id] || streamer.super_boost_effect || "shine";
    return value === "shake" ? "shake" : "shine";
  }

  function setSuperEffect(streamerId: string, effect: SuperBoostEffect) {
    setSuperEffects((current) => ({ ...current, [streamerId]: effect }));
  }

  function setEditPlan(plan: PlanType) {
    if (!editing) return;
    setEditing({
      ...editing,
      plan_type: plan,
      categories: editing.categories.slice(0, plan === "free" ? 1 : 3),
      tags: editing.tags.slice(0, plan === "free" ? 1 : 5),
      thumbnails: editing.thumbnails.slice(0, plan === "free" ? 1 : 3)
    });
  }

  function onEditFilesChange(event: ChangeEvent<HTMLInputElement>) {
    if (!editing) return;
    const files = Array.from(event.target.files || []).slice(0, editing.plan_type === "free" ? 1 : 3);
    Promise.all(files.map(fileToDataUrl)).then((images) => {
      setEditing({ ...editing, thumbnails: images.filter(Boolean) });
    });
    event.target.value = "";
  }

  function toggleEditCategory(category: string) {
    if (!editing) return;
    setEditing({ ...editing, categories: toggleChoice(editing.categories, category, editCategoryLimit) });
  }

  function toggleEditTag(tag: string) {
    if (!editing) return;
    setEditing({ ...editing, tags: toggleChoice(editing.tags, tag, editTagLimit) });
  }

  function showActionFeedback(id: string, text: string) {
    setActionFeedback((current) => ({ ...current, [id]: text }));
    window.setTimeout(() => {
      setActionFeedback((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }, 2200);
  }

  async function copyStreamerInfo(streamer: Streamer, application?: StreamerApplication) {
    const xAccount = streamer.x_account || application?.x_account || "";
    const text = [
      `名前: ${streamer.name || ""}`,
      `YouTubeURL: ${streamer.youtube_url || ""}`,
      `Xアカウント: ${xAccount || "未登録"}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setMessage(`${streamer.name} の紹介用情報をコピーしました。`);
      showActionFeedback(streamer.id, "コピーしました");
    } catch {
      setMessage("コピーに失敗しました。ブラウザの権限を確認してください。");
      showActionFeedback(streamer.id, "コピー失敗");
    }
  }

  async function setSuperBoostState(streamer: Streamer, enabled: boolean) {
    const ok = await updateStreamer(streamer.id, enabled ? {
      super_boost_until: extendHours(streamer.super_boost_until, 72),
      super_boost_effect: selectedSuperEffect(streamer),
      super_boost_count: (streamer.super_boost_count || 0) + 1,
      grant_source: "admin"
    } : {
      super_boost_until: expiredIso(),
      super_boost_effect: selectedSuperEffect(streamer),
      grant_source: "admin"
    });
    if (ok) showActionFeedback(streamer.id, enabled ? "スーパーいいねONにしました" : "スーパーいいねOFFにしました");
  }

  async function sendAdminEngagement(streamer: Streamer, action: "like" | "impression") {
    setBusyId(streamer.id);
    const response = await fetch(`/api/admin/streamers/${streamer.id}/engagement`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ action }),
    });
    setBusyId("");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error || "管理操作に失敗しました。");
      showActionFeedback(streamer.id, "失敗");
      return;
    }
    setStreamers((current) => current.map((item) => item.id === streamer.id ? {
      ...item,
      likes: typeof data.likes === "number" ? data.likes : (item.likes || 0) + (action === "like" ? 1 : 0),
      impressions: typeof data.impressions === "number" ? data.impressions : (item.impressions || 0) + (action === "impression" ? 1 : 0),
    } : item));
    setPreviewStreamer((current) => current?.id === streamer.id ? {
      ...current,
      likes: typeof data.likes === "number" ? data.likes : (current.likes || 0) + (action === "like" ? 1 : 0),
      impressions: typeof data.impressions === "number" ? data.impressions : (current.impressions || 0) + (action === "impression" ? 1 : 0),
    } : current);
    const text = action === "like" ? "匿名いいねを送信しました" : "表示回数を1件追加しました";
    setMessage(`${streamer.name} に${text}。`);
    showActionFeedback(streamer.id, action === "like" ? "いいね送信" : "表示+1");
  }

  return (
    <div className="admin-layout">
      <section className="status-band">
        <h2>掲載中の配信者管理</h2>
        <p>申込情報、決済情報、プロフィール情報をこの一覧で確認・修正できます。</p>
        <AdminColorLegend />
        {message && <p className="notice-text">{message}</p>}
        <div className="admin-filter-row">
          <button type="button" className={streamerView === "application" ? "selected" : ""} onClick={() => setStreamerView("application")}>申込順</button>
          <button type="button" className={streamerView === "paid" ? "selected" : ""} onClick={() => setStreamerView("paid")}>有料登録のみ</button>
          <button type="button" className={streamerView === "boost" ? "selected" : ""} onClick={() => setStreamerView("boost")}>上位表示のみ</button>
        </div>
        <div className="admin-filter-row">
          <button className="secondary-button" type="button" onClick={toggleAllVisible}>表示中を一括選択</button>
          <button className="secondary-button" type="button" disabled={bulkBusy} onClick={() => bulkSetVisible(false)}><EyeOff size={16} />選択を非表示</button>
          <button className="secondary-button" type="button" disabled={bulkBusy} onClick={() => bulkSetVisible(true)}><Eye size={16} />選択を表示</button>
          <button className="secondary-button" type="button" disabled={bulkBusy} onClick={sendBulkEngagementToAll}><Heart size={16} />全員にいいね+表示</button>
          <button className="secondary-button" type="button" disabled={bulkBusy} onClick={() => bulkSetXIntroduced(true)}>X紹介済み</button>
          <button className="secondary-button" type="button" disabled={bulkBusy} onClick={() => bulkSetXIntroduced(false)}>X未紹介へ</button>
          <button className="danger-button" type="button" disabled={bulkBusy} onClick={bulkDelete}><Trash2 size={16} />選択を削除</button>
        </div>
      </section>

      <section className="admin-table-list admin-streamer-table">
        {listedStreamers.map((streamer) => {
          const application = applicationByStreamerId.get(streamer.id) || (streamer.source_application_id ? applicationById.get(streamer.source_application_id) : undefined);
          const registeredAt = streamer.created_at || streamer.registered_at || streamer.registeredAt || streamer.createdAt || application?.created_at || streamer.updated_at;
          const lastActionAt = streamer.last_creator_login_at;
          return (
            <article className={streamerCardClassName(streamer, registeredAt)} key={streamer.id}>
              <div className="admin-card-head">
                <label className="choice">
                  <input type="checkbox" checked={selectedIds.includes(streamer.id)} onChange={() => toggleSelected(streamer.id)} />
                  選択
                </label>
                <span className={`state ${streamer.withdrawal_status === "requested" ? "pending" : streamer.is_visible ? "approved" : "rejected"}`}>
                  {streamer.withdrawal_status === "requested" ? "退会申請" : streamer.is_visible ? "表示中" : "非表示"}
                </span>
              </div>
              <h3>{streamer.name}</h3>
              <div className="admin-card-flags">
                <span>登録日 {formatDateOnly(registeredAt)}</span>
                <span>最終操作 {formatDateMinute(lastActionAt)}</span>
                <span>通知 {streamer.notification_enabled ? "ON" : "OFF"}</span>
                <span>いいね {streamer.likes || 0}</span>
                <span>表示 {streamer.impressions || 0}</span>
                <span>ログイン {streamer.creator_login_count || 0}</span>
                <span>{PLAN_LABELS[streamer.plan_type]}</span>
                <span>{ADMIN_PLACEMENT_LABELS[streamer.admin_placement || "normal"]}</span>
                <span className={streamer.x_introduced_at ? "x-introduced" : "x-unintroduced"}>{streamer.x_introduced_at ? "X紹介済み" : "X未紹介"}</span>
                {streamer.is_dummy && <span className="dummy-flag">非実在/テスト</span>}
                {streamer.super_boost_until && isFuture(streamer.super_boost_until) && <span>スーパー中</span>}
                {streamer.has_payment_history && <span>課金履歴</span>}
              </div>
              <div className="admin-quick-actions">
                <button className="secondary-button compact-admin-button" type="button" title={streamer.is_visible === false ? "表示にする" : "非表示にする"} disabled={busyId === streamer.id} onClick={() => updateStreamer(streamer.id, { is_visible: streamer.is_visible === false })}>
                  {streamer.is_visible === false ? <Eye size={14} /> : <EyeOff size={14} />}
                  {streamer.is_visible === false ? "表示" : "非表"}
                </button>
                <button className="secondary-button compact-admin-button" type="button" title="無料プレミアムにする" disabled={busyId === streamer.id} onClick={() => updateStreamer(streamer.id, { plan_type: "boost", grant_source: "admin" })}>無料</button>
                <select
                  className="compact-admin-select"
                  aria-label="スーパーいいねエフェクト"
                  value={selectedSuperEffect(streamer)}
                  onChange={(event) => {
                    const effect = event.target.value as SuperBoostEffect;
                    setSuperEffect(streamer.id, effect);
                    if (isFuture(streamer.super_boost_until)) updateStreamer(streamer.id, { super_boost_effect: effect, grant_source: "admin" });
                  }}
                >
                  {Object.entries(SUPER_BOOST_EFFECT_LABELS).map(([value, label]) => (
                    <option value={value} key={value}>{label}</option>
                  ))}
                </select>
                <button className="secondary-button compact-admin-button" type="button" title="スーパーいいねON" disabled={busyId === streamer.id} onClick={() => setSuperBoostState(streamer, true)}>ON</button>
                <button className="secondary-button compact-admin-button" type="button" title="スーパーいいねOFF" disabled={busyId === streamer.id} onClick={() => setSuperBoostState(streamer, false)}>OFF</button>
                <button className="secondary-button compact-admin-button" type="button" title="プレビュー" disabled={busyId === streamer.id} onClick={() => startPreview(streamer)}><ExternalLink size={14} />プレ</button>
                <button className="secondary-button compact-admin-button" type="button" title="名前・YouTubeURL・Xアカウントをコピー" onClick={() => copyStreamerInfo(streamer, application)}><Copy size={14} />コピー</button>
                <button className="secondary-button compact-admin-button" type="button" title="匿名いいねを1件送る" disabled={busyId === streamer.id} onClick={() => sendAdminEngagement(streamer, "like")}><Heart size={14} />いい</button>
                <button className="secondary-button compact-admin-button" type="button" title="表示回数を1件増やす" disabled={busyId === streamer.id} onClick={() => sendAdminEngagement(streamer, "impression")}><Eye size={14} />表示</button>
                <button className="secondary-button compact-admin-button" type="button" title={streamer.is_dummy ? "実在データとして扱う" : "非実在/テストとして扱う"} disabled={busyId === streamer.id} onClick={() => updateStreamer(streamer.id, { is_dummy: !streamer.is_dummy, is_visible: streamer.is_dummy ? streamer.is_visible : false })}>
                  {streamer.is_dummy ? "実在" : "非実"}
                </button>
                <button className="secondary-button compact-admin-button" type="button" title="編集" onClick={() => startEdit(streamer)}><Edit3 size={14} />編集</button>
              </div>
              {actionFeedback[streamer.id] && <p className="admin-action-feedback">{actionFeedback[streamer.id]}</p>}
              <details className="admin-details">
                <summary>詳細</summary>
                <ImagePreview images={streamer.thumbnails || []} label={`${streamer.name} 画像`} />
                <dl className="data-list">
                  <div><dt>配信者ID</dt><dd>{streamer.id}</dd></div>
                  <div><dt>メール</dt><dd>{streamer.creator_email || application?.email || "未登録"}</dd></div>
                  <div><dt>YouTube</dt><dd>{streamer.youtube_url}</dd></div>
                  <div><dt>カテゴリ</dt><dd>{streamer.categories?.join(" / ") || "未設定"}</dd></div>
                  <div><dt>タグ</dt><dd>{streamer.tags?.join(" / ") || "未設定"}</dd></div>
                  <div><dt>表示回数</dt><dd>{streamer.impressions || 0}</dd></div>
                  <div><dt>いいね</dt><dd>{streamer.likes || 0}</dd></div>
                  <div><dt>通知</dt><dd>{streamer.notification_enabled ? "ON" : "OFF"}</dd></div>
                  <div><dt>ログイン回数</dt><dd>{streamer.creator_login_count || 0}</dd></div>
                  <div><dt>最終ログイン</dt><dd>{formatDateMinute(streamer.last_creator_login_at)}</dd></div>
                  <div><dt>退会申請</dt><dd>{streamer.withdrawal_status === "requested" ? `申請あり ${formatDate(streamer.withdrawal_requested_at)}` : "なし"}</dd></div>
                  <div><dt>非実在/テスト</dt><dd>{streamer.is_dummy ? `はい ${streamer.dummy_reason || ""}` : "いいえ"}</dd></div>
                </dl>
                <div className="admin-filter-row">
                  <label>プラン
                    <select value={streamer.plan_type} onChange={(event) => updateStreamer(streamer.id, { plan_type: event.target.value as PlanType, grant_source: "admin" })}>
                      <option value="free">無料</option>
                      <option value="paid">ベーシック</option>
                      <option value="boost">プレミアム</option>
                    </select>
                  </label>
                  <label>表示優先
                    <select value={streamer.admin_placement || "normal"} onChange={(event) => updateStreamer(streamer.id, { admin_placement: event.target.value as AdminPlacement })}>
                      <option value="top">上位</option>
                      <option value="normal">通常</option>
                      <option value="bottom">下位</option>
                    </select>
                  </label>
                </div>
              </details>
            </article>
          );
        })}
      </section>

      {editing && (
        <div className="editor-panel">
          <div className="editor-head">
            <h2>プロフィール修正</h2>
            <button className="icon-button" type="button" onClick={() => setEditing(null)} aria-label="閉じる"><X size={18} /></button>
          </div>
          <label>名前<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
          <label>配信URL<input value={editing.youtube_url} onChange={(event) => setEditing({ ...editing, youtube_url: event.target.value })} /></label>
          <label>YouTubeチャンネルID<input value={editing.youtube_channel_id || ""} onChange={(event) => setEditing({ ...editing, youtube_channel_id: event.target.value })} /></label>
          <label>おすすめアーカイブURL<input value={editing.archive_url || ""} onChange={(event) => setEditing({ ...editing, archive_url: event.target.value })} /></label>
          <label>プラン
            <select value={editing.plan_type} onChange={(event) => setEditPlan(event.target.value as PlanType)}>
              <option value="free">無料</option>
              <option value="paid">ベーシック</option>
              <option value="boost">プレミアム</option>
            </select>
          </label>
          <label>今日のひとこと<input maxLength={20} value={editing.one_liner || ""} onChange={(event) => setEditing({ ...editing, one_liner: event.target.value.slice(0, 20) })} /></label>
          <label>配信時間帯<input maxLength={50} value={editing.stream_time || ""} onChange={(event) => setEditing({ ...editing, stream_time: event.target.value.slice(0, 50) })} /></label>
          <label>自己紹介<textarea value={editing.description || ""} onChange={(event) => setEditing({ ...editing, description: event.target.value })} /></label>
          <label>画像（無料1枚、ベーシック/プレミアム3枚）
            <input type="file" accept="image/*" multiple={editing.plan_type !== "free"} onChange={onEditFilesChange} />
          </label>
          <ImagePreview images={editing.thumbnails || []} label="編集画像" />
          <fieldset className="chip-fieldset">
            <legend>カテゴリ（{editing.categories.length}/{editCategoryLimit}）</legend>
            {CATEGORIES.map((category) => (
              <button type="button" className={editing.categories.includes(category) ? "chip selected" : "chip"} key={category} onClick={() => toggleEditCategory(category)}>{category}</button>
            ))}
          </fieldset>
          <fieldset className="chip-fieldset">
            <legend>タグ（{editing.tags.length}/{editTagLimit}）</legend>
            {TAGS.map((tag) => (
              <button type="button" className={editing.tags.includes(tag) ? "chip selected" : "chip"} key={tag} onClick={() => toggleEditTag(tag)}>{tag}</button>
            ))}
          </fieldset>
          <button className="primary-button" type="button" onClick={saveEdit} disabled={busyId === editing.id}><Save size={18} />保存</button>
        </div>
      )}

      {previewStreamer && <StreamerPreviewModal streamer={previewStreamer} onClose={() => setPreviewStreamer(null)} />}
    </div>
  );
}

export function AdminColorLegend() {
  return (
    <div className="admin-color-legend" aria-label="管理カード色分けの説明">
      <span><i className="legend-swatch super" />背景青: スーパーいいね適用中</span>
      <span><i className="legend-swatch recent" />背景ピンク: 48時間以内に登録</span>
      <span><i className="legend-swatch premium" />金枠: プレミアム適用中</span>
      <span><i className="legend-swatch paid" />赤枠: 課金関連（配信者=ベーシック / 視聴者=スーパーいいね購入履歴）</span>
    </div>
  );
}

function StreamerPreviewModal({ streamer, onClose }: { streamer: Streamer; onClose: () => void }) {
  const image = streamer.thumbnails?.[0] || "";
  const superEffect = isFuture(streamer.super_boost_until) ? streamer.super_boost_effect || "shine" : "";
  return (
    <div className="admin-preview-backdrop" role="dialog" aria-modal="true" aria-labelledby="streamer-preview-title" onClick={onClose}>
      <div className="admin-preview-modal" onClick={(event) => event.stopPropagation()}>
        <div className="admin-preview-header">
          <h2 id="streamer-preview-title">スワイプ表示プレビュー</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="閉じる"><X size={18} /></button>
        </div>
        <div className={`admin-swipe-preview-card ${superEffect ? `super-effect super-${superEffect}` : ""}`}>
          <div className="admin-swipe-preview-image">
            {image ? (
              <img src={image} alt={`${streamer.name} プレビュー画像`} loading="lazy" decoding="async" />
            ) : (
              <span>画像なし</span>
            )}
          </div>
          <div className="admin-swipe-preview-body">
            <h3>{streamer.name}</h3>
            <p className="admin-swipe-preview-one-liner">{streamer.one_liner || "ひとこと未設定"}</p>
            <div className="tag-row">
              {(streamer.tags || []).slice(0, 5).map((tag) => <span className="tag-pill" key={tag}>{tag}</span>)}
            </div>
            <p className="help-text">{streamer.description || "自己紹介未設定"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImagePreview({ images, label }: { images: string[]; label: string }) {
  if (!images.length) return <p className="help-text">画像なし</p>;
  return (
    <div className="admin-image-row">
      {images.slice(0, 3).map((image, index) => (
        <img src={image} alt={`${label}${index + 1}`} key={`${image.slice(0, 40)}-${index}`} loading="lazy" decoding="async" />
      ))}
    </div>
  );
}

function streamerCardClassName(streamer: Streamer, registeredAt?: string) {
  const backgroundClass = isFuture(streamer.super_boost_until) ? "card-super-active" : isWithinHours(registeredAt, 48) ? "card-recent" : "";
  const borderClass = streamer.plan_type === "boost" ? "card-premium-plan" : streamer.plan_type === "paid" ? "card-paid-plan" : "";
  const introducedClass = streamer.x_introduced_at ? "" : "card-x-unintroduced";
  const dummyClass = streamer.is_dummy ? "card-dummy" : "";
  return ["admin-card", backgroundClass, borderClass, introducedClass, dummyClass].filter(Boolean).join(" ");
}

function extendHours(value: string | undefined, hours: number) {
  const current = value ? new Date(value).getTime() : 0;
  const base = Math.max(Date.now(), Number.isFinite(current) ? current : 0);
  return new Date(base + hours * 60 * 60 * 1000).toISOString();
}

function expiredIso() {
  return new Date(Date.now() - 60 * 1000).toISOString();
}

function isFuture(value: string | undefined) {
  if (!value) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && time > Date.now();
}

function isWithinHours(value: string | undefined, hours: number) {
  if (!value) return false;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= hours * 60 * 60 * 1000;
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function formatDateOnly(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function formatDateMinute(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).replace(/\//g, "-");
}

function adminPlacementSortValue(value?: AdminPlacement) {
  if (value === "top") return 2;
  if (value === "bottom") return 0;
  return 1;
}

function planSortValue(value: PlanType) {
  if (value === "boost") return 3;
  if (value === "paid") return 2;
  return 1;
}

function safeTime(value?: string) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function toggleChoice(current: string[], value: string, limit: number) {
  if (current.includes(value)) return current.filter((item) => item !== value);
  return [...current, value].slice(0, limit);
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}
