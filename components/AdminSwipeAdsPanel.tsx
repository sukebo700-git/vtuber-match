"use client";

import { Plus, RefreshCw, Save, Trash2 } from "lucide-react";
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

type ParsedSnippet = {
  url: string;
  imageUrl: string;
  title: string;
  provider: SwipeAdCard["provider"];
};

/**
 * もしもアフィリエイトのHTMLタグから必要な要素を取り出す。
 * - 商品リンク: <a href="af.moshimo.com/..."><img src="thumbnail.image.rakuten.co.jp/..."></a> + 計測用1x1画像
 * - かんたんリンク: Amazon/楽天/Yahoo!の複数リンクが並ぶため、楽天を優先して選ぶ
 * DOMParserを使うことで &amp; などのHTMLエンティティも自動で復号される。
 */
function parseAffiliateSnippet(html: string): ParsedSnippet {
  const empty: ParsedSnippet = { url: "", imageUrl: "", title: "", provider: "other" };
  const source = html.trim();
  if (!source) return empty;

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(source, "text/html");
  } catch {
    return empty;
  }

  const hrefs = Array.from(doc.querySelectorAll("a[href]"))
    .map((anchor) => anchor.getAttribute("href") || "")
    .filter((href) => /^https:\/\//i.test(href));
  if (!hrefs.length) return empty;

  // 楽天と提携しているため、複数候補があるときは楽天のリンクを優先する
  const url =
    hrefs.find((href) => /moshimo/i.test(href) && /rakuten/i.test(decodeURIComponent(href))) ||
    hrefs.find((href) => /moshimo/i.test(href)) ||
    hrefs[0];

  const images = Array.from(doc.querySelectorAll("img[src]"))
    .filter((img) => {
      const src = img.getAttribute("src") || "";
      if (!/^https:\/\//i.test(src)) return false;
      // 計測用の1x1透明ピクセルは商品画像ではないので除外する
      if (/impression/i.test(src)) return false;
      if (/i\.moshimo\.com/i.test(src)) return false;
      const width = Number(img.getAttribute("width") || 0);
      const height = Number(img.getAttribute("height") || 0);
      if (width === 1 || height === 1) return false;
      return true;
    });

  const imageUrl = images[0]?.getAttribute("src") || "";
  const title =
    images[0]?.getAttribute("alt")?.trim() ||
    doc.querySelector("a[href]")?.textContent?.trim() ||
    "";

  const decoded = safeDecode(url);
  const provider: SwipeAdCard["provider"] = /rakuten/i.test(decoded)
    ? "rakuten"
    : /yahoo|shopping\.geocities|paypaymall/i.test(decoded)
      ? "yahoo"
      : "other";

  return { url, imageUrl, title, provider };
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function AdminSwipeAdsPanel({ adminKey }: { adminKey: string }) {
  const [settings, setSettings] = useState<SwipeAdSettings | null>(null);
  const [goods, setGoods] = useState<GoodsItem[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [snippet, setSnippet] = useState("");

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

  /** もしもの商品リンク/かんたんリンクのHTMLから、画像URLとアフィリエイトURLを取り出してカード化する */
  function addCardFromSnippet() {
    const parsed = parseAffiliateSnippet(snippet);
    if (!parsed.url) {
      setMessage("HTMLタグからリンクを読み取れませんでした。もしもの「商品リンク」で生成されたタグをそのまま貼り付けてください。");
      return;
    }
    setSettings((current) => {
      if (!current) return current;
      const card: SwipeAdCard = {
        id: `ad-${Date.now().toString(36)}`,
        label: parsed.title.slice(0, 60),
        title: parsed.title.slice(0, 80),
        image_url: parsed.imageUrl,
        url: parsed.url,
        provider: parsed.provider,
        is_active: true,
      };
      return { ...current, cards: [...current.cards, card] };
    });
    setSnippet("");
    setMessage(
      parsed.imageUrl
        ? "カードを追加しました。文言を確認して保存してください。"
        : "カードを追加しましたが、画像URLを読み取れませんでした。手動で入力してください。",
    );
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

  async function checkStock() {
    setBusy(true);
    setMessage("楽天APIで在庫を確認しています(商品数によっては少し時間がかかります)...");
    const response = await fetch("/api/admin/swipe-ads/check-stock", {
      method: "POST",
      headers: { "x-admin-key": adminKey },
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(data.error || "在庫を確認できませんでした。");
      return;
    }
    if (data.settings) setSettings(data.settings);
    setMessage(
      `在庫を確認しました(確認${data.checked}件 / 売り切れ${data.sold_out}件 / 対象外${data.skipped}件)。` +
      "売り切れの商品はスワイプに表示されなくなります。",
    );
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
              もしもアフィリエイトが生成したHTMLタグをそのまま貼り付けると、画像URLとリンクを自動で取り出します。
              リンクはもしもの計測URLのまま使い、こちらで短縮・改変はしません。
            </p>

            <div className="field">
              <label htmlFor="moshimo_snippet">もしものHTMLタグから追加</label>
              <textarea
                id="moshimo_snippet"
                rows={3}
                value={snippet}
                onChange={(event) => setSnippet(event.target.value)}
                placeholder={'もしもの「商品リンク」で生成された <a href="https://af.moshimo.com/...">...</a> をそのまま貼り付け'}
              />
              <div className="admin-filter-row">
                <button className="secondary-button" type="button" onClick={addCardFromSnippet} disabled={!snippet.trim()}>
                  <Plus size={16} />解析してカードを追加
                </button>
              </div>
            </div>

            {settings.cards.map((card, index) => (
              <div className="status-band" key={card.id} style={{ marginTop: 10 }}>
                <div className="admin-filter-row">
                  <div className="field">
                    <label>管理用ラベル</label>
                    <input value={card.label} onChange={(event) => updateCard(index, { label: event.target.value })} placeholder="例: 痛バッグ / アクスタケース" />
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
                  <span className={card.stock_status === "sold_out" ? "x-unintroduced" : "x-introduced"}>
                    在庫: {card.stock_status === "sold_out" ? "売り切れ(非表示)" : card.stock_status === "in_stock" ? "あり" : "未確認"}
                  </span>
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
              <button className="secondary-button" type="button" disabled={busy} onClick={checkStock}>
                <RefreshCw size={16} />楽天の在庫を確認
              </button>
            </div>
            <p className="help-text">
              「楽天の在庫を確認」を押すと、登録した楽天商品の在庫を調べ、売り切れのカードを自動でスワイプから外します。
              判定できなかったカードは念のため表示を維持します。
            </p>
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
