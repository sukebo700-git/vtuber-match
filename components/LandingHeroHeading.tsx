"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * TOPページの見出しを必ず2行(1行目lines[0]/2行目lines[1])で表示する。
 * clamp()ベースのvw依存フォントサイズだけでは、見出しが置かれる列の幅が
 * ブレークポイントごとに変わる(バッジと横並びになる等)ため、特定の画面幅で
 * 1行の文字がさらに折り返されて3行以上になってしまうことがあった。
 * 実際のレンダリング幅を計測し、はみ出す場合だけ両行を同じ比率で縮小して
 * 必ず1行ずつに収める(全く新しい縮小方式を導入するのではなく、
 * 既存のclamp()で決まったサイズを「上限」として、必要な時だけ縮める)。
 */
export function LandingHeroHeading({ lines }: { lines: [string, string] }) {
  const line1Ref = useRef<HTMLSpanElement>(null);
  const line2Ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el1 = line1Ref.current;
    const el2 = line2Ref.current;
    if (!el1 || !el2) return;

    function fit() {
      if (!el1 || !el2) return;
      el1.style.fontSize = "";
      el2.style.fontSize = "";
      el1.style.whiteSpace = "nowrap";
      el2.style.whiteSpace = "nowrap";
      const baseSize = parseFloat(getComputedStyle(el1).fontSize);
      const ratio1 = el1.scrollWidth > 0 ? el1.clientWidth / el1.scrollWidth : 1;
      const ratio2 = el2.scrollWidth > 0 ? el2.clientWidth / el2.scrollWidth : 1;
      const ratio = Math.min(1, ratio1, ratio2);
      if (ratio < 1 && Number.isFinite(baseSize)) {
        // 端数の再計測で再度はみ出さないよう、わずかに安全マージンを取る。
        const newSize = baseSize * ratio * 0.97;
        el1.style.fontSize = `${newSize}px`;
        el2.style.fontSize = `${newSize}px`;
      }
    }

    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [lines]);

  return (
    <h1>
      <span ref={line1Ref}>{lines[0]}</span>
      <span ref={line2Ref}>{lines[1]}</span>
    </h1>
  );
}
