// 料金計算（仕様書7章）。純粋関数として分離し単体テスト可能にする。
import type { TShirtKitSettings } from "./types";
import { isSpecialSheetColor } from "./types";
import { getTShirtSettings } from "./config";

export type PriceInput = {
  quantity: number;
  sheetColor: string;
};

export type PriceBreakdown = {
  unitPrice: number; // 基本単価（通常カラー1着）
  subtotal: number; // basePrice * quantity
  specialColorFeePerUnit: number; // ゴールド/シルバーは +300、それ以外0
  specialColorFee: number; // specialColorFeePerUnit * quantity
  shippingFee: number; // 5着以上で0
  total: number;
  freeShipping: boolean;
};

// settings 未指定時は環境変数/デフォルトから取得する。
export function calcTShirtTotal(
  input: PriceInput,
  settings: TShirtKitSettings = getTShirtSettings(),
): PriceBreakdown {
  const quantity = Math.max(0, Math.floor(Number(input.quantity) || 0));
  const special = isSpecialSheetColor(input.sheetColor);

  const unitPrice = settings.basePrice;
  const subtotal = unitPrice * quantity;
  const specialColorFeePerUnit = special ? settings.specialColorFee : 0;
  const specialColorFee = specialColorFeePerUnit * quantity;
  const freeShipping = quantity >= settings.freeShippingQuantity;
  const shippingFee = freeShipping ? 0 : settings.shippingFee;
  const total = subtotal + specialColorFee + shippingFee;

  return {
    unitPrice,
    subtotal,
    specialColorFeePerUnit,
    specialColorFee,
    shippingFee,
    total,
    freeShipping,
  };
}
