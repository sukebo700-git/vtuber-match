import { viewerAuthKey } from "@/lib/viewerIdentity";

// TOPページの「視聴者の方/VTuberの方」導線分岐で使う、ブラウザに保存する選択状態。
// ログイン中の人はそもそも聞かずに判定できるので、明示選択が無ければ
// ログイン状態から推測する(推測もできなければ未定=nullでピッカーを出す)。
export const AUDIENCE_KEY = "vtuber-match-audience";
export const AUDIENCE_EVENT = "vtuber-match-audience-changed";

export type Audience = "viewer" | "creator";

export function readAudience(): Audience | null {
  const stored = localStorage.getItem(AUDIENCE_KEY);
  if (stored === "viewer" || stored === "creator") return stored;
  if (localStorage.getItem("vtuber-match-creator-email")) return "creator";
  if (localStorage.getItem(viewerAuthKey)) return "viewer";
  return null;
}

export function setAudience(value: Audience) {
  localStorage.setItem(AUDIENCE_KEY, value);
  window.dispatchEvent(new Event(AUDIENCE_EVENT));
}
