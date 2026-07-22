import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { AdminTShirtOrderActions } from "@/components/AdminTShirtOrderActions";
import { adminCookieName, verifyAdminSession } from "@/lib/adminSession";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tシャツ注文管理",
  robots: { index: false, follow: false },
};

type OrderRow = {
  id: string;
  orderNumber: string;
  createdAt: string;
  inputText: string;
  fontDisplayName: string;
  designSize: string;
  shirtColor: string;
  shirtSize: string;
  sheetColor: string;
  quantity: number;
  totalAmount: number;
  paymentStatus: string;
  productionStatus: string;
  shipTo: string;
  trackingNumber: string;
};

function toIso(value: unknown): string {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof value === "string" ? value : "";
}

export default async function AdminTShirtOrdersPage() {
  if (!verifyAdminSession(cookies().get(adminCookieName)?.value)) notFound();

  const db = getAdminDb();
  let orders: OrderRow[] = [];
  if (db) {
    const snapshot = await db.collection("orders").where("order_type", "==", "tshirt_kit").get();
    orders = snapshot.docs
      .map((doc) => {
        const d = doc.data() || {};
        return {
          id: doc.id,
          orderNumber: String(d.orderNumber || ""),
          createdAt: toIso(d.createdAt),
          inputText: String(d.inputText || ""),
          fontDisplayName: String(d.fontDisplayName || ""),
          designSize: String(d.designSize || ""),
          shirtColor: String(d.shirtColor || ""),
          shirtSize: String(d.shirtSize || ""),
          sheetColor: String(d.sheetColor || ""),
          quantity: Number(d.quantity || 0),
          totalAmount: Number(d.totalAmount || 0),
          paymentStatus: String(d.paymentStatus || ""),
          productionStatus: String(d.productionStatus || ""),
          trackingNumber: String(d.trackingNumber || ""),
          shipTo: [
            String(d.shippingName || ""),
            d.shippingPostalCode ? `〒${d.shippingPostalCode}` : "",
            [d.shippingState, d.shippingCity, d.shippingLine1, d.shippingLine2].filter(Boolean).join(""),
            d.shippingPhone ? `☎${d.shippingPhone}` : "",
          ].filter(Boolean).join(" / "),
        };
      })
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/admin">管理トップ</a>
        </nav>
        <HeaderAuthStatus />
      </header>
      <main className="main admin-main grid-page">
        <section className="status-band">
          <h2>Tシャツ注文管理</h2>
          <p>注文数: {orders.length.toLocaleString("ja-JP")} 件。ミラーSVGを開いてSilhouette Studioへ読み込みます。</p>
        </section>

        {orders.length === 0 ? (
          <section className="status-band"><p>注文はまだありません。</p></section>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
              <thead>
                <tr>
                  {["注文番号", "日時", "文字", "フォント", "サイズ", "Tシャツ", "シート", "数量", "金額", "配送先", "支払", "製造", "SVG", "操作"].map((h) => (
                    <th key={h} style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: "8px 10px", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td style={cell}>{o.orderNumber}</td>
                    <td style={cell}>{o.createdAt ? o.createdAt.slice(0, 16).replace("T", " ") : "—"}</td>
                    <td style={cell}>{o.inputText}</td>
                    <td style={cell}>{o.fontDisplayName}</td>
                    <td style={cell}>{o.designSize}</td>
                    <td style={cell}>{o.shirtColor}/{o.shirtSize}</td>
                    <td style={cell}>{o.sheetColor}</td>
                    <td style={cell}>{o.quantity}</td>
                    <td style={cell}>¥{o.totalAmount.toLocaleString("ja-JP")}</td>
                    <td style={{ ...cell, whiteSpace: "normal", minWidth: 220, maxWidth: 320 }}>{o.shipTo || "—"}</td>
                    <td style={cell}>{o.paymentStatus}</td>
                    <td style={cell}>{o.productionStatus}</td>
                    <td style={cell}>
                      {["svg_generated", "cutting", "cut_complete", "packed", "shipped"].includes(o.productionStatus) ? (
                        <span style={{ display: "flex", gap: 8 }}>
                          <a href={`/api/admin/tshirt-orders/${o.id}/svg?variant=mirror`} target="_blank" rel="noreferrer">ミラー</a>
                          <a href={`/api/admin/tshirt-orders/${o.id}/svg?variant=normal`} target="_blank" rel="noreferrer">通常</a>
                        </span>
                      ) : (
                        <span style={{ color: "#999" }}>—</span>
                      )}
                    </td>
                    <td style={cell}>
                      <AdminTShirtOrderActions
                        orderId={o.id}
                        productionStatus={o.productionStatus}
                        paymentStatus={o.paymentStatus}
                        trackingNumber={o.trackingNumber}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

const cell: React.CSSProperties = {
  borderBottom: "1px solid #eee",
  padding: "8px 10px",
  whiteSpace: "nowrap",
};
