// VTuberオリジナルネームTシャツ作成キットの型定義（仕様書8章・3.4準拠）
// このフィーチャーは lib/tshirt/ 配下に隔離し、共有ファイルへの差分を最小化する。

export type TShirtDesignSize = "S" | "M" | "L";
export type TShirtShirtColor = "white" | "black";
export type TShirtShirtSize = "M" | "L" | "XL";
export type TShirtSheetColor =
  | "white"
  | "black"
  | "red"
  | "yellow"
  | "blue"
  | "gold"
  | "silver";

export type TShirtPaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type TShirtProductionStatus =
  | "waiting"
  | "svg_generated"
  | "svg_generation_failed"
  | "cutting"
  | "cut_complete"
  | "packed"
  | "shipped"
  | "cancelled";

// 横幅の規定値(mm)。S=150 / M=210 / L=280。
export type TShirtDesignWidthMm = 150 | 210 | 280;

export const DESIGN_WIDTH_MM: Record<TShirtDesignSize, TShirtDesignWidthMm> = {
  S: 150,
  M: 210,
  L: 280,
};

export type FontCategory =
  | "定番・長い名前向け"
  | "太字・インパクト"
  | "かわいい・ポップ"
  | "筆記体・上品"
  | "個性的・ロゴ感";

export type WeedingDifficulty = "easy" | "normal" | "advanced";

// 仕様書3.4のFontConfig。フォントごとの選択可能サイズ・カス取り難易度などを持つ。
export type FontConfig = {
  id: string;
  displayName: string;
  internalFamily: string;
  category: FontCategory;
  previewLabel: string;
  allowedSizes: TShirtDesignSize[];
  maxCharacters: number;
  maxSpaces?: number; // 未指定時はグローバル上限(2)を適用
  minStrokeWidthMm?: number;
  weedingDifficulty: WeedingDifficulty;
  recommendedFor: string[];
  licenseFilePath: string; // リポジトリ内のライセンス文書パス
  fontFilePath: string; // process.cwd() からの相対パス（サーバー側 opentype.js 読込用）
  publicFontUrl: string; // クライアント側 font-face 用（public/ 配下）
};

export type TShirtKitOrder = {
  id: string;
  orderNumber: string; // VMK-YYYYMMDD-NNNN
  userId: string; // 配信者セッションの streamer_id / application_id / email から解決

  inputText: string;
  fontId: string;
  fontDisplayName: string;

  designSize: TShirtDesignSize;
  designWidthMm: TShirtDesignWidthMm;

  shirtColor: TShirtShirtColor;
  shirtSize: TShirtShirtSize;
  sheetColor: TShirtSheetColor;

  quantity: number;

  unitPrice: number;
  specialColorFeePerUnit: number;
  shippingFee: number;
  totalAmount: number;

  rightsConfirmed: boolean;
  finalConfirmationAccepted: boolean;

  paymentStatus: TShirtPaymentStatus;
  productionStatus: TShirtProductionStatus;

  // 生成物は tshirt_order_assets/{orderId} に分離保存し、配信APIルート経由のURLで参照する。
  svgNormalUrl?: string;
  svgMirrorUrl?: string;
  previewPngUrl?: string;

  trackingNumber?: string;
  shippingMethod?: string;

  payerEmail?: string;
  providerSessionId?: string;
  providerPaymentIntentId?: string;
  canceledReason?: string;
  refundedAt?: unknown;
  updatedAt?: unknown;

  // 配送先（決済時にStripe Checkoutで収集し、Webhookで保存する）
  shippingName?: string;
  shippingPhone?: string;
  shippingPostalCode?: string;
  shippingState?: string; // 都道府県
  shippingCity?: string;
  shippingLine1?: string;
  shippingLine2?: string;
  shippingCountry?: string;

  createdAt?: unknown;
  paidAt?: unknown;
  shippedAt?: unknown;
};

export type TShirtKitSettings = {
  enabled: boolean;
  basePrice: number;
  specialColorFee: number;
  shippingFee: number;
  freeShippingQuantity: number;
  maxQuantity: number;
  availableShirtColors: TShirtShirtColor[];
  availableShirtSizes: TShirtShirtSize[];
  availableSheetColors: TShirtSheetColor[];
  updatedAt?: unknown;
};

// 生成物の保存ドキュメント（1MB制限を避けるため order 本体から分離）
export type TShirtOrderAssets = {
  orderId: string;
  svgNormal: string; // SVGテキスト
  svgMirror: string; // 左右反転済みSVGテキスト（管理者が実際に使う）
  previewPng?: string; // data:image/png;base64,... （クライアント生成・小サイズ）
  generatedAt?: unknown;
};

export const SPECIAL_SHEET_COLORS: TShirtSheetColor[] = ["gold", "silver"];

export function isSpecialSheetColor(color: string): boolean {
  return SPECIAL_SHEET_COLORS.includes(color as TShirtSheetColor);
}
