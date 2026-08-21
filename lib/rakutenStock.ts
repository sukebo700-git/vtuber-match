// 楽天商品検索APIを「在庫の確認だけ」に使う。
//
// アフィリエイトリンクの生成には使わない(もしもアフィリエイト経由のリンクを
// そのまま利用する)。APIのaffiliateIdは楽天アフィリエイト直接のIDにしか対応せず、
// ASPを乗り換える必要が出てしまうため、あくまで参照専用にとどめる。
//
// 2026年2月の認証刷新後の仕様(実測で確認):
//   - エンドポイントは openapi.rakuten.co.jp/ichibams/... (旧 app.rakuten.co.jp は不可)
//   - applicationId(UUID)と accessKey(pk_...)の両方をクエリで渡す
//   - Origin ヘッダーが必須。楽天Developersに登録したドメインと一致しない場合は
//     403 HTTP_REFERRER_NOT_ALLOWED になる。サーバー側からの呼び出しでは
//     ブラウザのようにOriginが自動付与されないため、自分のドメインを明示して送る
const searchEndpoint = "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401";
const defaultOrigin = "https://www.vtubermatch.com";

export type StockCheckResult = {
  itemCode: string;
  inStock: boolean;
  /** APIを呼べなかった等で判定できなかった場合はtrue(売り切れ扱いにしない) */
  unknown: boolean;
};

export function hasRakutenApiCredentials() {
  return Boolean(process.env.RAKUTEN_APPLICATION_ID && process.env.RAKUTEN_ACCESS_KEY);
}

/**
 * もしものアフィリエイトURLから楽天のitemCode(shop:code形式)を取り出す。
 * もしものリンクは url= パラメータに元の商品URLをエンコードして持っている。
 */
export function extractRakutenItemCode(affiliateUrl: string): string {
  const candidates = [affiliateUrl, safeDecode(affiliateUrl)];

  // url= パラメータがあればそれも候補に加える(二重エンコードにも耐える)
  try {
    const parsed = new URL(affiliateUrl);
    const inner = parsed.searchParams.get("url");
    if (inner) {
      candidates.push(inner, safeDecode(inner));
    }
  } catch {
    // URLとして解釈できない場合は文字列マッチにフォールバックする
  }

  for (const candidate of candidates) {
    // https://item.rakuten.co.jp/{shopCode}/{itemCode}/
    const match = candidate.match(/item\.rakuten\.co\.jp\/([a-zA-Z0-9_-]+)\/([^/?#&"'\s]+)/);
    if (match) {
      const shop = match[1];
      const item = match[2].replace(/\/$/, "");
      if (shop && item) return `${shop}:${item}`;
    }
  }

  return "";
}

/**
 * itemCodeを指定して在庫を確認する。
 * availabilityは既定で1(在庫ありのみ)なので、ヒットしなければ売り切れと判断できる。
 */
export async function checkRakutenStock(itemCode: string): Promise<StockCheckResult> {
  const applicationId = process.env.RAKUTEN_APPLICATION_ID || "";
  const accessKey = process.env.RAKUTEN_ACCESS_KEY || "";
  if (!applicationId || !accessKey || !itemCode) {
    return { itemCode, inStock: true, unknown: true };
  }

  const params = new URLSearchParams({
    applicationId,
    accessKey,
    itemCode,
    availability: "1",
    hits: "1",
    format: "json",
  });

  try {
    const response = await fetch(`${searchEndpoint}?${params.toString()}`, {
      headers: {
        // 登録済みドメインからのリクエストであることを明示する。
        // サーバー間通信ではブラウザのように自動付与されないため必須。
        Origin: process.env.RAKUTEN_API_ORIGIN || defaultOrigin,
      },
      // 在庫は変動するのでキャッシュしない
      cache: "no-store",
    });

    // レート制限や一時障害で売り切れ扱いにしてしまわないよう、
    // 判定できなかったことを明示して呼び出し側に返す。
    if (!response.ok) {
      return { itemCode, inStock: true, unknown: true };
    }

    const data = await response.json();
    const count = Number(data?.count ?? 0);
    const items = Array.isArray(data?.Items) ? data.Items : [];
    return { itemCode, inStock: count > 0 || items.length > 0, unknown: false };
  } catch {
    return { itemCode, inStock: true, unknown: true };
  }
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
