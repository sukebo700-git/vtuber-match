// Tシャツキットの料金・在庫設定。初期値は定数で持ち、環境変数で上書き可能にする
// （仕様書2.3/2.4: ハードコードせず管理画面/環境変数で変更可能にする）。
import type {
  TShirtKitSettings,
  TShirtSheetColor,
  TShirtShirtColor,
  TShirtShirtSize,
} from "./types";

export const TSHIRT_DEFAULTS = {
  basePrice: 1980,
  specialColorFee: 300,
  shippingFee: 500,
  freeShippingQuantity: 5,
  maxQuantity: 10,
} as const;

export const AVAILABLE_SHIRT_COLORS: TShirtShirtColor[] = ["white", "black"];
export const AVAILABLE_SHIRT_SIZES: TShirtShirtSize[] = ["M", "L", "XL"];
export const DEFAULT_SHIRT_SIZE: TShirtShirtSize = "XL";
export const AVAILABLE_SHEET_COLORS: TShirtSheetColor[] = [
  "white",
  "black",
  "red",
  "yellow",
  "blue",
  "gold",
  "silver",
];

function numFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === null || String(raw).trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

// 環境変数から現在の設定を組み立てる（Firestoreの tshirt_settings/main によるUI編集は次パス）。
export function getTShirtSettings(): TShirtKitSettings {
  return {
    // 安全策: 明示的に "true" のときだけ有効。未設定・その他は無効(=公開サイトに出さない)。
    // 完全稼働を実証するまで、本番では環境変数を設定せず非表示のままにする。
    enabled: (process.env.T_SHIRT_KIT_ENABLED || "").toLowerCase() === "true",
    basePrice: numFromEnv("T_SHIRT_BASE_PRICE", TSHIRT_DEFAULTS.basePrice),
    specialColorFee: numFromEnv("T_SHIRT_SPECIAL_COLOR_FEE", TSHIRT_DEFAULTS.specialColorFee),
    shippingFee: numFromEnv("T_SHIRT_SHIPPING_FEE", TSHIRT_DEFAULTS.shippingFee),
    freeShippingQuantity: numFromEnv(
      "T_SHIRT_FREE_SHIPPING_QUANTITY",
      TSHIRT_DEFAULTS.freeShippingQuantity,
    ),
    maxQuantity: numFromEnv("T_SHIRT_MAX_QUANTITY", TSHIRT_DEFAULTS.maxQuantity),
    availableShirtColors: AVAILABLE_SHIRT_COLORS,
    availableShirtSizes: AVAILABLE_SHIRT_SIZES,
    availableSheetColors: AVAILABLE_SHEET_COLORS,
  };
}
