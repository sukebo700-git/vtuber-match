// 入力バリデーション（仕様書3.1/3.5/3.8）。クライアント・サーバー両方で使う純粋関数。
import type { FontConfig, TShirtDesignSize } from "./types";

// 許可文字: 英大小・数字・記号(&-.)・空白（仕様書3.1）
const ALLOWED_CHAR_RE = /^[A-Za-z0-9&.\- ]{2,15}$/;
const NON_SYMBOL_RE = /[A-Za-z0-9]/; // 記号のみ入力を禁止するため、英数字が最低1つ必要

export type TextValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

// 前後trim・連続空白を1つへ正規化してから検証する。
export function normalizeInputText(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export function validateInputText(raw: string): TextValidationResult {
  const value = normalizeInputText(raw);

  if (value.length < 2) {
    return { ok: false, error: "2文字以上入力してください。" };
  }
  if (value.length > 15) {
    return { ok: false, error: "15文字以内で入力してください。" };
  }
  // 空白は最大2個（正規化後の半角スペース数で判定）
  const spaceCount = (value.match(/ /g) || []).length;
  if (spaceCount > 2) {
    return { ok: false, error: "空白は最大2個までです。" };
  }
  if (!ALLOWED_CHAR_RE.test(value)) {
    return {
      ok: false,
      error: "英数字と記号（& - .）、半角スペースのみ使用できます。",
    };
  }
  if (!NON_SYMBOL_RE.test(value)) {
    return { ok: false, error: "記号だけの入力はできません。" };
  }
  return { ok: true, value };
}

// Tシャツとシートが同色なら選択不可（仕様書3.8）。
export function isSameColorConflict(
  shirtColor: string,
  sheetColor: string,
): boolean {
  if (shirtColor === "white" && sheetColor === "white") return true;
  if (shirtColor === "black" && sheetColor === "black") return true;
  return false;
}

// フォントごとのサイズ制限（仕様書3.4/3.5）。allowedSizes と maxCharacters で判定する。
export function isSizeAllowedForFont(
  font: FontConfig,
  size: TShirtDesignSize,
  charCount: number,
): boolean {
  if (!font.allowedSizes.includes(size)) return false;
  // 文字数が多い場合、Sサイズは品質が落ちるため不可（仕様書3.5: 11文字以上でS不可 等）。
  if (size === "S" && charCount >= 11) return false;
  if (charCount > font.maxCharacters) return false;
  return true;
}
