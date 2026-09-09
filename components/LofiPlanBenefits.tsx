type LofiPlanBenefitsProps = {
  planId: "registered" | "paid" | "boost" | "pro";
};

const lofiPlans = {
  registered: {
    badge: "ショート動画&24時間宣伝企画",
    title: "Lo-Fi配信+ショート動画+掲載ページ、すべて無料",
    lead: "無料プランの申し込みだけで、3つの宣伝をまとめて利用できます。",
    items: ["20秒CMとしてLo-Fi 24時間配信に掲載", "YouTube Shortsにも無料掲載", "VtuberMatch宣伝ページに無料掲載"],
  },
  paid: {
    badge: "ショート動画&24時間宣伝企画",
    title: "Lo-Fi 24時間配信にテキスト付きCMを掲載",
    lead: "1〜3分のCMを配信して、あなたの活動をしっかり紹介します。",
    items: [
      "YouTube Shortsには音声ナレーション+テキスト付きで掲載",
      "無料プランよりも掲載回数増加",
      "画面滞在時間が大幅アップ",
    ],
  },
  boost: {
    badge: "ショート動画&24時間宣伝企画",
    title: "夕方〜深夜を優先掲載、プレミアムフレームで目立つ",
    lead: "1日5回程度、視聴者が多い時間帯を優先して紹介します。",
    items: [
      "紹介ショート動画にナレーション+テロップ付きで掲載",
      "YouTube概要欄にチャンネルリンクを常時掲載",
      "紹介映像が流れるたびコメント欄へ自動リンク投稿",
    ],
  },
  // PROはプレミアムの掲載・宣伝の特典をそのまま含む
  pro: {
    badge: "ショート動画&24時間宣伝企画",
    title: "プレミアムの掲載・宣伝特典をすべて含む",
    lead: "夕方〜深夜の優先掲載、プレミアムフレームなどはそのまま使えます。",
    items: [
      "紹介ショート動画にナレーション+テロップ付きで掲載",
      "YouTube概要欄にチャンネルリンクを常時掲載",
      "紹介映像が流れるたびコメント欄へ自動リンク投稿",
    ],
  },
} as const;

export function LofiPlanBenefits({ planId }: LofiPlanBenefitsProps) {
  const plan = lofiPlans[planId];

  return (
    <div className="lofi-plan-benefit">
      <span className="lofi-plan-badge">{plan.badge}</span>
      <strong>{plan.title}</strong>
      <p>{plan.lead}</p>
      <ul>
        {plan.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
