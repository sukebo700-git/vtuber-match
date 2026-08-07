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
}

const COLOR = {
  ink: "#1a1a1a",
  line: "#333333",
  faint: "#888888",
  bg: "#ffffff",
  accent: "#e8e2d8",
} as const;

const CANVAS = { width: 1600, height: 1131 };
const ICON = { width: 130, height: 160 };

function FieldRow({
  label,
  value,
  labelWidth = 110,
  height = 40,
}: {
  label: string;
  value: string | (string | JSX.Element)[];
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
          color: COLOR.ink,
          paddingLeft: 10,
          borderRight: `1px solid ${COLOR.line}`,
          height: "100%",
          display: "flex",
          alignItems: "center",
          backgroundColor: COLOR.accent,
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
  const displayRowCount = Math.max(rowCount, rows.length === 0 ? 1 : 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", border: `1px solid ${COLOR.line}` }}>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          height: 34,
          backgroundColor: COLOR.accent,
          borderBottom: `1px solid ${COLOR.line}`,
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
          }}
        >
          年
        </div>
        <div
          style={{
            width: colWidths[1],
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRight: `1px solid ${COLOR.line}`,
          }}
        >
          月
        </div>
        <div style={{ flex: 1, fontSize: 13, display: "flex", alignItems: "center", paddingLeft: 10 }}>
          {title}
        </div>
      </div>

      {Array.from({ length: Math.max(displayRowCount, rowCount) }).map((_, i) => {
        const r = rows[i];
        return (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "row",
              height: 30,
              borderBottom: i === rowCount - 1 ? "none" : "1px solid #cccccc",
            }}
          >
            <div
              style={{
                width: colWidths[0],
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRight: "1px solid #cccccc",
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
                borderRight: "1px solid #cccccc",
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
          padding: "6px 10px",
          borderBottom: `1px solid ${COLOR.line}`,
          backgroundColor: COLOR.accent,
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
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            color: COLOR.faint,
          }}
        >
          NO IMAGE
        </div>
      )}
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
      <div style={{ display: "flex", flexDirection: "row", flex: 1, gap: 20 }}>
        {/* LEFT column */}
        <div style={{ display: "flex", flexDirection: "column", width: 720, gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "row", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, border: `1px solid ${COLOR.line}` }}>
              <FieldRow label="ふりがな" value={streamer.yomigana ?? ""} labelWidth={90} height={32} />
              <FieldRow label="活動名" value={streamer.name} labelWidth={90} height={46} />
            </div>
            <IconBox streamer={streamer} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", border: `1px solid ${COLOR.line}` }}>
            <FieldRow label="デビュー日" value={streamer.debutDate ?? ""} />
            <FieldRow label="誕生日" value={birthdayValue} />
            <FieldRow label="活動地域" value={streamer.activityRegion ?? ""} />
            <FieldRow label="連絡先" value={streamer.publicContact ?? ""} />
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
          <HistoryTable title="主な実績・コラボ歴" rows={streamer.achievements ?? []} rowCount={4} />
          <HistoryTable title="活動歴・配信歴" rows={streamer.activityHistory ?? []} rowCount={4} />
          <HistoryTable title="使用機材・配信環境" rows={streamer.equipment ?? []} rowCount={3} />
          <FreeTextBox label="推してほしいポイント / 好きなこと / 得意なこと" text={streamer.appeal} height={118} />
          <FreeTextBox
            label="初見さんへのひとこと / 今後の目標 / 希望する活動"
            text={streamer.messageToNewcomers}
            height={118}
          />
        </div>
      </div>
    </div>
  );
}

export const RESUME_CANVAS_SIZE = CANVAS;
