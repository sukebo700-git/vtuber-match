"use client";

import { useEffect, useState } from "react";
import { AUDIENCE_EVENT, readAudience, type Audience } from "@/lib/audience";

type AudienceVisibilityProps = {
  audience: Audience;
  children: React.ReactNode;
};

// AuthVisibility(ログイン状態での出し分け)と同じ考え方で、
// TOPページのセクションを「視聴者向け/VTuber向け」で出し分ける。
//
// 2026-09-24: readAudience() は初回訪問者(セッション選択なし・未ログイン)に対して
// null を返す。以前はその null が "viewer" とも "creator" とも一致せず、
// 新規訪問者には視聴者登録バナーもGoogle One Tapも配信者向けバナーも
// 一切表示されていなかった(ピッカーを押すまで登録導線に触れられなかった)。
// 直近7日の視聴者登録導線クリックが0件だった主因。
// 未選択のうちは両方を出し、選択後にその人向けへ絞り込む方式に変更する。
export function AudienceVisibility({ audience, children }: AudienceVisibilityProps) {
  const [current, setCurrent] = useState<Audience | null>(null);
  // マウント前(SSR/初期描画)は出し分けを確定できない。ここで描画してしまうと
  // 選択済みの人に一瞬だけ反対側が見えるため、判定が終わるまでは何も出さない。
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    function refresh() {
      setCurrent(readAudience());
      setResolved(true);
    }
    refresh();
    window.addEventListener(AUDIENCE_EVENT, refresh);
    return () => {
      window.removeEventListener(AUDIENCE_EVENT, refresh);
    };
  }, []);

  if (!resolved) return null;
  if (current === null) return <>{children}</>;
  if (current !== audience) return null;
  return <>{children}</>;
}
