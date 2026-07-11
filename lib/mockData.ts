import type { Streamer } from "./types";

const baseImages = [
  "https://images.unsplash.com/photo-1493246507139-91e8fad9978e",
  "https://images.unsplash.com/photo-1516280440614-37939bbacd81",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
  "https://images.unsplash.com/photo-1511512578047-dfb367046420",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429",
  "https://images.unsplash.com/photo-1520975682031-a42d5ff16f0f"
];

const names = [
  "月森ゆい",
  "春日なな",
  "夜凪レン",
  "佐倉みお",
  "湊あお",
  "星野こはる",
  "白瀬ノア",
  "雨宮シオン",
  "橘ひまり",
  "灯乃ましろ",
  "神崎りく",
  "朝比奈めい",
  "千歳ルカ",
  "花守すず",
  "黒瀬かなめ",
  "七瀬ほのか",
  "水無月とわ",
  "真白ゆら",
  "一ノ瀬ハル",
  "綾瀬つむぎ",
  "森野こまち",
  "天音りお",
  "藤宮エマ",
  "日向セナ",
  "久遠ミナ",
  "結城そら",
  "青葉かな",
  "小鳥遊ミク",
  "風見いろは",
  "椎名まこと"
];

const categorySets = [
  ["癒し系", "雑談", "深夜配信"],
  ["歌枠", "初見歓迎", "作業用"],
  ["ゲーム", "参加型", "企画配信"],
  ["ASMR", "朗読", "癒し系"],
  ["朝活", "雑談", "初見歓迎"]
];

const tagSets = [
  ["落ち着く声", "少人数", "聞き専歓迎", "寝落ち向け"],
  ["元気", "コメント拾い多め", "新人", "毎日配信"],
  ["ゲーム実況", "参加型", "週末配信", "日本語"],
  ["歌うま", "作業BGM", "短時間", "まったり"],
  ["個人勢", "深夜勢", "雑談多め", "初見さん歓迎"]
];

export const mockStreamers: Streamer[] = names.map((name, index) => {
  const stale = index % 9 === 0;
  const boost = index % 7 === 0;
  const image = `${baseImages[index % baseImages.length]}?auto=format&fit=crop&w=900&q=82&sig=${index}`;
  const vtypeId = (index % 16) + 1;

  return {
    id: `seed-${index + 1}`,
    name,
    youtube_url: "https://www.youtube.com/@YouTubeJapan",
    youtube_channel_id: "UCkRfArvrzheW2E7b6SVT7vQ",
    thumbnails: [image],
    categories: categorySets[index % categorySets.length],
    tags: tagSets[index % tagSets.length],
    description: `${name}の小さな配信部屋。初見でも入りやすい距離感で、雑談や好きなゲームをゆっくり届けます。`,
    one_liner: ["声で一息つける夜配信", "初見コメントも拾います", "作業のおともにどうぞ", "少人数でまったり進行"][index % 4],
    stream_time: ["21:00-24:00", "22:30-深夜", "朝 7:00-8:30", "週末 20:00-"][index % 4],
    latest_video_id: "dQw4w9WgXcQ",
    last_video_date: stale ? "2026-03-15T00:00:00.000Z" : "2026-04-28T00:00:00.000Z",
    last_youtube_checked_at: "2026-05-05T00:00:00.000Z",
    plan_type: boost ? "boost" : "free",
    is_initial_scout: true,
    is_visible: true,
    impressions: 120 + index * 7,
    likes: 12 + index,
    vtype_id: vtypeId,
    vtype_code: `TYPE${vtypeId}`,
    vtype_name: `タイプ${vtypeId}`,
    created_at: "2026-05-05T00:00:00.000Z"
  };
});
