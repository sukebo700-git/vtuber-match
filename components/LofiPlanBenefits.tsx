type LofiPlanBenefitsProps = {
  planId: "registered" | "paid" | "boost";
};

const lofiPlans = {
  registered: {
    badge: "ショート動画&24時間宣伝企画",
    title: "Lo-Fi配信+ショート動画+掲載ページ、すべて無料",
    lead: "無料プランの申し込みだけで、3つの宣伝をまとめて利用できます。",
    items: ["25秒CMとしてLo-Fi 24時間配信に掲載", "YouTube Shortsにも無料掲載", "VtuberMatch宣伝ページに無料掲載"],
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
    title: "ベーシックの内容+さらに優先表示で宣伝効果を最大化",
    lead: "1〜3分のCM配信とShorts掲載に加えて、より目立つ形で紹介します。",
    items: [
      "プレミアムフレームでもっと目立てる",
      "YouTube Shortsには音声ナレーション+テキスト付きで掲載",
      "長期的にリスナーに宣伝したい人向け",
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
