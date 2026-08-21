"use client";

import { ImagePlus, Send } from "lucide-react";
import { useEffect, useState } from "react";

// 画像はクライアント側で圧縮してから送る(ApplicationFormと同じ方式)。
// サーバー側の上限は200KBだが、余裕を持って180KBを目標にする。
const maxImagePayload = 180_000;

type GoodsState = {
  title: string;
  url: string;
  description: string;
  image: string;
  status: string;
  admin_note: string;
};

const emptyGoods: GoodsState = {
  title: "",
  url: "",
  description: "",
  image: "",
  status: "",
  admin_note: "",
};

const statusLabels: Record<string, string> = {
  pending: "審査中",
  approved: "掲載中",
  rejected: "見送り",
};

export function CreatorGoodsForm() {
  const [goods, setGoods] = useState<GoodsState>(emptyGoods);
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [planType, setPlanType] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/creator-goods")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) {
          setEligible(false);
          return;
        }
        setEligible(data.eligible === true);
        setPlanType(String(data.plan_type || ""));
        if (data.goods) {
          setGoods({
            title: data.goods.title || "",
            url: data.goods.url || "",
            description: data.goods.description || "",
            image: data.goods.image || "",
            status: data.goods.status || "",
            admin_note: data.goods.admin_note || "",
          });
        }
      })
      .catch(() => setEligible(false));
  }, []);

  function update(patch: Partial<GoodsState>) {
    setGoods((current) => ({ ...current, ...patch }));
  }

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus("画像を調整しています...");
    const encoded = await fileToDataUrl(file);
    if (!encoded) {
      setStatus("この画像は登録できませんでした。別の画像でお試しください。");
      return;
    }
    update({ image: encoded });
    setStatus("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus("送信しています...");
    const response = await fetch("/api/creator-goods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: goods.title,
        url: goods.url,
        description: goods.description,
        image: goods.image,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setStatus(data.error || `送信できませんでした。エラーコード: ${response.status}`);
      return;
    }
    update({ status: "pending" });
    setStatus("申請を受け付けました。運営の確認後にスワイプ画面へ掲載されます。");
  }

  if (eligible === null) {
    return <p className="help-text">読み込んでいます...</p>;
  }

  if (!eligible) {
    return (
      <section className="status-band">
        <h2>プレミアムプラン限定の機能です</h2>
        <p>
          グッズ掲載枠はプレミアムプラン(月額980円)の特典です。
          {planType && planType !== "boost" ? "現在のプランではご利用いただけません。" : ""}
        </p>
        <p className="inline-actions" style={{ marginTop: 12 }}>
          <a className="primary-button" href="/creator/upgrade">プランを確認する</a>
          <a className="secondary-button" href="/creator">配信者ページへ戻る</a>
        </p>
      </section>
    );
  }

  return (
    <form className="form compact-form" onSubmit={submit}>
      {goods.status && (
        <div className="status-band">
          <p>
            現在のステータス: <strong>{statusLabels[goods.status] || goods.status}</strong>
          </p>
          {goods.status === "rejected" && goods.admin_note && (
            <p className="help-text">運営からの連絡: {goods.admin_note}</p>
          )}
          {goods.status === "approved" && (
            <p className="help-text">内容を変更して再送信すると、もう一度審査になります。</p>
          )}
        </div>
      )}

      <div className="field">
        <label htmlFor="goods_title">グッズ名</label>
        <input
          id="goods_title"
          value={goods.title}
          onChange={(event) => update({ title: event.target.value })}
          required
          maxLength={80}
          placeholder="例: 誕生日記念アクリルスタンド"
        />
      </div>

      <div className="field">
        <label htmlFor="goods_url">購入先URL</label>
        <input
          id="goods_url"
          type="url"
          value={goods.url}
          onChange={(event) => update({ url: event.target.value })}
          required
          placeholder="https://example.booth.pm/items/0000000"
        />
        <p className="help-text">BOOTHなど、実際に購入できるページのURLを入力してください。短縮URLは使用できません。</p>
      </div>

      <div className="field">
        <label htmlFor="goods_description">ひとこと紹介 任意</label>
        <input
          id="goods_description"
          value={goods.description}
          onChange={(event) => update({ description: event.target.value })}
          maxLength={100}
          placeholder="例: 受注生産・8月末まで"
        />
      </div>

      <div className="field">
        <span className="field-label">
          <ImagePlus size={16} /> グッズ画像
        </span>
        {goods.image && (
          <img
            src={goods.image}
            alt="グッズ画像プレビュー"
            style={{ width: "100%", maxWidth: 260, borderRadius: 12 }}
          />
        )}
        <input type="file" accept="image/*" onChange={onFileChange} />
        <p className="help-text">スワイプ画面のカードに表示されます。自動で軽量化されます。</p>
      </div>

      <p className="help-text">
        送信すると運営が内容を確認します。承認されると、リスナーのスワイプ画面にグッズカードとして表示されます。
      </p>

      <button className="primary-button" type="submit" disabled={busy}>
        <Send size={18} />
        {busy ? "送信中..." : goods.status ? "内容を更新して再申請" : "掲載を申請する"}
      </button>
      {status && <p className="notice-text">{status}</p>}
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
  for (const max of [720, 640, 560, 480, 420, 360]) {
    const scale = Math.min(1, max / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.72, 0.62, 0.52, 0.44, 0.36, 0.28]) {
      const encoded = canvas.toDataURL("image/jpeg", quality);
      if (!best || encoded.length < best.length) best = encoded;
      if (encoded.length <= maxImagePayload) return encoded;
    }
  }

  return best || canvas.toDataURL("image/jpeg", 0.3);
}
