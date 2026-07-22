"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FONTS } from "@/lib/tshirt/fonts";
import { calcTShirtTotal } from "@/lib/tshirt/pricing";
import {
  isSameColorConflict,
  isSizeAllowedForFont,
  normalizeInputText,
  validateInputText,
} from "@/lib/tshirt/validation";
import type {
  TShirtDesignSize,
  TShirtKitSettings,
  TShirtSheetColor,
  TShirtShirtColor,
  TShirtShirtSize,
} from "@/lib/tshirt/types";

const SIZE_LABELS: Record<TShirtDesignSize, string> = {
  S: "S / 15cm（スマホ約1台分・控えめ）",
  M: "M / 21cm（A4短辺くらい・標準）",
  L: "L / 28cm（A4長辺に近い・大きく目立つ）",
};

const SHIRT_COLOR_LABELS: Record<TShirtShirtColor, string> = {
  white: "ホワイト",
  black: "ブラック",
};

const SHEET_COLOR_LABELS: Record<TShirtSheetColor, string> = {
  white: "ホワイト",
  black: "ブラック",
  red: "レッド",
  yellow: "イエロー",
  blue: "ブルー",
  gold: "ゴールド（+300円/着）",
  silver: "シルバー（+300円/着）",
};

const SHEET_SWATCH: Record<TShirtSheetColor, string> = {
  white: "#ffffff",
  black: "#111111",
  red: "#d32f2f",
  yellow: "#f5c400",
  blue: "#1e5bd6",
  gold: "#caa54a",
  silver: "#b8bcc2",
};

const CONFIRM_ITEMS = [
  "文字のスペルを確認しました",
  "大文字・小文字を確認しました",
  "フォントを確認しました",
  "Tシャツ色・シート色を確認しました",
  "カス取りが必要な商品であることを理解しました",
  "自分で熱圧着する商品であることを理解しました",
  "注文確定後は変更できないことに同意します",
  "入力した名称等を利用する権利があります",
];

export function TShirtKitOrderForm({ settings }: { settings: TShirtKitSettings }) {
  const [inputText, setInputText] = useState("");
  const [fontId, setFontId] = useState(FONTS[0]?.id || "");
  const [designSize, setDesignSize] = useState<TShirtDesignSize>("M");
  const [shirtColor, setShirtColor] = useState<TShirtShirtColor>("white");
  const [shirtSize, setShirtSize] = useState<TShirtShirtSize>("XL");
  const [sheetColor, setSheetColor] = useState<TShirtSheetColor>("black");
  const [quantity, setQuantity] = useState(1);
  const [checks, setChecks] = useState<boolean[]>(() => CONFIRM_ITEMS.map(() => false));
  const [payerEmail, setPayerEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setPayerEmail(localStorage.getItem("vtuber-match-creator-email") || "");
  }, []);

  // 選択フォントのttfをFontFaceで読み込む（プレビュー用。SVG生成と同一ファイル）。
  useEffect(() => {
    let cancelled = false;
    async function loadFonts() {
      try {
        await Promise.all(
          FONTS.map(async (f) => {
            const face = new FontFace(f.internalFamily, `url(${f.publicFontUrl})`);
            await face.load();
            (document as unknown as { fonts: FontFaceSet }).fonts.add(face);
          }),
        );
      } catch {
        // 読み込み失敗時もプレビューはフォールバックフォントで描画する。
      }
      if (!cancelled) setFontsReady(true);
    }
    loadFonts();
    return () => {
      cancelled = true;
    };
  }, []);

  const font = useMemo(() => FONTS.find((f) => f.id === fontId) || FONTS[0], [fontId]);
  const normalized = useMemo(() => normalizeInputText(inputText), [inputText]);
  const textValidation = useMemo(() => validateInputText(inputText), [inputText]);
  const charCount = normalized.length;

  const sameColor = isSameColorConflict(shirtColor, sheetColor);

  const price = useMemo(
    () => calcTShirtTotal({ quantity, sheetColor }, settings),
    [quantity, sheetColor, settings],
  );

  // フォント切替時、現サイズが選べない場合は最初の選択可能サイズへ寄せる。
  useEffect(() => {
    if (!font) return;
    if (!isSizeAllowedForFont(font, designSize, charCount || 2)) {
      const fallback = (["S", "M", "L"] as TShirtDesignSize[]).find((s) =>
        isSizeAllowedForFont(font, s, charCount || 2),
      );
      if (fallback && fallback !== designSize) setDesignSize(fallback);
    }
  }, [font, designSize, charCount]);

  // キャンバスプレビュー（Tシャツ色背景＋シート色の文字・中央固定）。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !font) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    // Tシャツ色の下地
    ctx.fillStyle = shirtColor === "white" ? "#f4f4f5" : "#1c1c1e";
    ctx.fillRect(0, 0, W, H);
    const text = normalized || "PREVIEW";
    // S/M/Lの相対サイズ（デザイン横幅に応じて文字を拡縮）
    const widthRatio = designSize === "S" ? 0.5 : designSize === "M" ? 0.72 : 0.9;
    const maxTextWidth = W * widthRatio;
    let fontPx = 120;
    ctx.fillStyle = SHEET_SWATCH[sheetColor];
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // フォントサイズを二分探索的に詰める
    for (let i = 0; i < 40; i++) {
      ctx.font = `${fontPx}px "${font.internalFamily}", sans-serif`;
      const w = ctx.measureText(text).width;
      if (w <= maxTextWidth || fontPx <= 12) break;
      fontPx -= 3;
    }
    ctx.font = `${fontPx}px "${font.internalFamily}", sans-serif`;
    ctx.fillText(text, W / 2, H / 2);
  }, [normalized, font, designSize, shirtColor, sheetColor, fontsReady]);

  const allChecked = checks.every(Boolean);
  const canOrder =
    textValidation.ok &&
    !sameColor &&
    !!font &&
    isSizeAllowedForFont(font, designSize, charCount) &&
    quantity >= 1 &&
    quantity <= settings.maxQuantity &&
    allChecked &&
    !busy;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canOrder || !font) return;
    setBusy(true);
    setStatus("注文を作成しています...");
    try {
      const response = await fetch("/api/tshirt-orders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputText: normalized,
          fontId: font.id,
          designSize,
          shirtColor,
          shirtSize,
          sheetColor,
          quantity,
          rightsConfirmed: checks[7] === true,
          finalConfirmationAccepted: checks[6] === true,
          payerEmail,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) {
        setBusy(false);
        setStatus(data.error || "注文の作成に失敗しました。時間をおいてお試しください。");
        return;
      }
      setStatus("決済ページへ移動します...");
      window.location.href = data.url;
    } catch {
      setBusy(false);
      setStatus("通信エラーが発生しました。時間をおいてお試しください。");
    }
  }

  return (
    <form className="tshirt-form" onSubmit={submit} style={{ display: "grid", gap: 20 }}>
      {/* 1. 文字入力 */}
      <section className="status-band" style={{ display: "grid", gap: 8 }}>
        <label className="field-label" htmlFor="tshirt_text">プリントする文字（2〜15文字・英数字と & - . と半角スペース）</label>
        <input
          id="tshirt_text"
          type="text"
          value={inputText}
          maxLength={20}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Keisuke Family"
          style={{ padding: "10px 12px", fontSize: 16 }}
        />
        {inputText && !textValidation.ok && (
          <p style={{ color: "#d32f2f", margin: 0 }}>{textValidation.error}</p>
        )}
      </section>

      {/* 2. フォント */}
      <section className="status-band" style={{ display: "grid", gap: 10 }}>
        <span className="field-label">フォント</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
          {FONTS.map((f) => {
            const selected = f.id === fontId;
            return (
              <button
                type="button"
                key={f.id}
                onClick={() => setFontId(f.id)}
                style={{
                  textAlign: "left",
                  padding: 12,
                  borderRadius: 10,
                  border: selected ? "2px solid #1e5bd6" : "1px solid #ccc",
                  background: selected ? "#eef3ff" : "#fff",
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "block", fontFamily: `"${f.internalFamily}", sans-serif`, fontSize: 22, lineHeight: 1.2 }}>
                  {normalized || f.displayName}
                </span>
                <small style={{ color: "#666" }}>
                  {f.displayName}・{f.category}・カス取り{f.weedingDifficulty === "easy" ? "易" : f.weedingDifficulty === "normal" ? "普通" : "上級"}
                </small>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. サイズ・シート色 */}
      <section className="status-band" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <span className="field-label">デザインサイズ</span>
          {(["S", "M", "L"] as TShirtDesignSize[]).map((s) => {
            const allowed = font ? isSizeAllowedForFont(font, s, charCount || 2) : false;
            return (
              <label key={s} style={{ display: "flex", gap: 8, alignItems: "center", opacity: allowed ? 1 : 0.45 }}>
                <input
                  type="radio"
                  name="designSize"
                  value={s}
                  checked={designSize === s}
                  disabled={!allowed}
                  onChange={() => setDesignSize(s)}
                />
                <span>{SIZE_LABELS[s]}{!allowed && "（このフォント/文字数では選べません）"}</span>
              </label>
            );
          })}
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <span className="field-label">熱転写シート色</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {settings.availableSheetColors.map((c) => {
              const conflict = isSameColorConflict(shirtColor, c);
              const selected = sheetColor === c;
              return (
                <button
                  type="button"
                  key={c}
                  disabled={conflict}
                  onClick={() => setSheetColor(c)}
                  title={conflict ? "Tシャツと同色のため選択できません。" : ""}
                  style={{
                    display: "flex", gap: 6, alignItems: "center", padding: "6px 10px", borderRadius: 8,
                    border: selected ? "2px solid #1e5bd6" : "1px solid #ccc",
                    background: conflict ? "#f0f0f0" : "#fff",
                    color: conflict ? "#999" : "#222",
                    cursor: conflict ? "not-allowed" : "pointer",
                  }}
                >
                  <span style={{ width: 16, height: 16, borderRadius: "50%", background: SHEET_SWATCH[c], border: "1px solid #999" }} />
                  {SHEET_COLOR_LABELS[c]}
                </button>
              );
            })}
          </div>
          {sameColor && <p style={{ color: "#d32f2f", margin: 0 }}>Tシャツと同色のシートは選べません。別の色を選んでください。</p>}
        </div>
      </section>

      {/* 4. Tシャツ色・サイズ・数量 */}
      <section className="status-band" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <span className="field-label">Tシャツ色</span>
          <div style={{ display: "flex", gap: 8 }}>
            {settings.availableShirtColors.map((c) => (
              <label key={c} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="radio" name="shirtColor" value={c} checked={shirtColor === c} onChange={() => setShirtColor(c)} />
                {SHIRT_COLOR_LABELS[c]}
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <span className="field-label">Tシャツサイズ（おすすめ: XL）</span>
          <div style={{ display: "flex", gap: 8 }}>
            {settings.availableShirtSizes.map((s) => (
              <label key={s} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="radio" name="shirtSize" value={s} checked={shirtSize === s} onChange={() => setShirtSize(s)} />
                {s}
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <label className="field-label" htmlFor="tshirt_qty">数量（1〜{settings.maxQuantity}着 / 5着以上で送料無料）</label>
          <input
            id="tshirt_qty"
            type="number"
            min={1}
            max={settings.maxQuantity}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(settings.maxQuantity, Math.floor(Number(e.target.value) || 1))))}
            style={{ padding: "8px 10px", width: 120, fontSize: 16 }}
          />
        </div>
      </section>

      {/* 5. プレビュー・料金 */}
      <section className="status-band" style={{ display: "grid", gap: 12 }}>
        <span className="field-label">プレビュー（完成イメージ・配置は中央固定）</span>
        <canvas ref={canvasRef} width={640} height={360} style={{ width: "100%", maxWidth: 420, borderRadius: 10, border: "1px solid #ddd" }} />
        <p style={{ color: "#666", margin: 0, fontSize: 13 }}>
          プレビューは完成イメージです。実際の配置は購入者自身で調整できます。
        </p>
        <div style={{ display: "grid", gap: 4 }}>
          <div>基本料金: ¥{price.unitPrice.toLocaleString("ja-JP")} × {quantity} = ¥{price.subtotal.toLocaleString("ja-JP")}</div>
          {price.specialColorFee > 0 && (
            <div>特殊色加算: ¥{price.specialColorFeePerUnit.toLocaleString("ja-JP")} × {quantity} = ¥{price.specialColorFee.toLocaleString("ja-JP")}</div>
          )}
          <div>送料: {price.freeShipping ? "無料（5着以上）" : `¥${price.shippingFee.toLocaleString("ja-JP")}`}</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>合計: ¥{price.total.toLocaleString("ja-JP")}</div>
        </div>
      </section>

      {/* 注文前確認 */}
      <section className="status-band" style={{ display: "grid", gap: 8 }}>
        <span className="field-label">ご注文前の確認（すべてチェックで決済できます）</span>
        {CONFIRM_ITEMS.map((label, i) => (
          <label key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <input
              type="checkbox"
              checked={checks[i]}
              onChange={(e) => setChecks((c) => c.map((v, idx) => (idx === i ? e.target.checked : v)))}
            />
            <span>{label}</span>
          </label>
        ))}
        <label className="field-label" htmlFor="tshirt_email" style={{ marginTop: 8 }}>連絡先メール（任意）</label>
        <input
          id="tshirt_email"
          type="email"
          value={payerEmail}
          onChange={(e) => setPayerEmail(e.target.value)}
          placeholder="you@example.com"
          style={{ padding: "8px 10px", fontSize: 16 }}
        />
      </section>

      <button type="submit" className="primary-button" disabled={!canOrder} style={{ padding: "12px 20px", fontSize: 16 }}>
        {busy ? "処理中..." : `¥${price.total.toLocaleString("ja-JP")} を決済する`}
      </button>
      {status && <p aria-live="polite" style={{ margin: 0 }}>{status}</p>}
    </form>
  );
}
