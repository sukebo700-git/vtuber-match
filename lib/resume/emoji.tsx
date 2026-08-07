/**
 * satori(next/og の ImageResponse が内部で使用)はフォントに無い絵文字グリフを
 * tofu(空の四角)化するため、絵文字だけ検出してTwemoji SVGの<img>要素に置き換える。
 * satori公式サンプルで採用されている定石パターン。
 *
 * 注意: Twemoji CDN(jsdelivr)への外部アクセスが生成時に発生する。
 * CDN到達不可の場合はプレーンテキストにフォールバックし、
 * 履歴書全体の生成を失敗させないこと(呼び出し側で担保する設計にしている
 * = このモジュール自体はネットワークアクセスを行わず、URLを組み立てるだけ)。
 */

const EMOJI_REGEX = /(\p{Extended_Pictographic}(\u200D\p{Extended_Pictographic})*)/gu;

function toCodePoints(segment: string): string {
  return Array.from(segment)
    .map((c) => c.codePointAt(0)!.toString(16))
    .join("-");
}

/**
 * 文字列を「テキスト断片」と「絵文字(<img>要素)」の配列に分解する。
 * satori/next-og の JSX に children としてそのまま渡せる。
 */
export function splitTextWithEmoji(text: string | undefined | null): (string | JSX.Element)[] {
  if (!text) return [""];

  const parts = text.split(EMOJI_REGEX).filter((p) => p !== undefined && p !== "");

  return parts.map((part, i) => {
    const isEmoji = /^\p{Extended_Pictographic}(\u200D\p{Extended_Pictographic})*$/u.test(part);
    if (isEmoji) {
      const codepoints = toCodePoints(part);
      return (
        <img
          key={`emoji-${i}-${codepoints}`}
          src={`https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/${codepoints}.svg`}
          width={20}
          height={20}
          style={{ display: "flex", verticalAlign: "middle" }}
        />
      );
    }
    return part;
  });
}
