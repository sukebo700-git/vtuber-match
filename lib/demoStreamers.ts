import type { Streamer } from "@/lib/types";

const baseDate = "2026-05-06T00:00:00.000Z";

const portraits = [
  portrait("星乃ミルナ", "#ff6fae", "#ffd8e9", "#6a4bff", "twintail"),
  portrait("蒼井ネオン", "#4aa3ff", "#dcecff", "#1b4fd8", "cat"),
  portrait("夢見リオン", "#9b7cff", "#efe8ff", "#34345c", "moon"),
  portrait("奏そら", "#54c7a9", "#e1fff7", "#1e6d5c", "music"),
  portrait("百瀬いろは", "#ff9a62", "#fff0df", "#a14b20", "flower"),
  portrait("黒羽ナギ", "#33394f", "#e6e8ff", "#111827", "wing"),
  portrait("春風ラテ", "#d8a55a", "#fff7e8", "#7a4e16", "latte"),
  portrait("白瀬ユキ", "#79c7ff", "#eef9ff", "#315e86", "snow"),
  portrait("暁メメ", "#ff5a7a", "#ffe4ec", "#7d1f3a", "spark"),
  portrait("七海シエル", "#2fd0c4", "#e2fffb", "#176b72", "sea")
];

export const demoStreamers: Streamer[] = [
  makeDemo("demo-hoshino-miluna", "星乃ミルナ", "demo-miluna", portraits[0], ["歌枠", "癒し系", "雑談"], ["初見さん歓迎", "夜更かし向け", "まったり", "歌うま"], "眠る前に少しだけ歌を届ける、星明かり系Vtuber。", "眠る前に、少しだけ歌を届けます。", "22時-24時", "paid", 0),
  makeDemo("demo-aoi-neon", "蒼井ネオン", "demo-neon", portraits[1], ["ゲーム", "参加型", "雑談"], ["元気", "初見さん歓迎", "参加型", "FPS"], "一緒に遊べるゲーム配信を中心に、毎週参加型を開催。", "一緒に遊べるゲーム配信、毎週開催中。", "20時-23時", "free", 1),
  makeDemo("demo-yumemi-rion", "夢見リオン", "demo-rion", portraits[2], ["ASMR", "癒し系", "深夜配信"], ["落ち着く声", "寝落ち向け", "深夜枠", "癒し"], "静かな夜に寄り添う、睡眠導入とASMRの配信者。", "今日の疲れを、やさしくほどきます。", "23時-25時", "boost", 2),
  makeDemo("demo-kanade-sora", "奏そら", "demo-sora", portraits[3], ["歌枠", "弾き語り", "作業用"], ["弾き語り", "作業BGM", "聞き専歓迎", "初見さん歓迎"], "ギターと声でゆっくり届ける、弾き語り中心のチャンネル。", "弾き語りと作業BGMで、夜を少し明るく。", "21時-23時", "paid", 3),
  makeDemo("demo-momose-iroha", "百瀬いろは", "demo-iroha", portraits[4], ["雑談", "初見歓迎", "朝活"], ["朝枠", "コメント拾い多め", "元気", "新人"], "朝から元気を分ける、コメント多めの雑談配信。", "朝の10分、元気をチャージしませんか。", "7時-8時", "free", 4),
  makeDemo("demo-kuroha-nagi", "黒羽ナギ", "demo-nagi", portraits[5], ["ゲーム", "ホラー", "深夜配信"], ["ホラー好き", "リアクション大きめ", "深夜枠", "ゲーム実況"], "ホラーゲームと深夜テンションが得意なリアクション系Vtuber。", "怖いのに見たくなる、深夜のホラー枠。", "22時-26時", "paid", 5),
  makeDemo("demo-haruka-latte", "春風ラテ", "demo-latte", portraits[6], ["雑談", "作業用", "癒し系"], ["まったり", "作業BGM", "癒し", "コメント拾い多め"], "カフェのような空気で、作業と雑談に寄り添う配信。", "作業のおともに、ゆるいカフェ時間を。", "14時-17時", "free", 6),
  makeDemo("demo-shirase-yuki", "白瀬ユキ", "demo-yuki", portraits[7], ["勉強", "作業用", "雑談"], ["作業集中", "聞き専歓迎", "静か", "初見さん歓迎"], "一緒に集中する勉強・作業配信が中心。", "ひとりじゃ続かない作業を、一緒に。", "19時-22時", "paid", 7),
  makeDemo("demo-akatsuki-meme", "暁メメ", "demo-meme", portraits[8], ["企画配信", "雑談", "ショート動画あり"], ["企画多め", "切り抜き歓迎", "テンポ重視", "短時間"], "短時間でも楽しめる企画と雑談が多めのチャンネル。", "短時間で笑える、テンポ重視の企画枠。", "18時-21時", "boost", 8),
  makeDemo("demo-nanami-ciel", "七海シエル", "demo-ciel", portraits[9], ["歌枠", "海外勢", "雑談"], ["日本語", "英語少しOK", "歌枠", "初見さん歓迎"], "日本語中心、少し英語も交えながら歌と雑談を届けます。", "海風みたいな歌声で、初見さんも歓迎。", "20時-24時", "free", 9)
];

function makeDemo(
  id: string,
  name: string,
  handle: string,
  image: string,
  categories: string[],
  tags: string[],
  description: string,
  oneLiner: string,
  streamTime: string,
  planType: Streamer["plan_type"],
  index: number
): Streamer {
  return {
    id,
    name,
    youtube_url: `https://www.youtube.com/@${handle}`,
    thumbnails: [image],
    categories,
    tags,
    description,
    one_liner: oneLiner,
    stream_time: streamTime,
    plan_type: planType,
    is_visible: true,
    impressions: 0,
    likes: 0,
    created_at: new Date(new Date(baseDate).getTime() - index * 60000).toISOString()
  };
}

function portrait(name: string, main: string, bg: string, dark: string, motif: string) {
  const initials = name.slice(0, 2);
  const motifPath = motifShape(motif, dark);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${bg}"/>
          <stop offset="1" stop-color="${main}"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="28%" r="55%">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".95"/>
          <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="900" height="1200" rx="72" fill="url(#bg)"/>
      <circle cx="450" cy="330" r="290" fill="url(#glow)"/>
      <path d="M210 1000 C260 840 280 700 450 700 C620 700 640 840 690 1000 Z" fill="${dark}" opacity=".92"/>
      <circle cx="450" cy="470" r="210" fill="#ffe8df"/>
      <path d="M250 440 C280 230 620 230 650 440 C560 340 340 340 250 440 Z" fill="${main}"/>
      <path d="M230 570 C210 330 310 190 450 190 C590 190 690 330 670 570 C610 500 560 410 450 410 C340 410 290 500 230 570 Z" fill="${main}" opacity=".96"/>
      <circle cx="370" cy="500" r="24" fill="${dark}"/>
      <circle cx="530" cy="500" r="24" fill="${dark}"/>
      <path d="M380 610 C420 650 480 650 520 610" fill="none" stroke="${dark}" stroke-width="16" stroke-linecap="round"/>
      <circle cx="320" cy="570" r="34" fill="#ff9fb9" opacity=".6"/>
      <circle cx="580" cy="570" r="34" fill="#ff9fb9" opacity=".6"/>
      ${motifPath}
      <rect x="90" y="930" width="720" height="170" rx="42" fill="#ffffff" opacity=".88"/>
      <text x="450" y="1010" text-anchor="middle" font-family="Arial, sans-serif" font-size="62" font-weight="800" fill="${dark}">${name}</text>
      <text x="450" y="1074" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="${main}">${initials} / demo Vtuber</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function motifShape(motif: string, color: string) {
  if (motif === "cat") return `<path d="M270 320 L320 220 L370 330 M530 330 L580 220 L630 320" fill="none" stroke="${color}" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (motif === "moon") return `<path d="M645 240 C570 260 560 360 630 400 C540 390 500 270 575 205 C600 185 625 185 645 240 Z" fill="${color}" opacity=".75"/>`;
  if (motif === "music") return `<path d="M620 250 V405 M620 250 L710 230 V380" stroke="${color}" stroke-width="26" stroke-linecap="round"/><circle cx="590" cy="410" r="34" fill="${color}"/><circle cx="700" cy="385" r="34" fill="${color}"/>`;
  if (motif === "flower") return `<g fill="${color}" opacity=".7"><circle cx="650" cy="280" r="30"/><circle cx="700" cy="320" r="30"/><circle cx="650" cy="360" r="30"/><circle cx="600" cy="320" r="30"/><circle cx="650" cy="320" r="22" fill="#fff"/></g>`;
  if (motif === "wing") return `<path d="M215 330 C130 360 120 470 210 520 C205 455 240 395 305 360 Z M685 330 C770 360 780 470 690 520 C695 455 660 395 595 360 Z" fill="${color}" opacity=".55"/>`;
  if (motif === "latte") return `<path d="M635 300 h90 v70 c0 55-40 95-90 95 s-90-40-90-95 v-70 h90 Z" fill="none" stroke="${color}" stroke-width="22"/><path d="M710 325 h35 c30 0 30 55 0 55 h-35" fill="none" stroke="${color}" stroke-width="18"/>`;
  if (motif === "snow") return `<path d="M650 250 v150 M575 325 h150 M598 273 l104 104 M702 273 L598 377" stroke="${color}" stroke-width="18" stroke-linecap="round" opacity=".75"/>`;
  if (motif === "spark") return `<path d="M650 210 l35 90 90 35-90 35-35 90-35-90-90-35 90-35z" fill="${color}" opacity=".7"/>`;
  if (motif === "sea") return `<path d="M555 330 C600 290 645 370 690 330 C725 300 760 330 780 360" fill="none" stroke="${color}" stroke-width="24" stroke-linecap="round" opacity=".75"/>`;
  return `<path d="M650 230 l32 70 76 8-56 52 16 74-68-38-66 38 14-74-54-52 74-8z" fill="${color}" opacity=".72"/>`;
}
