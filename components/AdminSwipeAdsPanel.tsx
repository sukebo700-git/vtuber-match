"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { SwipeAdCard, SwipeAdSettings } from "@/lib/swipeAds";

type GoodsItem = {
  id: string;
  streamer_id: string;
  streamer_name: string;
  title: string;
  url: string;
  description: string;
  status: string;
  admin_note: string;
  updated_at: string;
};

const statusLabels: Record<string, string> = {
  pending: "審査待ち",
  approved: "掲載中",
  rejected: "見送り",
};

export function AdminSwipeAdsPanel({ adminKey }: { adminKey: string }) {
  const [settings, setSettings] = useState<SwipeAdSettings | null>(null);
  const [goods, setGoods] = useState<GoodsItem[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadGoods = useCallback(() => {
    fetch("/api/admin/vtuber-goods", { headers: { "x-admin-key": adminKey } })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => Array.isArray(data?.items) && setGoods(data.items))
      .catch(() => undefined);
  }, [adminKey]);

  useEffect(() => {
    fetch("/api/admin/swipe-ads", { headers: { "x-admin-key": adminKey } })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => data?.settings && setSettings(data.settings))
      .catch(() => undefined);
    loadGoods();
  }, [adminKey, loadGoods]);

  function updateSettings(patch: Partial<SwipeAdSettings>) {
    setSettings((current) => (current ? { ...current, ...patch } : current));
  }

  function updateCard(index: number, patch: Partial<SwipeAdCard>) {
    setSettings((current) => {
      if (!current) return current;
      const cards = current.cards.map((card, cardIndex) => (cardIndex === index ? { ...card, ...patch } : card));
      return { ...current, cards };
    });
  }

  function addCard() {
    setSettings((current) => {
      if (!current) return current;
      const card: SwipeAdCard = {
        id: `ad-${Date.now().toString(36)}`,
        label: "",
        title: "",
        image_url: "",
        url: "",
        provider: "rakuten",
        is_active: true,
      };
      return { ...current, cards: [...current.cards, card] };
    });
  }

  function removeCard(index: number) {
    setSettings((current) => {
      if (!current) return current;
      return { ...current, cards: current.cards.filter((_, cardIndex) => cardIndex !== index) };
    });
  }

  async function save() {
    if (!settings) return;
    setBusy(true);
    setMessage("保存しています...");
    const response = await fetch("/api/admin/swipe-ads", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify(settings),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(data.error || "保存できませんでした。");
      return;
    }
    // サーバー側で正規化された結果(不正URLの除去など)を反映する
    if (data.settings) setSettings(data.settings);
    setMessage("保存しました。");
  }

  async function reviewGoods(id: string, status: "approved" | "rejected") {
    const note = status === "rejected" ? window.prompt("見送りの理由(配信者に表示されます・任意)") ?? "" : "";
    setBusy(true);
    const response = await fetch(`/api/admin/vtuber-goods/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ status, admin_note: note }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(data.error || "更新できませんでした。");
      return;
    }
    setMessage(status === "approved" ? "掲載を承認しました。" : "見送りにしました。");
    loadGoods();
  }

  return (
    <>
      <section className="status-band">
        <h2>スワイプ広告の設定</h2>
        <p>リスナーのスワイプ画面に差し込む広告カードの頻度と内容を設定します。</p>
        {message && <p className="notice-text">{message}</p>}

        {!settings ? (
          <p className="help-text">読み込んでいます...</p>
        ) : (
          <>
            <label className="choice">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(event) => updateSettings({ enabled: event.target.checked })}
              />
              広告カードを表示する(オフの間はスワイプに一切出ません)
            </label>

            <div className="admin-filter-row" style={{ marginTop: 12 }}>
              <div className="field">
                <label htmlFor="guest_interval">未登録: 何人見たら1枚</label>
                <input
                  id="guest_interval"
                  type="number"
                  min={3}
                  max={200}
                  value={settings.guest_interval}
                  onChange={(event) => updateSettings({ guest_interval: Number(event.target.value) })}
                />
              </div>
              <div className="field">
                <label htmlFor="free_interval">無料登録: 何人見たら1枚</label>
                <input
                  id="free_interval"
                  type="number"
                  min={3}
                  max={200}
                  value={settings.free_interval}
                  onChange={(event) => updateSettings({ free_interval: Number(event.target.value) })}
                />
              </div>
            </div>
            <p className="help-text">3〜200の範囲で設定できます。広告カード自体は閲覧人数にカウントされません。</p>

            <h3 style={{ marginTop: 18 }}>アフィリエイト広告カード</h3>
            <p className="help-text">
              楽天・Yahoo!の商品リンクをそのまま登録します。規約上、短縮URLや中間リダイレクトは使わず、
              https から始まる完全なアフィリエイトURLを貼ってください。
            </p>

            {settings.cards.map((card, index) => (
              <div className="status-band" key={card.id} style={{ marginTop: 10 }}>
                <div className="admin-filter-row">
                  <div className="field">
                    <label>管理用ラベル</label>
                    <input value={card.label} onChange={(event) => updateCard(index, { label: event.target.value })} placeholder="例: コンデンサマイク" />
                  </div>
                  <div className="field">
                    <label>提供元</label>
                    <select value={card.provider} onChange={(event) => updateCard(index, { provider: event.target.value as SwipeAdCard["provider"] })}>
                      <option value="rakuten">楽天</option>
                      <option value="yahoo">Yahoo!ショッピング</option>
                      <option value="other">その他</option>
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>カードに表示する文言</label>
                  <input value={card.title} onChange={(event) => updateCard(index, { title: event.target.value })} maxLength={80} />
                </div>
                <div className="field">
                  <label>商品画像URL</label>
                  <input value={card.image_url} onChange={(event) => updateCard(index, { image_url: event.target.value })} placeholder="https://..." />
                </div>
                <div className="field">
                  <label>アフィリエイトURL</label>
                  <input value={card.url} onChange={(event) => updateCard(index, { url: event.target.value })} placeholder="https://..." />
                </div>
                <div className="admin-filter-row">
                  <label className="choice">
                    <input type="checkbox" checked={card.is_active} onChange={(event) => updateCard(index, { is_active: event.target.checked })} />
                    有効
                  </label>
                  <button className="danger-button" type="button" onClick={() => removeCard(index)}>
                    <Trash2 size={16} />削除
                  </button>
                </div>
              </div>
            ))}

            <div className="admin-filter-row" style={{ marginTop: 12 }}>
              <button className="secondary-button" type="button" onClick={addCard}>
                <Plus size={16} />カードを追加
              </button>
              <button className="primary-button" type="button" disabled={busy} onClick={save}>
                <Save size={16} />設定を保存
              </button>
            </div>
          </>
        )}
      </section>

      <section className="status-band">
        <h2>VTuberグッズ枠の審査</h2>
        <p>プレミアムプランの配信者が申請したグッズを確認し、承認するとスワイプ画面に掲載されます。</p>
        {!goods.length ? (
          <p className="help-text">申請はありません。</p>
        ) : (
          goods.map((item) => (
            <div className="status-band" key={item.id} style={{ marginTop: 10 }}>
              <div className="admin-card-flags">
                <span className={item.status === "pending" ? "x-unintroduced" : "x-introduced"}>
                  {statusLabels[item.status] || item.status}
                </span>
                <span>{item.streamer_name}</span>
              </div>
              <h3>{item.title}</h3>
              {item.description && <p className="help-text">{item.description}</p>}
              <p className="help-text">
                <a href={item.url} target="_blank" rel="noreferrer noopener">{item.url}</a>
              </p>
              {/* 審査中の画像は公開ルートでは配信されないため、管理者専用ルートで表示する */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/admin/vtuber-goods/${encodeURIComponent(item.id)}/image?v=${encodeURIComponent(item.updated_at)}`}
                alt={`${item.title} の申請画像`}
                style={{ width: "100%", maxWidth: 200, borderRadius: 12 }}
                onError={(event) => { (event.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
              <div className="admin-filter-row">
                <button className="secondary-button" type="button" disabled={busy || item.status === "approved"} onClick={() => reviewGoods(item.id, "approved")}>
                  承認して掲載
                </button>
                <button className="danger-button" type="button" disabled={busy || item.status === "rejected"} onClick={() => reviewGoods(item.id, "rejected")}>
                  見送り
                </button>
              </div>
              {item.admin_note && <p className="help-text">メモ: {item.admin_note}</p>}
            </div>
          ))
        )}
      </section>
    </>
  );
}
