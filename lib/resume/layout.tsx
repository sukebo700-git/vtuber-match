import { splitTextWithEmoji } from "./emoji";
import type { ResumeHistoryEntry, StreamerResumeFields } from "./schema";

/**
 * 履歴書生成の対象となる streamer の最小インターフェース。
 * 呼び出し側(APIルート)が streamers/{id} の実データからこの形にマッピングする。
 */
export interface ResumeSourceStreamer extends StreamerResumeFields {
  name: string;
  yomigana?: string;
  genres?: string[];
  timeSlot?: string;
  appeal?: string; // 「推してほしいポイント」欄に流用(実データでは description)
  iconDataUri?: string; // 例: "data:image/png;base64,...."(実データでは thumbnails[0])
  xAccount?: string;
  youtubeUrl?: string;
}

// 公式テンプレート(ユーザー提供の記入用フォーム画像)に合わせた配色。
// 罫線はすべて黒系の細線のみで、色帯によるヘッダー区別は使わない(印刷用紙のような見た目)。
const COLOR = {
  ink: "#1a1a1a",
  line: "#000000",
  faint: "#666666",
  bg: "#ffffff",
} as const;

const CANVAS = { width: 1600, height: 1260 };
const ICON = { width: 190, height: 240 };

function FieldRow({
  label,
  value,
  labelWidth = 110,
  height = 40,
}: {
  label: string;
  value: string | JSX.Element | (string | JSX.Element)[];
  labelWidth?: number;
  height?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        height,
        borderBottom: `1px solid ${COLOR.line}`,
      }}
    >
      <div
        style={{
          width: labelWidth,
          fontSize: 15,
          fontWeight: 700,
          color: COLOR.ink,
          paddingLeft: 10,
          borderRight: `1px solid ${COLOR.line}`,
          height: "100%",
          display: "flex",
          alignItems: "center",
        }}
      >
        {label}
      </div>
      <div
        style={{
          flex: 1,
          fontSize: 16,
          color: COLOR.ink,
          paddingLeft: 12,
          display: "flex",
          alignItems: "center",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function HistoryTable({
  title,
  rows,
  rowCount = 4,
}: {
  title: string;
  rows: ResumeHistoryEntry[];
  rowCount?: number;
}) {
  const colWidths = [55, 45];

  return (
    <div style={{ display: "flex", flexDirection: "column", border: `1px solid ${COLOR.line}` }}>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          height: 34,
          borderBottom: `1px solid ${COLOR.line}`,
        }}
      >
        <div
          style={{
            width: colWidths[0],
            fontSize: 13,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRight: `1px solid ${COLOR.line}`,
          }}
        >
          年
        </div>
        <div
          style={{
            width: colWidths[1],
            fontSize: 13,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRight: `1px solid ${COLOR.line}`,
          }}
        >
          月
        </div>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", paddingLeft: 10 }}>
          {title}
        </div>
      </div>

      {Array.from({ length: rowCount }).map((_, i) => {
        const r = rows[i];
        return (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "row",
              height: 30,
              borderBottom: i === rowCount - 1 ? "none" : `1px solid ${COLOR.line}`,
            }}
          >
            <div
              style={{
                width: colWidths[0],
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRight: `1px solid ${COLOR.line}`,
                color: COLOR.ink,
              }}
            >
              {r?.year ?? ""}
            </div>
            <div
              style={{
                width: colWidths[1],
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRight: `1px solid ${COLOR.line}`,
                color: COLOR.ink,
              }}
            >
              {r?.month ?? ""}
            </div>
            <div
              style={{
                flex: 1,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                paddingLeft: 10,
                color: COLOR.ink,
              }}
            >
              {r ? splitTextWithEmoji(r.text) : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FreeTextBox({
  label,
  text,
  height,
}: {
  label: string;
  text: string | undefined;
  height: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", border: `1px solid ${COLOR.line}`, height }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          padding: "6px 10px",
          borderBottom: `1px solid ${COLOR.line}`,
          display: "flex",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, padding: "10px 12px", color: COLOR.ink, lineHeight: 1.6, display: "flex" }}>
        {splitTextWithEmoji(text)}
      </div>
    </div>
  );
}

/**
 * 履歴書専用アイコン。ズーム/パンは resumeIconZoom / resumeIconPanX / resumeIconPanY で制御する。
 *
 * 重要: `transform: scale()` + `overflow: hidden` の組み合わせは、satori(SVG生成)→resvgの
 * 実際のレンダリング経路でクリップが効かず画像が枠外にはみ出すことを検証済み(2026-08-07)。
 * そのため transform は使わず、img自体の width/height をズーム後のサイズにし、position: absolute
 * の left/top(px指定)でパン量を表現する方式にしている。objectFit: cover は元画像のアスペクト比を
 * ズーム後の箱に合わせて埋めるためだけに使う(パンの表現はleft/topが担う)。変更しないこと。
 */
function IconBox({ streamer }: { streamer: ResumeSourceStreamer }) {
  const zoom = streamer.resumeIconZoom ?? 1.0;
  const panX = streamer.resumeIconPanX ?? 50;
  const panY = streamer.resumeIconPanY ?? 50;
  const zoomedWidth = ICON.width * zoom;
  const zoomedHeight = ICON.height * zoom;
  const offsetX = -(zoomedWidth - ICON.width) * (panX / 100);
  const offsetY = -(zoomedHeight - ICON.height) * (panY / 100);

  return (
    <div
      style={{
        width: ICON.width,
        height: ICON.height,
        border: `1px solid ${COLOR.line}`,
        overflow: "hidden",
        display: "flex",
        position: "relative",
        flexShrink: 0,
      }}
    >
      {streamer.iconDataUri ? (
        <img
          src={streamer.iconDataUri}
          width={zoomedWidth}
          height={zoomedHeight}
          style={{
            display: "flex",
            position: "absolute",
            left: offsetX,
            top: offsetY,
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            color: COLOR.faint,
            textAlign: "center",
            padding: 10,
          }}
        >
          立ち絵／アイコン
        </div>
      )}
    </div>
  );
}

/** フッター: VtuberMatchのロゴ・URLと素材利用条件(画像の再配布・悪用防止のため常に表示)。 */
function Footer() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderTop: `1px solid ${COLOR.line}`,
        paddingTop: 14,
        marginTop: 16,
      }}
    >
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            display: "flex",
            background: "linear-gradient(135deg, #f23878, #2f7de1)",
          }}
        />
        <div style={{ fontSize: 20, fontWeight: 900, color: "#f23878", display: "flex" }}>VtuberMatch</div>
        <div style={{ fontSize: 15, color: COLOR.faint, display: "flex" }}>https://www.vtubermatch.com/</div>
      </div>
      <div style={{ fontSize: 12, color: COLOR.faint, display: "flex" }}>
        ・VTuber活動の紹介・投稿用途でご利用ください　・素材の再配布・再販売は禁止　・公序良俗に反する利用は禁止です
      </div>
    </div>
  );
}

/** 履歴書全体のJSXツリーを組み立てる。ImageResponse の第一引数にそのまま渡す。 */
export function ResumeDocument({ streamer }: { streamer: ResumeSourceStreamer }) {
  const today = new Date();
  const dateLabel = `${today.getFullYear()}年${today.getMonth() + 1}月現在`;

  const birthdayValue = streamer.birthdayVisible ? streamer.birthday || "" : "非公開";

  return (
    <div
      style={{
        width: CANVAS.width,
        height: CANVAS.height,
        display: "flex",
        flexDirection: "column",
        backgroundColor: COLOR.bg,
        fontFamily: "Noto Sans CJK JP",
        padding: 28,
      }}
    >
      {/* header */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 700, display: "flex", color: COLOR.ink }}>
          VTuber専用履歴書
        </div>
        <div style={{ fontSize: 15, color: COLOR.faint, display: "flex" }}>{dateLabel}</div>
      </div>

      {/* main 2-column area */}
      <div style={{ display: "flex", flexDirection: "row", gap: 20 }}>
        {/* LEFT column */}
        <div style={{ display: "flex", flexDirection: "column", width: 720, gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "row", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, border: `1px solid ${COLOR.line}` }}>
              <FieldRow label="ふりがな" value={streamer.yomigana ?? ""} labelWidth={90} height={34} />
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  flex: 1,
                  borderTop: `1px solid ${COLOR.line}`,
                }}
              >
                <div
                  style={{
                    width: 90,
                    fontSize: 15,
                    fontWeight: 700,
                    color: COLOR.ink,
                    paddingLeft: 10,
                    borderRight: `1px solid ${COLOR.line}`,
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  活動名
                </div>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: 12,
                    fontSize: 24,
                    fontWeight: 700,
                    color: COLOR.ink,
                  }}
                >
                  {streamer.name}
                </div>
              </div>
            </div>
            <IconBox streamer={streamer} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", border: `1px solid ${COLOR.line}` }}>
            <FieldRow label="デビュー日" value={streamer.debutDate ?? ""} />
            <FieldRow label="誕生日" value={birthdayValue} />
            <FieldRow label="活動地域" value={streamer.activityRegion ?? ""} />
            <FieldRow label="連絡先" value={streamer.publicContact ?? ""} />
            <FieldRow label="Xアカウント" value={streamer.xAccount ?? ""} />
            <FieldRow label="配信サイト" value={streamer.youtubeUrl ?? ""} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", border: `1px solid ${COLOR.line}` }}>
            <FieldRow label="配信ジャンル" value={(streamer.genres ?? []).join(" / ")} />
            <FieldRow label="活動時間" value={streamer.timeSlot ?? ""} />
            <FieldRow label="配信場所" value={streamer.streamingPlatform ?? ""} />
            <FieldRow label="性格タイプ" value={streamer.personalityType ?? ""} />
            <FieldRow label="ファンネーム" value={streamer.fanName ?? ""} />
            <FieldRow label="ファンマーク" value={splitTextWithEmoji(streamer.fanMark)} />
            <FieldRow label="ハッシュタグ" value={(streamer.hashtags ?? []).join(" ")} />
          </div>
        </div>

        {/* RIGHT column */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 14 }}>
          <HistoryTable title="主な実績・コラボ歴" rows={streamer.achievements ?? []} rowCount={7} />
          <HistoryTable title="使用機材・配信環境" rows={streamer.equipment ?? []} rowCount={3} />
          <FreeTextBox label="推してほしいポイント / 好きなこと / 得意なこと" text={streamer.appeal} height={118} />
          <FreeTextBox
            label="初見さんへのひとこと / 今後の目標 / 希望する活動"
            text={streamer.messageToNewcomers}
            height={118}
          />
        </div>
      </div>

      {/* bottom full-width: 活動歴・配信歴 */}
      <div style={{ display: "flex", flexDirection: "column", width: "100%", marginTop: 14 }}>
        <HistoryTable title="活動歴・配信歴(各自まとめて書く)" rows={streamer.activityHistory ?? []} rowCount={7} />
      </div>

      <div style={{ display: "flex", flex: 1 }} />

      <Footer />
    </div>
  );
}

export const RESUME_CANVAS_SIZE = CANVAS;
