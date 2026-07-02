type LofiPlanBenefitsProps = {
  planId: "registered" | "paid" | "boost";
};

const lofiPlans = {
  registered: {
    badge: "Lo-Fi配信特典",
    title: "画像つき20秒掲載",
    lead: "VtuberMatchロゴ + チャンネル名 + 画像1枚 + X/YouTubeリンク付きエンディング",
    items: ["昼間中心に掲載", "VtuberMatch登録者限定"],
  },
  paid: {
    badge: "Lo-Fi配信特典",
    title: "紹介動画をフル放映",
    lead: "約60〜90秒の紹介動画を24時間・全時間帯で掲載",
    items: ["ナレーション + テロップ付き", "1日あたりの表示回数が増加", "スワイプ画面に「ショート動画」と表示"],
  },
  boost: {
    badge: "Lo-Fi配信特典",
    title: "夕方〜深夜を優先掲載",
    lead: "視聴者が多い時間帯で、さらに目立つ形で紹介",
    items: ["YouTube概要欄にチャンネルリンクを常時掲載", "紹介映像が流れるたびにコメント欄へ自動リンク投稿"],
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
