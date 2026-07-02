export type StreamerDiagnosisDetail = {
  answerTrend: string;
  strengths: string;
  suitableStreamingStyle: string;
  compatibleListenerType: string;
  vtuberMatchLead: string;
};

export type ListenerDiagnosisDetail = {
  favoriteVtuberType: string;
  recommendedOshiStyle: string;
  summary: string;
};

export const streamerDiagnosisDetails: Record<number, StreamerDiagnosisDetail> = {
  1: {
    answerTrend: "落ち着いた話し方や空気作りを重視する回答傾向があります。",
    strengths: "長く聞ける安心感や、余韻の残る雑談が強みになりそうです。",
    suitableStreamingStyle: "深夜雑談、作業用配信、ゆっくり近況を話す定期配信に向いている可能性があります。",
    compatibleListenerType: "静かに長く通い、コメントよりも空気感を楽しむリスナーと相性が良さそうです。",
    vtuberMatchLead: "VtuberMatchでは、深夜ラジオ型のあなたを待っている視聴者に見つけてもらいましょう。",
  },
  2: {
    answerTrend: "予定外の流れやライブ感を楽しむ回答傾向があります。",
    strengths: "脱線やハプニングを面白さに変えられる瞬発力が強みになりそうです。",
    suitableStreamingStyle: "雑談コラボ、参加型、リアクション重視の企画に向いている可能性があります。",
    compatibleListenerType: "ツッコミやリアクションで一緒に盛り上げるリスナーと相性が良さそうです。",
    vtuberMatchLead: "VtuberMatchで、収拾不能型のあなたと一緒に盛り上がりたい視聴者に見つけてもらいましょう。",
  },
  3: {
    answerTrend: "距離感作りや視聴者との関係性を重視する回答傾向があります。",
    strengths: "初見を自然に巻き込み、また来たくなる空気を作れる点が強みになりそうです。",
    suitableStreamingStyle: "初見歓迎雑談、コメント拾い多めの配信、常連化を狙う定期枠に向いている可能性があります。",
    compatibleListenerType: "名前を覚え合う距離感や、少しずつ関係が深まる推し活が好きなリスナーと相性が良さそうです。",
    vtuberMatchLead: "VtuberMatchでは、沼製造機型のあなたに惹かれる視聴者が見つかるかもしれません。",
  },
  4: {
    answerTrend: "継続や配信習慣を大切にする回答傾向があります。",
    strengths: "約束を守る安定感や、長期的に活動を積み上げる力が強みになりそうです。",
    suitableStreamingStyle: "定期配信、作業枠、成長記録型の企画に向いている可能性があります。",
    compatibleListenerType: "毎週通うことや成長を見守ることに喜びを感じるリスナーと相性が良さそうです。",
    vtuberMatchLead: "VtuberMatchで、配信廃人型のあなたを継続的に応援したい視聴者に見つけてもらいましょう。",
  },
  5: {
    answerTrend: "企画の設計や見せ場作りを重視する回答傾向があります。",
    strengths: "飽きさせない構成力や、新しい切り口を考える力が強みになりそうです。",
    suitableStreamingStyle: "シリーズ企画、検証配信、記念配信、コラボ企画に向いている可能性があります。",
    compatibleListenerType: "次に何をするのかを楽しみに待つ、企画好きのリスナーと相性が良さそうです。",
    vtuberMatchLead: "VtuberMatchでは、企画中毒型のあなたの次の一手を楽しみにする視聴者がいます。",
  },
  6: {
    answerTrend: "好きなものを熱量高く語る回答傾向があります。",
    strengths: "知識量や推し語りの濃さで、視聴者を巻き込める点が強みになりそうです。",
    suitableStreamingStyle: "考察、解説、推し語り、ジャンル特化配信に向いている可能性があります。",
    compatibleListenerType: "深い話や好きの熱量を一緒に楽しめるリスナーと相性が良さそうです。",
    vtuberMatchLead: "VtuberMatchで、オタク暴走型のあなたの熱量を楽しむ視聴者に見つけてもらいましょう。",
  },
  7: {
    answerTrend: "挑戦や勝負どころで燃える回答傾向があります。",
    strengths: "粘り強さや本気の姿を見せられる点が強みになりそうです。",
    suitableStreamingStyle: "耐久、ランキング、縛りプレイ、目標達成型の配信に向いている可能性があります。",
    compatibleListenerType: "努力の過程を応援し、達成の瞬間を一緒に喜ぶリスナーと相性が良さそうです。",
    vtuberMatchLead: "VtuberMatchでは、勝つまで寝ない型のあなたを応援したい視聴者が待っています。",
  },
  8: {
    answerTrend: "居場所づくりや初見の入りやすさを重視する回答傾向があります。",
    strengths: "温かいコミュニティ作りや常連化のしやすさが強みになりそうです。",
    suitableStreamingStyle: "朝活、定期雑談、視聴者参加型、初見歓迎枠に向いている可能性があります。",
    compatibleListenerType: "安心して戻ってこられる場所を求めるリスナーと相性が良さそうです。",
    vtuberMatchLead: "VtuberMatchで、古参量産型のあなたの居場所に合う視聴者に見つけてもらいましょう。",
  },
  9: {
    answerTrend: "コメント欄の空気や相手の反応を丁寧に見る回答傾向があります。",
    strengths: "視聴者を置いていかない優しさや、場を温める力が強みになりそうです。",
    suitableStreamingStyle: "コメント多めの雑談、相談系、初見歓迎配信に向いている可能性があります。",
    compatibleListenerType: "会話に参加したい、反応をもらえると嬉しいリスナーと相性が良さそうです。",
    vtuberMatchLead: "VtuberMatchでは、コメント救急隊型のあなたに話しかけたい視聴者がいます。",
  },
  10: {
    answerTrend: "刺激よりも心地よさや生活への馴染みやすさを重視する回答傾向があります。",
    strengths: "長時間でも疲れにくい雰囲気や、日常に寄り添う配信が強みになりそうです。",
    suitableStreamingStyle: "作業用、睡眠前、朝活、ゆったりゲーム配信に向いている可能性があります。",
    compatibleListenerType: "生活の中で自然に通える推しを探しているリスナーと相性が良さそうです。",
    vtuberMatchLead: "VtuberMatchで、作業用BGM型のあなたを日常に迎えたい視聴者に見つけてもらいましょう。",
  },
  11: {
    answerTrend: "盛り上がりや参加感を大切にする回答傾向があります。",
    strengths: "画面越しでも熱を伝え、場のテンションを上げる力が強みになりそうです。",
    suitableStreamingStyle: "参加型、イベント配信、リアクション企画、歌枠に向いている可能性があります。",
    compatibleListenerType: "一緒に騒いだり、コメントで場を盛り上げたりしたいリスナーと相性が良さそうです。",
    vtuberMatchLead: "VtuberMatchでは、お祭り騒ぎ型のあなたと一緒に楽しみたい視聴者がいます。",
  },
  12: {
    answerTrend: "自然体の魅力や親しみやすさが出やすい回答傾向があります。",
    strengths: "作り込みすぎない素直さや、思わず応援したくなる雰囲気が強みになりそうです。",
    suitableStreamingStyle: "日常雑談、初見歓迎、ゆるい参加型、成長を見せる配信に向いている可能性があります。",
    compatibleListenerType: "自然体の反応や少し抜けたところも楽しめるリスナーと相性が良さそうです。",
    vtuberMatchLead: "VtuberMatchで、愛され天然型のあなたを見守りたい視聴者に見つけてもらいましょう。",
  },
  13: {
    answerTrend: "見せ場や注目される瞬間を意識する回答傾向があります。",
    strengths: "場の中心で印象を残す力や、企画を引っ張る力が強みになりそうです。",
    suitableStreamingStyle: "大型企画、コラボ、歌枠、記念配信、発表系に向いている可能性があります。",
    compatibleListenerType: "華やかな瞬間や成長の節目を一緒に追いたいリスナーと相性が良さそうです。",
    vtuberMatchLead: "VtuberMatchでは、主役体質型のあなたの輝きを見つけたい視聴者がいます。",
  },
  14: {
    answerTrend: "深い話や濃い関係性を大切にする回答傾向があります。",
    strengths: "少人数でも刺さる話や、濃いファンを育てる力が強みになりそうです。",
    suitableStreamingStyle: "考察雑談、深夜枠、専門ジャンル、長時間の語り配信に向いている可能性があります。",
    compatibleListenerType: "静かに深く推したい、濃い話を楽しみたいリスナーと相性が良さそうです。",
    vtuberMatchLead: "VtuberMatchで、配信深海魚型のあなたに深く刺さる視聴者に見つけてもらいましょう。",
  },
  15: {
    answerTrend: "挑戦・改善・突破を重視する回答傾向があります。",
    strengths: "限界を決めずに伸びていく姿を見せられる点が強みになりそうです。",
    suitableStreamingStyle: "目標達成企画、耐久、成長記録、チャレンジ配信に向いている可能性があります。",
    compatibleListenerType: "努力や伸びしろを応援し、節目を一緒に祝うリスナーと相性が良さそうです。",
    vtuberMatchLead: "VtuberMatchでは、限界突破型のあなたの挑戦を応援したい視聴者がいます。",
  },
  16: {
    answerTrend: "雑談・企画・熱量・見せ場を幅広く重視する回答傾向があります。",
    strengths: "複数の魅力を組み合わせて、記憶に残る配信を作れる点が強みになりそうです。",
    suitableStreamingStyle: "大型企画、コラボ、歌・ゲーム・雑談を組み合わせた総合エンタメ配信に向いている可能性があります。",
    compatibleListenerType: "いろいろな楽しみ方で推したい、拡散や参加にも前向きなリスナーと相性が良さそうです。",
    vtuberMatchLead: "VtuberMatchで、エンタメ怪獣型のあなたを全力で楽しみたい視聴者に見つけてもらいましょう。",
  },
};

export const listenerDiagnosisDetails: Record<number, ListenerDiagnosisDetail> = {
  1: { favoriteVtuberType: "落ち着いた語り手・癒し型", recommendedOshiStyle: "長期的に通い、作業中や寝る前にゆっくり楽しむ推し活が合いそうです。", summary: "静かに応援しながら、配信者の空気を一緒に育てる楽しみ方に向いています。" },
  2: { favoriteVtuberType: "ライブ感の強いハプニング型", recommendedOshiStyle: "コメントでツッコミを入れたり、切り抜きたくなる瞬間を探したりすると楽しめそうです。", summary: "予定外の面白さを一緒に楽しむ推し活と相性が良さそうです。" },
  3: { favoriteVtuberType: "距離感上手な沼型", recommendedOshiStyle: "コメントや感想投稿で少しずつ関係を深める視聴スタイルが合いそうです。", summary: "気づいたら通いたくなるタイプのVTuberを好きになりやすい傾向があります。" },
  4: { favoriteVtuberType: "努力型・継続型", recommendedOshiStyle: "定期配信に通い、成長や節目を長く見守る推し活が楽しめそうです。", summary: "積み重ねる配信者を応援することで満足感が高まりそうです。" },
  5: { favoriteVtuberType: "企画型・発明家タイプ", recommendedOshiStyle: "企画の感想を残したり、Xで拡散に協力したりすると楽しめそうです。", summary: "次に何をするのかを追う推し活に向いています。" },
  6: { favoriteVtuberType: "知識特化・オタク語り型", recommendedOshiStyle: "考察や深い話題に反応し、感想投稿で会話を広げる視聴スタイルが合いそうです。", summary: "好きの熱量が濃いVTuberを推すと満足度が高そうです。" },
  7: { favoriteVtuberType: "挑戦型・勝負型", recommendedOshiStyle: "耐久や目標達成をリアルタイムで応援し、達成の瞬間を一緒に祝うと楽しめそうです。", summary: "努力とドラマのある配信者に惹かれやすい傾向があります。" },
  8: { favoriteVtuberType: "居場所作りが得意な常連化タイプ", recommendedOshiStyle: "挨拶や定期コメントで配信の空気に参加する推し活が合いそうです。", summary: "安心して帰れる場所のようなVTuberを好きになりやすそうです。" },
  9: { favoriteVtuberType: "コメントを大切にする共感型", recommendedOshiStyle: "コメントをよくして、配信者との会話を楽しむ視聴スタイルが向いています。", summary: "反応を返してくれる配信者を推すと楽しさが増えそうです。" },
  10: { favoriteVtuberType: "生活に溶け込む癒し型", recommendedOshiStyle: "作業用・朝活・寝る前など、生活リズムに合わせて通う推し活が合いそうです。", summary: "無理なく長く見続けられるVTuberと相性が良さそうです。" },
  11: { favoriteVtuberType: "お祭り・参加型タイプ", recommendedOshiStyle: "コメント、弾幕、参加型企画、Xでの拡散に協力するとより楽しめそうです。", summary: "一緒に盛り上がる推し活で満足感が高まりそうです。" },
  12: { favoriteVtuberType: "自然体で愛されるタイプ", recommendedOshiStyle: "日常の反応を楽しみ、記念日や節目を一緒に祝う推し活が合いそうです。", summary: "飾らない魅力を見守る推し活と相性が良さそうです。" },
  13: { favoriteVtuberType: "主役感のあるスター型", recommendedOshiStyle: "大型企画や発表の瞬間を追い、Xで感想や応援を投稿すると楽しめそうです。", summary: "華やかな場面を一緒に盛り上げる推し活に向いています。" },
  14: { favoriteVtuberType: "深く刺さる職人型", recommendedOshiStyle: "長文感想や考察、静かな応援で深く関わる視聴スタイルが合いそうです。", summary: "少人数でも濃い関係性の配信者に惹かれやすい傾向があります。" },
  15: { favoriteVtuberType: "成長・限界突破型", recommendedOshiStyle: "目標達成までの過程を追い、節目ごとに感想やお祝いを届ける推し活が楽しめそうです。", summary: "伸びていく姿を一緒に見届ける推し活に向いています。" },
  16: { favoriteVtuberType: "総合エンタメ型", recommendedOshiStyle: "配信参加、感想投稿、拡散、切り抜きなど複数の応援を組み合わせると楽しめそうです。", summary: "いろいろな面を持つVTuberを全方位で推すスタイルと相性が良さそうです。" },
};
