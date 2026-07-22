// フォント定義（仕様書3.2/3.3/3.4）。第1スライスは5カテゴリを網羅する
// 単一ウェイトの静的OFLフォント8種を登録する（可変フォントの太さ曖昧性を避けるため）。
// 残り(Oswald/Roboto Condensed/League Spartan/Fredoka/Baloo2/Playball/Oleo Script)は
// 次パスで追加する。すべて lib/tshirt/fontfiles/ に .ttf と .OFL.txt を同梱済み。
import type { FontConfig } from "./types";

export const FONTS: FontConfig[] = [
  {
    id: "anton",
    displayName: "Anton",
    internalFamily: "VMK Anton",
    category: "太字・インパクト",
    previewLabel: "極太で目立つ定番",
    allowedSizes: ["S", "M", "L"],
    maxCharacters: 15,
    weedingDifficulty: "easy",
    recommendedFor: ["インパクト重視", "短めの名前"],
    licenseFilePath: "lib/tshirt/fontfiles/Anton-Regular.OFL.txt",
    fontFilePath: "lib/tshirt/fontfiles/Anton-Regular.ttf",
    publicFontUrl: "/tshirt-fonts/Anton-Regular.ttf",
  },
  {
    id: "archivo-black",
    displayName: "Archivo Black",
    internalFamily: "VMK Archivo Black",
    category: "太字・インパクト",
    previewLabel: "重厚でモダンな太字",
    allowedSizes: ["S", "M", "L"],
    maxCharacters: 15,
    weedingDifficulty: "easy",
    recommendedFor: ["ロゴ感", "力強い印象"],
    licenseFilePath: "lib/tshirt/fontfiles/ArchivoBlack-Regular.OFL.txt",
    fontFilePath: "lib/tshirt/fontfiles/ArchivoBlack-Regular.ttf",
    publicFontUrl: "/tshirt-fonts/ArchivoBlack-Regular.ttf",
  },
  {
    id: "alfa-slab-one",
    displayName: "Alfa Slab One",
    internalFamily: "VMK Alfa Slab One",
    category: "太字・インパクト",
    previewLabel: "極太スラブセリフ",
    allowedSizes: ["S", "M", "L"],
    maxCharacters: 14,
    weedingDifficulty: "easy",
    recommendedFor: ["レトロ", "厚みのある存在感"],
    licenseFilePath: "lib/tshirt/fontfiles/AlfaSlabOne-Regular.OFL.txt",
    fontFilePath: "lib/tshirt/fontfiles/AlfaSlabOne-Regular.ttf",
    publicFontUrl: "/tshirt-fonts/AlfaSlabOne-Regular.ttf",
  },
  {
    id: "lilita-one",
    displayName: "Lilita One",
    internalFamily: "VMK Lilita One",
    category: "かわいい・ポップ",
    previewLabel: "丸みのあるポップ体",
    allowedSizes: ["S", "M", "L"],
    maxCharacters: 15,
    weedingDifficulty: "easy",
    recommendedFor: ["かわいい", "親しみやすい"],
    licenseFilePath: "lib/tshirt/fontfiles/LilitaOne-Regular.OFL.txt",
    fontFilePath: "lib/tshirt/fontfiles/LilitaOne-Regular.ttf",
    publicFontUrl: "/tshirt-fonts/LilitaOne-Regular.ttf",
  },
  {
    id: "graduate",
    displayName: "Graduate",
    internalFamily: "VMK Graduate",
    category: "定番・長い名前向け",
    previewLabel: "カレッジ風の定番",
    allowedSizes: ["S", "M", "L"],
    maxCharacters: 15,
    weedingDifficulty: "normal",
    recommendedFor: ["長めの名前", "スポーティ"],
    licenseFilePath: "lib/tshirt/fontfiles/Graduate-Regular.OFL.txt",
    fontFilePath: "lib/tshirt/fontfiles/Graduate-Regular.ttf",
    publicFontUrl: "/tshirt-fonts/Graduate-Regular.ttf",
  },
  {
    id: "righteous",
    displayName: "Righteous",
    internalFamily: "VMK Righteous",
    category: "個性的・ロゴ感",
    previewLabel: "レトロで角丸なロゴ体",
    allowedSizes: ["M", "L"],
    maxCharacters: 15,
    weedingDifficulty: "normal",
    recommendedFor: ["ロゴ感", "個性的"],
    licenseFilePath: "lib/tshirt/fontfiles/Righteous-Regular.OFL.txt",
    fontFilePath: "lib/tshirt/fontfiles/Righteous-Regular.ttf",
    publicFontUrl: "/tshirt-fonts/Righteous-Regular.ttf",
  },
  {
    id: "bungee",
    displayName: "Bungee",
    internalFamily: "VMK Bungee",
    category: "個性的・ロゴ感",
    previewLabel: "サイン看板風の縦横太字",
    allowedSizes: ["M", "L"],
    maxCharacters: 13,
    weedingDifficulty: "normal",
    recommendedFor: ["ストリート", "看板風"],
    licenseFilePath: "lib/tshirt/fontfiles/Bungee-Regular.OFL.txt",
    fontFilePath: "lib/tshirt/fontfiles/Bungee-Regular.ttf",
    publicFontUrl: "/tshirt-fonts/Bungee-Regular.ttf",
  },
  {
    id: "berkshire-swash",
    displayName: "Berkshire Swash",
    internalFamily: "VMK Berkshire Swash",
    category: "筆記体・上品",
    previewLabel: "上品な筆記体",
    allowedSizes: ["M", "L"],
    maxCharacters: 12,
    minStrokeWidthMm: 1.0,
    weedingDifficulty: "advanced",
    recommendedFor: ["上品", "エレガント"],
    licenseFilePath: "lib/tshirt/fontfiles/BerkshireSwash-Regular.OFL.txt",
    fontFilePath: "lib/tshirt/fontfiles/BerkshireSwash-Regular.ttf",
    publicFontUrl: "/tshirt-fonts/BerkshireSwash-Regular.ttf",
  },
];

const FONT_BY_ID = new Map(FONTS.map((f) => [f.id, f]));

export function getFontConfig(fontId: string): FontConfig | undefined {
  return FONT_BY_ID.get(fontId);
}

export function isValidFontId(fontId: string): boolean {
  return FONT_BY_ID.has(fontId);
}
