type LofiPlanBenefitsProps = {
  planId: "registered" | "paid" | "boost";
};

const lofiPlans = {
  registered: {
    badge: "Lo-Fi配信特典",
    title: "Lo-Fiチャンネル掲載: 1日2回程度",
    lead: "24時間Lo-Fi配信内で、チャンネル名と画像を紹介します。",
    items: ["VtuberMatch登録者限定", "紹介ショート動画制作無料"],
  },
  paid: {
    badge: "Lo-Fi配信特典",
    title: "Lo-Fiチャンネル掲載: 1日3回程度",
    lead: "紹介ショート動画と24時間Lo-Fi配信内で掲載します。",
    items: ["ナレーションとテロップ付き", "無料プランより掲載回数アップ", "スワイプ画面にショート動画特典を表示"],
  },
  boost: {
    badge: "Lo-Fi配信特典",
    title: "夕方から深夜を優先掲載: 1日5回程度",
    lead: "視聴者が多い時間帯に、より目立つ形で紹介します。",
    items: ["YouTube概要欄にチャンネルリンクを掲載", "紹介画像が流れるたびにコメント欄へ自動リンク投稿"],
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
