import { viewerAuthKey } from "@/lib/viewerIdentity";

// TOPページの「視聴者の方/VTuberの方」導線分岐で使う選択状態。
// 選択は保存しない(TOPを開くたびにピッカーを出す方針)。
// ただしログイン中の人はそもそも聞かなくても分かるので、そのセッション中は
// ログイン状態から推測する。
export const AUDIENCE_EVENT = "vtuber-match-audience-changed";

export type Audience = "viewer" | "creator";

// このページ表示中だけ有効な選択(リロード・遷移で消える)。
let sessionChoice: Audience | null = null;

export function readAudience(): Audience | null {
  if (sessionChoice) return sessionChoice;
  if (localStorage.getItem("vtuber-match-creator-email")) return "creator";
  if (localStorage.getItem(viewerAuthKey)) return "viewer";
  return null;
}

export function setAudience(value: Audience) {
  sessionChoice = value;
  window.dispatchEvent(new Event(AUDIENCE_EVENT));
}
