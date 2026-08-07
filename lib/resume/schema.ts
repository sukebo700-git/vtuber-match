/**
 * VTuber専用履歴書機能: streamers/{id} に追加するフィールドの型定義。
 * 既存フィールドの削除・変更は一切行わない(すべて任意・後方互換)。
 */

/** 年月ペア + 自由記述1件(活動歴・実績・機材で共通利用) */
export interface ResumeHistoryEntry {
  year: string; // 例: "2025"
  month: string; // 例: "6"(1〜12の文字列。空文字を許容する)
  text: string; // 内容
}

/** streamers/{id} に追加するフィールド群(すべて任意・後方互換) */
export interface StreamerResumeFields {
  // --- 基本情報 ---
  debutDate?: string; // デビュー日(自由入力。例: "2024年3月1日")
  birthday?: string; // 誕生日(自由入力)
  birthdayVisible?: boolean; // 既定 false。true のときのみ birthday を履歴書に表示する
  activityRegion?: string; // 活動地域
  publicContact?: string; // 公開用連絡先(アカウントの email とは別。空欄可)

  // --- 配信情報 ---
  streamingPlatform?: string; // 配信場所(例: "自宅スタジオ")
  personalityType?: string; // 性格タイプ
  fanName?: string; // ファンネーム
  fanMark?: string; // ファンマーク(絵文字 or 短いテキスト、最大4文字を目安にフォーム側でバリデーション)
  hashtags?: string[]; // ハッシュタグ(最大 RESUME_LIMITS.hashtagsMax 件)

  // --- 年表形式の項目(すべて同じ ResumeHistoryEntry[] 形式) ---
  activityHistory?: ResumeHistoryEntry[]; // 活動歴・配信歴(最大 RESUME_LIMITS.historyRowsMax 件)
  achievements?: ResumeHistoryEntry[]; // 主な実績・コラボ歴(同上)
  equipment?: ResumeHistoryEntry[]; // 使用機材・配信環境(同上)

  // --- 自由記述 ---
  // 「推してほしいポイント/好きなこと/得意なこと」は既存の description フィールドをそのまま流用する(新規フィールドは作らない)
  messageToNewcomers?: string; // 初見さんへのひとこと/今後の目標/希望する活動

  // --- 機能全体のオプトイン ---
  resumePublicOptIn?: boolean; // 既定 true。false の場合、生成APIは 403 を返す

  // --- 履歴書専用のアイコン表示調整(アプリ全体のアイコン表示には影響しない) ---
  resumeIconZoom?: number; // 既定 1.0。範囲 [1.0, 3.0]
  resumeIconPanX?: number; // 既定 50。範囲 [0, 100](%)
  resumeIconPanY?: number; // 既定 50。範囲 [0, 100](%)
}

/** フォーム・API両方のバリデーションで共有する上限値 */
export const RESUME_LIMITS = {
  hashtagsMax: 5,
  historyRowsMax: 10,
  historyTextMax: 80,
  messageToNewcomersMax: 200,
  fanMarkMax: 4,
  iconZoomMin: 1.0,
  iconZoomMax: 3.0,
  iconPanMin: 0,
  iconPanMax: 100,
} as const;

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** 保存前にクライアント・サーバー両方から呼べる正規化関数(二重防御) */
export function normalizeResumeFields(
  input: Partial<StreamerResumeFields>
): Partial<StreamerResumeFields> {
  return {
    ...input,
    hashtags: (input.hashtags ?? [])
      .slice(0, RESUME_LIMITS.hashtagsMax)
      .map((h) => (h.startsWith("#") ? h : `#${h}`)),
    activityHistory: (input.activityHistory ?? []).slice(0, RESUME_LIMITS.historyRowsMax),
    achievements: (input.achievements ?? []).slice(0, RESUME_LIMITS.historyRowsMax),
    equipment: (input.equipment ?? []).slice(0, RESUME_LIMITS.historyRowsMax),
    fanMark: (input.fanMark ?? "").slice(0, RESUME_LIMITS.fanMarkMax),
    messageToNewcomers: (input.messageToNewcomers ?? "").slice(
      0,
      RESUME_LIMITS.messageToNewcomersMax
    ),
    resumeIconZoom: clamp(
      input.resumeIconZoom ?? 1.0,
      RESUME_LIMITS.iconZoomMin,
      RESUME_LIMITS.iconZoomMax
    ),
    resumeIconPanX: clamp(
      input.resumeIconPanX ?? 50,
      RESUME_LIMITS.iconPanMin,
      RESUME_LIMITS.iconPanMax
    ),
    resumeIconPanY: clamp(
      input.resumeIconPanY ?? 50,
      RESUME_LIMITS.iconPanMin,
      RESUME_LIMITS.iconPanMax
    ),
  };
}
