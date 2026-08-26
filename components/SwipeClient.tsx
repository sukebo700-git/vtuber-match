"use client";

import { BadgeCheck, ChevronDown, ExternalLink, Heart, Info, Search, Share2, Sparkles, Star, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, REGIONS, virtualRegionLabel } from "@/lib/constants";
import { diagnosisTypes } from "@/lib/diagnosis";
import { viewerVtypeStorageKey, type VtypeProfileFields } from "@/lib/diagnosisProfile";
import { ensureAnonymousUser } from "@/lib/firebase";
import { anonymousViewerProfile, getViewerIdentity } from "@/lib/viewerIdentity";
import { videoSiteLabel, youtubeSubscribeUrl } from "@/lib/youtube";
import type { SwipeAdCard } from "@/lib/swipeAds";
import type { Streamer, ViewerProfile } from "@/lib/types";
import type { VtuberGoodsCard } from "@/lib/vtuberGoods";
import { readLoginKind } from "@/components/SmartPromoLink";
import { UiBadge } from "@/components/ui/UiBadge";
import { UiButton } from "@/components/ui/UiButton";
import { UiPanel } from "@/components/ui/UiPanel";

type SwipeClientProps = {
  initialStreamers: Streamer[];
  adCards?: SwipeAdCard[];
  goodsCards?: VtuberGoodsCard[];
  adIntervals?: { guest: number; free: number };
  /** 自社枠(グッズ掲載枠の宣伝)を広告ローテーションに含めるか */
  houseAdEnabled?: boolean;
  /** 検索バー・サイドパネル(今日のひとこと/おすすめ)を隠したシンプル表示にする。 */
  minimal?: boolean;
  /** 指定時、渡されたデッキ(initialStreamers)を1周スワイプし終えたら自動遷移する。 */
  redirectOnComplete?: string;
};

type MatchNotice = {
  key: string;
  streamerId: string;
  name: string;
  youtubeUrl: string;
};

// スワイプ列に差し込むカード。アフィリエイト広告とVTuberグッズを1:1で交互に出しつつ、
// 自社枠(グッズ掲載枠の宣伝)をアフィリエイト2件につき1件の割合で挟む。
type DeckAd = {
  id: string;
  kind: "affiliate" | "goods" | "house";
  title: string;
  imageUrl: string;
  url: string;
  /** グッズ枠のみ: 誰のグッズか */
  ownerName?: string;
  description?: string;
};

/**
 * 自社枠: グッズ掲載枠(プレミアムプラン特典)の宣伝。在庫や設定に関係なく固定で表示する。
 * リンク先は視聴者にとって行き止まりにならないよう、配信者ログイン中のみ申込フォーム
 * (/creator/merch)へ、それ以外(視聴者ログイン中・未ログイン)は説明ページ(/creator)へ。
 */
function buildHouseAd(): DeckAd {
  return {
    id: "house-goods-slot",
    kind: "house",
    title: "あなたのグッズをこの枠で宣伝しませんか？",
    imageUrl: "/promo/house-ad/house-ad.jpg",
    url: readLoginKind() === "creator" ? "/creator/merch" : "/creator",
  };
}

const viewerProfileKey = "vtuber-match-viewer-profile";
const analyticsVisitorKey = "vtuber-match-analytics-visitor-id";
const guestSwipeCountKey = "vtuber-match-guest-swipe-count-v2";
const guestSwipeDateKey = "vtuber-match-guest-swipe-date-v2";
const guestSwipeLimit = 40;
const impressionSessionPrefix = "vtuber-match-impression-session-";
const pendingImpressionKey = "vtuber-match-pending-impressions";
const pendingImpressionFlushTimerKey = "vtuber-match-pending-impressions-flush-timer";
// スワイプカードの既見管理(48hクールダウン)。バッチ送信の仕組みはimpressionsと同じ。
const pendingSeenKey = "vtuber-match-pending-seen";
const pendingSeenFlushTimerKey = "vtuber-match-pending-seen-flush-timer";
const pendingSwipeActionKey = "vtuber-match-pending-swipe-actions";
const pendingSwipeActionLastSentKey = "vtuber-match-pending-swipe-actions-last-sent";
// 広告表示の進行状態。外部の商品ページへ遷移して戻ってきても、
// 同じ広告を出さず次のVTuberカードから再開できるよう永続化する。
const adProgressKey = "vtuber-match-ad-progress-v1";

export function SwipeClient({
  initialStreamers,
  adCards = [],
  goodsCards = [],
  adIntervals = { guest: 10, free: 25 },
  houseAdEnabled = false,
  minimal = false,
  redirectOnComplete,
}: SwipeClientProps) {
  const [index, setIndex] = useState(0);
  // 広告を出す判定に使う「VTuberカードを何人見たか」。広告カード自体は数えない。
  const [vtuberViewCount, setVtuberViewCount] = useState(0);
  const [pendingAd, setPendingAd] = useState<DeckAd | null>(null);
  const [isRegisteredViewer, setIsRegisteredViewer] = useState(false);
  // エリートファンは広告カードを挟まない(課金特典の一つ)。
  const [isEliteViewer, setIsEliteViewer] = useState(false);
  // スワイプカードの既見管理(48hクールダウン)。直近48h以内に見たVTuberのID集合。
  const [recentlySeenIds, setRecentlySeenIds] = useState<Set<string>>(new Set());
  const adTurnRef = useRef(0);
  // アフィリエイト/グッズそれぞれの一覧内での巡回位置(在庫種別ごとに独立)
  const affiliateTurnRef = useRef(0);
  const goodsTurnRef = useRef(0);
  const adProgressLoadedRef = useRef(false);
  // 広告判定の正となるカウント(stateは永続化と再描画のためのミラー)
  const vtuberViewCountRef = useRef(0);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [shuffleSeed, setShuffleSeed] = useState("initial");
  const [filterOpen, setFilterOpen] = useState(false);
  const [regionFilterOpen, setRegionFilterOpen] = useState(false);
  const [matchNotices, setMatchNotices] = useState<MatchNotice[]>([]);
  const [superBoostStreamer, setSuperBoostStreamer] = useState<Streamer | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [swipeNotice, setSwipeNotice] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [adminViewerMode, setAdminViewerMode] = useState(false);
  const [viewerVtypeId, setViewerVtypeId] = useState<number | null>(null);
  // 連打による二重送信ガード(カード遷移自体は止めない)
  const swipeLockRef = useRef(false);
  // マッチ通知の遅延タイマー。アンマウント/フィルタ変更時に確実に破棄する
  const noticeTimersRef = useRef<number[]>([]);
  // マッチ通知を連続で出さないためのキュー。1件ずつ間隔を空けて表示する
  // (1件目=8秒後、2件目=前の表示から20秒後、3件目以降=60〜150秒間隔)。
  const matchQueueRef = useRef<MatchNotice[]>([]);
  const matchShownCountRef = useRef(0);
  const matchScheduleTimerRef = useRef<number | null>(null);

  const streamers = useMemo(() => {
    const filtered = (categoryFilter || regionFilter)
      ? initialStreamers.filter((streamer) => (
          (!categoryFilter || streamer.categories.includes(categoryFilter)) &&
          (!regionFilter || streamer.region === regionFilter)
        ))
      : initialStreamers;
    // minimal(例: 今日のおすすめ10人)は渡されたデッキをそのまま「N人だけ」
    // 出し切ることが目的のため、既読48hクールダウン・課金停止者の後方降格は
    // 適用しない(適用すると10人を切ってしまい、仕様と矛盾するため)。
    const ordered = prioritizeSameVtype(
      shuffleEqualPriorityGroups(
        minimal ? filtered : filterRecentlySeen(filtered, recentlySeenIds),
        shuffleSeed,
      ),
      viewerVtypeId,
    );
    return minimal ? ordered : demoteChurnedStreamers(ordered);
  }, [categoryFilter, regionFilter, initialStreamers, shuffleSeed, viewerVtypeId, recentlySeenIds, minimal]);
  // minimalかつ1周し終えた(=index >= streamers.length)場合はredirectOnComplete先へ
  // 遷移する。遷移直前の一瞬だけ先頭カードが再表示されるチラつきを避けるため、
  // 完了扱いの間はcurrent/nextを出さない。
  const isDeckComplete = minimal && streamers.length > 0 && index >= streamers.length;
  const current = !isDeckComplete && streamers.length ? streamers[index % streamers.length] : undefined;
  const next = !isDeckComplete && streamers.length ? streamers[(index + 1) % streamers.length] : undefined;
  const viewerVtype = diagnosisTypes.find((type) => type.id === viewerVtypeId) || null;
  const recommendedStreamers = useMemo(
    () => viewerVtypeId
      ? initialStreamers
        .filter((streamer) => streamer.vtype_id === viewerVtypeId && streamer.id !== current?.id)
        .slice(0, 3)
      : [],
    [current?.id, initialStreamers, viewerVtypeId],
  );

  const visibleThumbnail = useMemo(() => {
    if (!current?.thumbnails.length) return "";
    const pick = Math.abs(hash(`${current.id}-${index}`)) % current.thumbnails.length;
    return current.thumbnails[pick];
  }, [current, index]);

  useEffect(() => {
    setIndex(0);
    setSwipeNotice("");
    setMoreOpen(false);
  }, [categoryFilter, regionFilter, shuffleSeed]);

  // 保留中のマッチ通知タイマーをアンマウント時に破棄する
  useEffect(() => {
    const timers = noticeTimersRef;
    return () => {
      timers.current.forEach((timerId) => window.clearTimeout(timerId));
      timers.current = [];
    };
  }, []);

  useEffect(() => {
    setShuffleSeed(createSwipeShuffleSeed());
  }, []);

  useEffect(() => {
    if (!current) return;
    if (adminViewerMode || isAdminViewerProfile()) {
      queueImpression(current.id, true);
      return;
    }
    const impressionKey = `${impressionSessionPrefix}${current.id}`;
    if (sessionStorage.getItem(impressionKey)) return;
    sessionStorage.setItem(impressionKey, "1");
    queueImpression(current.id);
  }, [current, adminViewerMode]);

  useEffect(() => {
    const identity = getViewerIdentity();
    const storedProfile = readViewerProfile();
    setViewerVtypeId(resolveVtypeId(storedProfile) || readStoredViewerVtypeId());
    if (!identity.registered) return;
    if (storedProfile?.is_admin_viewer === true) {
      setAdminViewerMode(true);
      return;
    }
    fetch(`/api/viewer-profile?id=${encodeURIComponent(identity.id)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data?.profile) return;
        localStorage.setItem(viewerProfileKey, JSON.stringify(data.profile));
        setViewerVtypeId(resolveVtypeId(data.profile) || readStoredViewerVtypeId());
        if (data.profile.is_admin_viewer === true) setAdminViewerMode(true);
        setIsEliteViewer(data.profile.entitlement_tier === "elite");
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const viewerId = getViewerIdentity().id;
    if (!viewerId) return;
    fetch(`/api/swipe-state?id=${encodeURIComponent(viewerId)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (Array.isArray(data?.seen_streamer_ids)) setRecentlySeenIds(new Set(data.seen_streamer_ids));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const flush = () => {
      flushImpressions();
      flushSwipeActions();
      flushSeen(getViewerIdentity().id);
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  useEffect(() => {
    [current?.thumbnails[0], next?.thumbnails[0]].filter(Boolean).forEach((src) => {
      const image = new Image();
      image.decoding = "async";
      image.src = src as string;
    });
  }, [current, next]);

  // 外部の商品ページから戻ってきたときに、広告の進行状況を引き継ぐ。
  //
  // カード位置(index)は保存しない。デッキはマウントごとにシャッフルされるため
  // 同じindexが同じVTuberを指さず、復元しても意味がないうえ、シャッフル用の
  // effectがindexを0へ戻すのと競合するため。
  // pendingAdも復元しない = 同じ広告を再表示せず次のVTuberカードから再開する。
  // 一方カウンタは引き継ぐ(リロードで広告を回避できてしまうのを防ぐ)。
  useEffect(() => {
    try {
      const raw = localStorage.getItem(adProgressKey);
      if (raw) {
        const saved = JSON.parse(raw) as {
          viewCount?: number;
          adTurn?: number;
          affiliateTurn?: number;
          goodsTurn?: number;
        };
        if (Number.isFinite(saved.viewCount)) {
          const restored = Math.max(0, Number(saved.viewCount));
          vtuberViewCountRef.current = restored;
          setVtuberViewCount(restored);
        }
        if (Number.isFinite(saved.adTurn)) adTurnRef.current = Math.max(0, Number(saved.adTurn));
        if (Number.isFinite(saved.affiliateTurn)) affiliateTurnRef.current = Math.max(0, Number(saved.affiliateTurn));
        if (Number.isFinite(saved.goodsTurn)) goodsTurnRef.current = Math.max(0, Number(saved.goodsTurn));
      }
    } catch {
      // 復元に失敗しても先頭から始めれば良いだけなので握りつぶす
    }
    setIsRegisteredViewer(getViewerIdentity().registered);
    adProgressLoadedRef.current = true;
  }, []);

  // 保存値はrefから読む。復元直後の再描画前にこのeffectが走っても、
  // stateはまだ更新前なので0で上書きしてしまうため。
  useEffect(() => {
    if (!adProgressLoadedRef.current) return;
    try {
      localStorage.setItem(adProgressKey, JSON.stringify({
        viewCount: vtuberViewCountRef.current,
        adTurn: adTurnRef.current,
        affiliateTurn: affiliateTurnRef.current,
        goodsTurn: goodsTurnRef.current,
      }));
    } catch {
      // 保存できなくても進行自体は続けられる
    }
  }, [vtuberViewCount]);

  // localStorageはSSR中に触れないため、登録判定は必ずeffect経由で状態に落とす
  const adInterval = isRegisteredViewer ? adIntervals.free : adIntervals.guest;

  /**
   * 広告ローテーション: アフィリエイト:グッズ:自社枠 = 2:1:1 の固定パターンで出す。
   * 該当種別の在庫が無い/自社枠オフの場合はアフィリエイト→グッズ→自社枠の順で
   * 振り替え、広告枠そのものが無駄に空振りしないようにする。
   */
  function pickNextAd(): DeckAd | null {
    const affiliates = adCards;
    const goods = goodsCards;

    const pickAffiliate = (): DeckAd | null => {
      if (!affiliates.length) return null;
      const card = affiliates[affiliateTurnRef.current % affiliates.length];
      affiliateTurnRef.current += 1;
      return { id: card.id, kind: "affiliate", title: card.title || card.label, imageUrl: card.image_url, url: card.url };
    };
    const pickGoods = (): DeckAd | null => {
      if (!goods.length) return null;
      const card = goods[goodsTurnRef.current % goods.length];
      goodsTurnRef.current += 1;
      return {
        id: card.id,
        kind: "goods",
        title: card.title,
        imageUrl: card.image_url,
        url: card.url,
        ownerName: card.streamer_name,
        description: card.description,
      };
    };
    const pickHouse = (): DeckAd | null => (houseAdEnabled ? buildHouseAd() : null);

    const pattern: Array<"affiliate" | "goods" | "house"> = ["affiliate", "affiliate", "goods", "house"];
    const slot = pattern[adTurnRef.current % pattern.length];
    adTurnRef.current += 1;

    if (slot === "affiliate") return pickAffiliate() ?? pickGoods() ?? pickHouse();
    if (slot === "goods") return pickGoods() ?? pickAffiliate() ?? pickHouse();
    return pickHouse() ?? pickAffiliate() ?? pickGoods();
  }

  function dismissAd() {
    setPendingAd(null);
  }

  // Optimistic UI: いいねの通信結果を待たずに必ず次のカードへ進む。
  // Firestore保存・マッチ判定はバックグラウンドで走らせ、失敗時のみ通知する。
  function swipe(direction: "left" | "right") {
    if (!current || !streamers.length) return;
    // 広告カード表示中はVTuberカードへの操作を受け付けない(閉じると再開する)
    if (pendingAd) return;
    if (swipeLockRef.current) return;
    if (!canGuestSwipe()) {
      setLimitReached(true);
      return;
    }
    // ドラッグ完了とボタン連打が同一カードに二重発火するのを防ぐ短時間ロック。
    // カード送り自体は下で即座に行うため、体感速度には影響しない。
    swipeLockRef.current = true;
    window.setTimeout(() => {
      swipeLockRef.current = false;
    }, 150);

    const liked = direction === "right" ? current : null;
    if (liked) {
      const creatorProfile = readCreatorSwipeProfile();
      if (creatorProfile?.creator_streamer_id === liked.id) {
        setSwipeNotice("自分の配信者プロフィールにはいいねできません。");
        return;
      }
      // 48hの既見クールダウンは「いいね(=即マッチ)した相手」にのみ適用する。
      // スキップした相手まで隠すと、配信者数が少ないうちにデッキがすぐ枯渇するうえ、
      // スキップは何度も出てきて良いという方針のため、スキップではここを呼ばない。
      queueSeen(getViewerIdentity().id, liked.id);
    }

    trackSwipeAnalytics();
    trackSwipeAction();
    incrementGuestSwipeCount();

    if (liked) {
      void sendLike(liked).then((isNewMatch) => {
        // 初回マッチの時だけ通知する。48hの既読クールダウンを撤廃したことで
        // 同じVTuberに何度もいいねできるようになったため、その都度「マッチしました」
        // が出てしまわないよう、サーバー側の判定結果を待ってから出す。
        if (isNewMatch) enqueueMatchNotice(liked);
      });
    }
    advance();
  }

  async function sendLike(liked: Streamer): Promise<boolean> {
    try {
      const userId = await getSwipeUserId();
      const identity = getViewerIdentity();
      const creatorProfile = readCreatorSwipeProfile();
      const viewerProfile = readViewerProfile();
      const publicViewerProfile = !identity.registered && creatorProfile
        ? creatorProfile
        : identity.registered && viewerProfile?.is_admin_viewer
        ? anonymousViewerProfile(identity.id)
        : identity.registered && viewerProfile?.visible_to_matched_streamers
        ? viewerProfile
        : identity.registered
          ? { id: identity.id, display_name: identity.auth?.name || "", visible_to_matched_streamers: true }
          : anonymousViewerProfile(identity.id);
      const likeUserId = creatorProfile && !identity.registered ? `creator-swipe-${creatorProfile.creator_streamer_id}` : userId;
      const likeProfileId = creatorProfile && !identity.registered ? `creator-${creatorProfile.creator_streamer_id}` : identity.id;
      const response = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          user_id: likeUserId,
          streamer_id: liked.id,
          viewer_profile_id: likeProfileId,
          viewer_profile: publicViewerProfile,
        }),
      });
      if (response.ok) {
        const data = await response.json().catch(() => null);
        return Boolean(data?.is_new_match);
      }
      // 1日1回制限・上限到達は仕様上の正常系なので、静かに無視して
      // スワイプ体験を止めない(既にカードは次へ進んでいる)。
      if (response.status === 429) return false;
      setSwipeNotice(`${liked.name}さんへのいいねを送信できませんでした。`);
      return false;
    } catch {
      setSwipeNotice(`${liked.name}さんへのいいねを送信できませんでした。`);
      return false;
    }
  }

  // いいね直後にモーダルで止めず、非同期でヘッダー付近へ通知を出す。連続いいねで
  // 何件も重なって出るのを防ぐため、キューに積んで1件ずつ間隔を空けて表示する。
  // 表示に必要な情報はいいね時点でクライアントに持っているため追加readは発生しない。
  function enqueueMatchNotice(liked: Streamer) {
    matchQueueRef.current.push({
      key: `${liked.id}-${Date.now()}`,
      streamerId: liked.id,
      name: liked.name,
      youtubeUrl: liked.youtube_url,
    });
    scheduleNextMatchNotice();
  }

  function scheduleNextMatchNotice() {
    if (matchScheduleTimerRef.current !== null) return;
    if (!matchQueueRef.current.length) return;
    const shown = matchShownCountRef.current;
    // 1件目=8秒後、2件目=前の表示から20秒後、3件目以降=60〜150秒間隔。
    const delay = shown === 0 ? 8000 : shown === 1 ? 20000 : 60000 + Math.floor(Math.random() * 90000);
    const timerId = window.setTimeout(() => {
      matchScheduleTimerRef.current = null;
      noticeTimersRef.current = noticeTimersRef.current.filter((item) => item !== timerId);
      const notice = matchQueueRef.current.shift();
      if (!notice) return;
      matchShownCountRef.current += 1;
      setMatchNotices([notice]);
      const dismissId = window.setTimeout(() => {
        noticeTimersRef.current = noticeTimersRef.current.filter((item) => item !== dismissId);
        setMatchNotices((current) => current.filter((item) => item.key !== notice.key));
      }, 9000);
      noticeTimersRef.current.push(dismissId);
      scheduleNextMatchNotice();
    }, delay);
    matchScheduleTimerRef.current = timerId;
    noticeTimersRef.current.push(timerId);
  }

  function dismissMatchNotice(key: string) {
    setMatchNotices((current) => current.filter((item) => item.key !== key));
  }

  function advance() {
    setIndex((value) => value + 1);
    // minimal(今日のおすすめ10人)は広告を挟まない仕様のため、カウントも増やさない。
    // ここで増やしてしまうと、広告が出ないまま数字だけ進み、次に/swipeへ移った時に
    // 持ち越したカウントのせいで想定より早く広告が出てしまう。
    if (minimal) return;
    // VTuberカードを見た数だけ数え、規定人数に達したら次に広告を1枚挟む。
    // 広告カード自体はこのカウントに含まれない。
    //
    // カウントの正はrefで持つ。setStateの更新関数は純粋である必要があり、
    // その中でpickNextAd()のような副作用を呼ぶとStrictModeの二重実行で
    // ローテーションが2手進んでしまうため、必ず外側で判定する。
    vtuberViewCountRef.current += 1;
    const nextCount = vtuberViewCountRef.current;
    setVtuberViewCount(nextCount);
    if (adInterval > 0 && !isEliteViewer && nextCount % adInterval === 0) {
      const ad = pickNextAd();
      if (ad) setPendingAd(ad);
    }
  }

  if (!initialStreamers.length) {
    return (
      <UiPanel as="div" className="empty-swipe-state">
        <h2>ただいまスワイプデータを準備中です</h2>
        <p>アクセス集中や一時的な読み込み制限により、カードを表示できない場合があります。少し時間をおいて再読み込みしてください。</p>
        <div className="empty-swipe-actions">
          <UiButton type="button" onClick={() => window.location.reload()}>
            再読み込み
          </UiButton>
          <UiButton variant="secondary" href="/">
            TOPへ戻る
          </UiButton>
          <UiButton variant="secondary" href="/creator/apply">
            VTuberとして登録
          </UiButton>
        </div>
      </UiPanel>
    );
  }

  return (
    <section className={minimal ? "swipe-stage swipe-stage-minimal" : "swipe-stage"}>
      <div className="swipe-main">
        {!minimal && (
        <div className="swipe-search">
          <button className="mini-button" type="button" onClick={() => setFilterOpen((value) => !value)}>
            <Search size={16} />
            カテゴリ検索
          </button>
          {categoryFilter && (
            <button className="mini-button clear-filter" type="button" onClick={() => setCategoryFilter("")}>
              {categoryFilter}を解除
            </button>
          )}
          {filterOpen && (
            <div className="category-popover">
              <button type="button" className={!categoryFilter ? "selected" : ""} onClick={() => setCategoryFilter("")}>
                すべて
              </button>
              {CATEGORIES.map((category) => (
                <button
                  type="button"
                  className={categoryFilter === category ? "selected" : ""}
                  key={category}
                  onClick={() => {
                    setCategoryFilter(category);
                    setFilterOpen(false);
                  }}
                >
                  {category}
                </button>
              ))}
            </div>
          )}
          <button className="mini-button" type="button" onClick={() => setRegionFilterOpen((value) => !value)}>
            <Search size={16} />
            活動地域検索
          </button>
          {regionFilter && (
            <button className="mini-button clear-filter" type="button" onClick={() => setRegionFilter("")}>
              {virtualRegionLabel(regionFilter)}を解除
            </button>
          )}
          {regionFilterOpen && (
            <div className="category-popover">
              <button type="button" className={!regionFilter ? "selected" : ""} onClick={() => { setRegionFilter(""); setRegionFilterOpen(false); }}>
                すべて
              </button>
              {REGIONS.map((region) => (
                <button
                  type="button"
                  className={regionFilter === region ? "selected" : ""}
                  key={region}
                  onClick={() => {
                    setRegionFilter(region);
                    setRegionFilterOpen(false);
                  }}
                >
                  {virtualRegionLabel(region)}
                </button>
              ))}
            </div>
          )}
        </div>
        )}

        {minimal && streamers.length > 0 && (
          <p className="swipe-minimal-progress">
            {Math.min(index + 1, streamers.length)} / {streamers.length}
          </p>
        )}

        {isDeckComplete ? (
          <div className="status-band swipe-minimal-complete">
            <h2>今日のおすすめは以上です</h2>
            <p>また明日、新しい10人が入れ替わります。</p>
            <div className="empty-swipe-actions">
              <button className="primary-button" type="button" onClick={() => window.open(createRecommendedShareUrl(), "_blank", "noopener,noreferrer")}>
                <Share2 size={16} />
                Xでシェア
              </button>
              {redirectOnComplete && (
                <a className="secondary-button" href={redirectOnComplete}>
                  他のVTuberも探す
                </a>
              )}
            </div>
          </div>
        ) : !current ? (
          <div className="status-band">
            <h2>該当する配信者がいません</h2>
            <p>カテゴリや活動地域を変更するか、検索を解除してください。</p>
          </div>
        ) : (
          <>
            <div className="deck" aria-live="polite">
              {pendingAd ? (
                <AdCard ad={pendingAd} onSkip={dismissAd} />
              ) : (
                <>
                  {next && <PreviewCard streamer={next} />}
                  <SwipeCard
                    key={`${current.id}-${index}`}
                    streamer={current}
                    thumbnail={visibleThumbnail}
                    onSwipe={swipe}
                  />
                </>
              )}
            </div>
            {pendingAd ? (
              <div className="actions">
                <button className="icon-button action-skip" aria-label="広告をスキップ" onClick={dismissAd}>
                  <X size={28} />
                  <span>スキップ</span>
                </button>
              </div>
            ) : (
              <div className="actions">
                <button className="icon-button action-skip" aria-label="スキップ" onClick={() => swipe("left")}>
                  <X size={28} />
                  <span>スキップ</span>
                </button>
                <a className="icon-button action-profile" aria-label="プロフィール" href={`/detail/${current.id}`}>
                  <Info size={26} />
                  <span>プロフィール</span>
                </a>
                <button className="icon-button action-super" aria-label="スーパーいいね" onClick={() => setSuperBoostStreamer(current)}>
                  <Star size={27} fill="currentColor" />
                  <span>スーパー</span>
                </button>
                <button className="icon-button like action-like" aria-label="いいね" onClick={() => swipe("right")}>
                  <Heart size={28} fill="currentColor" />
                  <span>いいね!</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {!minimal && (
      <aside className="side-panel">
        <button className="more-toggle" type="button" onClick={() => setMoreOpen((value) => !value)} aria-expanded={moreOpen}>
          <ChevronDown size={18} />
          さらに見る
        </button>
        <div className={`swipe-more-panel ${moreOpen ? "is-open" : ""}`}>
          {!pendingAd && current && (current.one_liner || (current.plan_type === "boost" && current.archive_url)) && (
            <div className="status-band today-note">
              <h2>
                <Sparkles size={19} /> 今日のひとこと
              </h2>
              {current.one_liner && <p>{current.one_liner}</p>}
              {current.plan_type === "boost" && current.archive_url && <ArchiveEmbed url={current.archive_url} name={current.name} />}
            </div>
          )}
          <div className="status-band next-find-panel">
            <h2>次の推しを見つける</h2>
            <p>右でいいね、左でスキップ。中央ボタンからプロフィールを見られます。</p>
          </div>
          {viewerVtype && (
            <div className="status-band vtype-recommend-panel">
              <h2>おすすめ</h2>
              <p>{viewerVtype.code} {viewerVtype.name} と同じタイプのVTuberです。</p>
              {recommendedStreamers.length ? (
                <div className="vtype-recommend-list">
                  {recommendedStreamers.map((streamer) => (
                    <a href={`/detail/${streamer.id}`} key={streamer.id}>
                      <span>{streamer.name}</span>
                      <small>{streamer.one_liner || streamer.categories.slice(0, 2).join(" / ")}</small>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="help-text">同じタイプのVTuberは準備中です。診断タイプが登録されるとここに表示されます。</p>
              )}
            </div>
          )}
        </div>
      </aside>
      )}

      {matchNotices.length > 0 && (
        <div className="match-notice-stack" aria-live="polite">
          {matchNotices.map((notice) => (
            <div className="match-notice" key={notice.key} role="status">
              <div className="match-notice-icon">
                <Heart size={18} fill="currentColor" />
              </div>
              <div className="match-notice-body">
                <strong>{notice.name}さんとマッチしました</strong>
                <a href={youtubeSubscribeUrl(notice.youtubeUrl)} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} />
                  {videoSiteLabel(notice.youtubeUrl)}を見る
                </a>
              </div>
              <button
                className="match-notice-close"
                type="button"
                aria-label="通知を閉じる"
                onClick={() => dismissMatchNotice(notice.key)}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      {superBoostStreamer && (
        <SuperBoostModalV2 streamer={superBoostStreamer} onClose={() => setSuperBoostStreamer(null)} />
      )}
      {limitReached && (
        <div className="like-choice-backdrop" role="dialog" aria-modal="true">
          <div className="like-choice-modal">
            <h2>無料登録でスワイプ無制限</h2>
            <p>未登録では1日{guestSwipeLimit}件まで試せます。無料登録すると、スワイプを制限なく使えて、プロフィール閲覧や配信リンクへの移動もできます。</p>
            <div className="like-choice-actions">
              <button className="secondary-button" type="button" onClick={() => setLimitReached(false)}>閉じる</button>
              <a className="primary-button" href="/viewer/register">無料登録する</a>
            </div>
          </div>
        </div>
      )}
      {swipeNotice && (
        <div className="like-choice-backdrop" role="dialog" aria-modal="true">
          <div className="like-choice-modal">
            <h2>いいねを送信できませんでした</h2>
            <p>{swipeNotice}</p>
            <div className="like-choice-actions">
              <button className="primary-button" type="button" onClick={() => setSwipeNotice("")}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SuperBoostModal({ streamer, onClose }: { streamer: Streamer; onClose: () => void }) {
  const [effect, setEffect] = useState("shine");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const identity = getViewerIdentity();

  async function checkout(planType: string) {
    if (!identity.registered) {
      window.location.assign("/viewer/register");
      return;
    }
    setBusy(true);
    const response = await fetch("/api/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streamer_id: streamer.id, viewer_id: identity.id, payer_email: identity.auth?.email || "", plan_type: planType, effect }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (response.ok && data.url) {
      window.location.assign(data.url);
      return;
    }
    setStatus(data.error || "スーパーいいねの購入画面を開けませんでした。");
  }

  return (
    <div className="like-choice-backdrop" role="dialog" aria-modal="true">
      <div className="like-choice-modal super-boost-modal">
        <div className="like-choice-icon"><Star size={28} fill="currentColor" /></div>
        <h2>スーパーいいね</h2>
        <p>{streamer.name}さんを72時間、いつもより目立つ表示にします。</p>
        <p className="help-text">どのエフェクトでも表示順位への効果は同じです。</p>
        <div className="effect-choice-grid">
          {[["shine", "キラ"], ["shake", "揺れ"]].map(([value, label]) => (
            <button className={effect === value ? "selected" : ""} type="button" key={value} onClick={() => setEffect(value)}>{label}</button>
          ))}
        </div>
        <div className="like-choice-actions super-boost-actions">
          <button className="primary-button" type="button" disabled={busy} onClick={() => checkout("super_boost_1")}>220円で送る</button>
        </div>
        {status && <p className="help-text">{status}</p>}
        <button className="mini-button" type="button" onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
}

function SuperBoostModalV2({ streamer, onClose }: { streamer: Streamer; onClose: () => void }) {
  const [effect, setEffect] = useState("shine");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const identity = getViewerIdentity();

  async function checkout() {
    if (!identity.registered) {
      window.location.assign("/viewer/register");
      return;
    }
    setBusy(true);
    const response = await fetch("/api/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        streamer_id: streamer.id,
        viewer_id: identity.id,
        payer_email: identity.auth?.email || "",
        plan_type: "super_boost_1",
        effect,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (response.ok && data.url) {
      window.location.assign(data.url);
      return;
    }
    setStatus(data.error || "購入画面を開けませんでした。");
  }

  return (
    <div className="like-choice-backdrop" role="dialog" aria-modal="true">
      <div className="like-choice-modal super-boost-modal">
        <div className="like-choice-icon"><Star size={28} fill="currentColor" /></div>
        <h2>{streamer.name}さんへスーパーいいね</h2>
        <p>72時間、いつもより目立つ表示にします。</p>
        <p className="help-text">どのエフェクトでも表示順位への効果は同じです。購入完了後すぐに発動します。</p>
        <div className="effect-choice-grid">
          {[["shine", "キラ"], ["shake", "揺れ"]].map(([value, label]) => (
            <button className={effect === value ? "selected" : ""} type="button" key={value} onClick={() => setEffect(value)}>{label}</button>
          ))}
        </div>
        <div className="like-choice-actions super-boost-actions">
          <button className="primary-button" type="button" disabled={busy} onClick={checkout}>220円で送る</button>
        </div>
        {status && <p className="help-text">{status}</p>}
        <button className="mini-button" type="button" onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
}

function trackSwipeAnalytics() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const key = `vtuber-match-analytics-swiped_visitor-${today}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    const identity = getViewerIdentity();
    fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event_type: "swiped_visitor",
        visitor_id: identity.id || getAnalyticsVisitorId(),
        path: window.location.pathname,
      }),
    }).catch(() => undefined);
  } catch {
    // Analytics should never block swiping.
  }
}

function trackSwipeAction() {
  const pending = Number(localStorage.getItem(pendingSwipeActionKey) || "0") + 1;
  localStorage.setItem(pendingSwipeActionKey, String(pending));
  const lastSent = Number(localStorage.getItem(pendingSwipeActionLastSentKey) || "0");
  if (pending < 20 && Date.now() - lastSent < 120_000) return;
  flushSwipeActions();
}

function flushSwipeActions() {
  const count = Number(localStorage.getItem(pendingSwipeActionKey) || "0");
  if (count <= 0) return;
  localStorage.setItem(pendingSwipeActionKey, "0");
  localStorage.setItem(pendingSwipeActionLastSentKey, String(Date.now()));
  fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      event_type: "swipe_action",
      visitor_id: getViewerIdentity().id || getAnalyticsVisitorId(),
      path: window.location.pathname,
      count,
    }),
  }).catch(() => undefined);
}

function queueImpression(streamerId: string, immediate = false) {
  try {
    if (immediate) {
      fetch("/api/impressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ streamer_id: streamerId }),
      }).catch(() => undefined);
      return;
    }
    const ids = readPendingImpressions();
    ids.push(streamerId);
    localStorage.setItem(pendingImpressionKey, JSON.stringify(ids.slice(-40)));
    if (ids.length >= 5) flushImpressions();
    scheduleImpressionFlush();
  } catch {
    fetch("/api/impressions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ streamer_id: streamerId }),
    }).catch(() => undefined);
  }
}

function scheduleImpressionFlush() {
  try {
    if (sessionStorage.getItem(pendingImpressionFlushTimerKey)) return;
    sessionStorage.setItem(pendingImpressionFlushTimerKey, "1");
    window.setTimeout(() => {
      sessionStorage.removeItem(pendingImpressionFlushTimerKey);
      flushImpressions();
    }, 6000);
  } catch {
    // Impression tracking should never block swiping.
  }
}

function flushImpressions() {
  const ids = readPendingImpressions();
  if (!ids.length) return;
  localStorage.setItem(pendingImpressionKey, "[]");
  fetch("/api/impressions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ streamer_ids: ids.slice(0, 40) }),
  }).catch(() => {
    const current = readPendingImpressions();
    localStorage.setItem(pendingImpressionKey, JSON.stringify([...ids, ...current].slice(-40)));
  });
}

function readPendingImpressions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(pendingImpressionKey) || "[]");
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean).slice(0, 40) : [];
  } catch {
    return [];
  }
}

function queueSeen(viewerId: string, streamerId: string) {
  if (!viewerId) return;
  try {
    const ids = readPendingSeen();
    ids.push(streamerId);
    localStorage.setItem(pendingSeenKey, JSON.stringify(ids.slice(-40)));
    if (ids.length >= 5) flushSeen(viewerId);
    scheduleSeenFlush(viewerId);
  } catch {
    // 既見記録は失敗してもスワイプ体験を止めない
  }
}

function scheduleSeenFlush(viewerId: string) {
  try {
    if (sessionStorage.getItem(pendingSeenFlushTimerKey)) return;
    sessionStorage.setItem(pendingSeenFlushTimerKey, "1");
    window.setTimeout(() => {
      sessionStorage.removeItem(pendingSeenFlushTimerKey);
      flushSeen(viewerId);
    }, 6000);
  } catch {
    // 既見記録は失敗してもスワイプ体験を止めない
  }
}

function flushSeen(viewerId: string) {
  if (!viewerId) return;
  const ids = readPendingSeen();
  if (!ids.length) return;
  localStorage.setItem(pendingSeenKey, "[]");
  fetch("/api/swipe-state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ id: viewerId, streamer_ids: ids.slice(0, 40) }),
  }).catch(() => {
    const current = readPendingSeen();
    localStorage.setItem(pendingSeenKey, JSON.stringify([...ids, ...current].slice(-40)));
  });
}

function readPendingSeen() {
  try {
    const parsed = JSON.parse(localStorage.getItem(pendingSeenKey) || "[]");
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean).slice(0, 40) : [];
  } catch {
    return [];
  }
}

function canGuestSwipe() {
  const identity = getViewerIdentity();
  if (identity.registered || readCreatorSwipeProfile()) return true;
  resetGuestSwipeCountIfNeeded();
  return Number(localStorage.getItem(guestSwipeCountKey) || "0") < guestSwipeLimit;
}

function incrementGuestSwipeCount() {
  const identity = getViewerIdentity();
  if (identity.registered || readCreatorSwipeProfile()) return;
  resetGuestSwipeCountIfNeeded();
  const count = Number(localStorage.getItem(guestSwipeCountKey) || "0") + 1;
  localStorage.setItem(guestSwipeCountKey, String(count));
  localStorage.setItem(guestSwipeDateKey, currentJstDate());
}

function resetGuestSwipeCountIfNeeded() {
  const today = currentJstDate();
  if (localStorage.getItem(guestSwipeDateKey) === today) return;
  localStorage.setItem(guestSwipeDateKey, today);
  localStorage.setItem(guestSwipeCountKey, "0");
}

function readCreatorSwipeProfile() {
  const streamerId = localStorage.getItem("vtuber-match-creator-streamer-id") || "";
  if (!streamerId) return null;
  const name = localStorage.getItem("vtuber-match-creator-name") || localStorage.getItem("vtuber-match-creator-email") || "配信者";
  return {
    id: `creator-${streamerId}`,
    source_type: "creator" as const,
    creator_streamer_id: streamerId,
    creator_name: name,
    display_name: name,
    is_anonymous: false,
    visible_to_matched_streamers: true,
    viewer_plan: "free" as const,
  };
}

function currentJstDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getAnalyticsVisitorId() {
  const existing = localStorage.getItem(analyticsVisitorKey);
  if (existing) return existing;
  const id = `visitor_${crypto.randomUUID()}`;
  localStorage.setItem(analyticsVisitorKey, id);
  return id;
}

function SwipeCard({
  streamer,
  thumbnail,
  onSwipe,
}: {
  streamer: Streamer;
  thumbnail: string;
  onSwipe: (direction: "left" | "right") => void;
}) {
  const cardRef = useRef<HTMLElement | null>(null);
  const dragStartRef = useRef<number | null>(null);
  const dragXRef = useRef(0);
  const didDragRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const showNewRibbon = isNewStreamer(streamer.created_at);
  const superEffect = isActiveSuperBoost(streamer.super_boost_until) ? streamer.super_boost_effect || "shine" : "";
  const premiumVisual = streamer.plan_type === "boost";
  const visualPlan = premiumVisual ? "boost" : streamer.plan_type;
  const showTopPills = streamer.plan_type !== "free" || streamer.categories.length > 0 || streamer.tags.length > 0 || Boolean(streamer.region);
  const vtypeLabel = streamer.vtype_name ? `VTYPE ${streamer.vtype_code ? `${streamer.vtype_code} ` : ""}${streamer.vtype_name}` : "";

  useEffect(() => {
    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  function paint(x: number) {
    dragXRef.current = x;
    if (frameRef.current) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const card = cardRef.current;
      if (!card) return;
      const rotate = Math.max(-10, Math.min(10, dragXRef.current / 18));
      card.style.transform = `translate3d(${dragXRef.current}px, 0, 0) rotate(${rotate}deg)`;
    });
  }

  function resetCard() {
    paint(0);
    dragStartRef.current = null;
    window.setTimeout(() => {
      didDragRef.current = false;
    }, 90);
  }

  function release() {
    const dragX = dragXRef.current;
    if (dragX > 76) {
      onSwipe("right");
      resetCard();
      return;
    }
    if (dragX < -76) {
      onSwipe("left");
      resetCard();
      return;
    }
    resetCard();
  }

  return (
    <article
      ref={cardRef}
      className={`card plan-${visualPlan} ${superEffect ? `super-effect super-${superEffect}` : ""}`}
      onPointerDown={(event) => {
        dragStartRef.current = event.clientX;
        didDragRef.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (dragStartRef.current === null) return;
        const nextDragX = Math.max(-170, Math.min(170, event.clientX - dragStartRef.current));
        if (Math.abs(nextDragX) > 8) didDragRef.current = true;
        paint(nextDragX);
      }}
      onPointerUp={release}
      onPointerCancel={resetCard}
      onClick={(event) => {
        if (didDragRef.current) {
          event.preventDefault();
          return;
        }
        window.location.assign(`/detail/${streamer.id}`);
      }}
    >
      <div className="card-blur-bg" style={{ backgroundImage: `url(${thumbnail})` }} aria-hidden="true" />
      {showNewRibbon && <div className="new-ribbon">NEW</div>}
      {superEffect && <div className="super-boost-ribbon">SUPER</div>}
      {visualPlan === "boost" && (
        <>
          <div className="card-holo" aria-hidden />
          <div className="card-corners" aria-hidden />
        </>
      )}
      {streamer.plan_type !== "free" && (
        <div className="floating-badge">
          {streamer.plan_type === "boost" ? "PREMIUM" : "優先"}
          <br />
          {streamer.plan_type === "boost" ? "プレミアム" : "上位表示"}
        </div>
      )}
      {streamer.plan_type === "free" ? (
        <div className="floating-like">いいね!</div>
      ) : null}
      <img src={thumbnail} alt={`${streamer.name} image`} loading="eager" decoding="async" fetchPriority="high" />
      <div className="card-overlay">
        {showTopPills && (
          <div className="pill-row">
            {streamer.plan_type !== "free" && (
              <UiBadge variant="official">
                <BadgeCheck size={15} />
                公式
              </UiBadge>
            )}
            {streamer.categories.slice(0, 1).map((category) => (
              <UiBadge key={category}>{category}</UiBadge>
            ))}
            {streamer.region && (
              <UiBadge>{virtualRegionLabel(streamer.region)}</UiBadge>
            )}
            {streamer.tags.slice(0, 3).map((tag) => (
              <UiBadge key={tag}>#{tag}</UiBadge>
            ))}
          </div>
        )}
        <h1>{streamer.name}</h1>
        {vtypeLabel && (
          <div className="card-tag-row">
            <span>{vtypeLabel}</span>
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * 広告カード。VTuberカードと違い「右スワイプで遷移」はしない。
 * アフィリエイト各社の規約は誤クリック誘発を禁じており、意図しない遷移を避けるため
 * 遷移は明示的なタップのみ、左スワイプ/✕はスキップ(クリック扱いにならない)とする。
 */
function AdCard({ ad, onSkip }: { ad: DeckAd; onSkip: () => void }) {
  const cardRef = useRef<HTMLElement | null>(null);
  const dragStartRef = useRef<number | null>(null);
  const dragXRef = useRef(0);
  const didDragRef = useRef(false);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  function paint(x: number) {
    dragXRef.current = x;
    if (frameRef.current) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const card = cardRef.current;
      if (!card) return;
      const rotate = Math.max(-10, Math.min(10, dragXRef.current / 18));
      card.style.transform = `translate3d(${dragXRef.current}px, 0, 0) rotate(${rotate}deg)`;
    });
  }

  function reset() {
    paint(0);
    dragStartRef.current = null;
    window.setTimeout(() => {
      didDragRef.current = false;
    }, 90);
  }

  function release() {
    // 左右どちらへ振ってもスキップ(右で遷移させない)
    if (Math.abs(dragXRef.current) > 76) {
      reset();
      onSkip();
      return;
    }
    reset();
  }

  return (
    <article
      ref={cardRef}
      className="card promo-card"
      onPointerDown={(event) => {
        dragStartRef.current = event.clientX;
        didDragRef.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (dragStartRef.current === null) return;
        const nextDragX = Math.max(-170, Math.min(170, event.clientX - dragStartRef.current));
        if (Math.abs(nextDragX) > 8) didDragRef.current = true;
        paint(nextDragX);
      }}
      onPointerUp={release}
      onPointerCancel={reset}
    >
      <span className="promo-card-label">
        {ad.kind === "goods" ? "VTuberグッズ" : ad.kind === "house" ? "VtuberMatchより" : "PR"}
      </span>
      {ad.imageUrl ? (
        <img src={ad.imageUrl} alt={ad.kind === "house" ? ad.title : ""} loading="eager" decoding="async" />
      ) : (
        <div className="promo-card-placeholder" aria-hidden="true" />
      )}
      <div className={ad.kind === "house" ? "card-overlay card-overlay-plain" : "card-overlay"}>
        {ad.ownerName && <div className="pill-row"><UiBadge>{ad.ownerName}</UiBadge></div>}
        {ad.kind !== "house" && ad.title && <h1>{ad.title}</h1>}
        {ad.description && <p className="promo-card-description">{ad.description}</p>}
        <a
          className="promo-card-cta"
          href={ad.url}
          target="_blank"
          rel={ad.kind === "house" ? "noreferrer noopener" : "noreferrer noopener sponsored"}
          onPointerDown={(event) => {
            // カード全体のドラッグ検出に巻き込まれないようにする。
            // 巻き込まれると、指の僅かなズレ(8px超)でもドラッグ扱いになり、
            // onClickのpreventDefaultでリンク遷移がキャンセルされてしまう。
            event.stopPropagation();
          }}
        >
          <ExternalLink size={16} />
          {ad.kind === "goods" ? "グッズを見る" : ad.kind === "house" ? "詳しく見る" : "商品を見る"}
        </a>
      </div>
    </article>
  );
}

function PreviewCard({ streamer }: { streamer: Streamer }) {
  return (
    <article className="card preview-card" style={{ transform: "scale(0.96) translateY(16px)", opacity: 0.42 }}>
      <img src={streamer.thumbnails[0]} alt="" loading="lazy" decoding="async" />
    </article>
  );
}

function ArchiveEmbed({ url, name }: { url: string; name: string }) {
  const embedUrl = getYouTubeEmbedUrl(url);
  if (embedUrl) {
    return (
      <div className="archive-embed">
        <iframe
          src={embedUrl}
          title={`${name} archive`}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <a className="archive-link" href={url} target="_blank" rel="noreferrer">
      <ExternalLink size={18} />
      アーカイブを見る
    </a>
  );
}

function getYouTubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    let videoId = "";
    if (host === "youtu.be") {
      videoId = parsed.pathname.split("/").filter(Boolean)[0] || "";
    } else if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") videoId = parsed.searchParams.get("v") || "";
      if (parsed.pathname.startsWith("/shorts/")) videoId = parsed.pathname.split("/")[2] || "";
      if (parsed.pathname.startsWith("/live/")) videoId = parsed.pathname.split("/")[2] || "";
      if (parsed.pathname.startsWith("/embed/")) videoId = parsed.pathname.split("/")[2] || "";
    }
    return videoId ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}` : "";
  } catch {
    return "";
  }
}

function readViewerProfile() {
  try {
    const raw = localStorage.getItem(viewerProfileKey);
    return raw ? (JSON.parse(raw) as Partial<ViewerProfile>) : undefined;
  } catch {
    return undefined;
  }
}

function readStoredViewerVtypeId() {
  try {
    const raw = localStorage.getItem(viewerVtypeStorageKey);
    return resolveVtypeId(raw ? JSON.parse(raw) as VtypeProfileFields : undefined);
  } catch {
    return null;
  }
}

function resolveVtypeId(profile: Partial<ViewerProfile> | VtypeProfileFields | undefined) {
  const id = Number(profile?.vtype_id);
  return diagnosisTypes.some((type) => type.id === id) ? id : null;
}

function isAdminViewerProfile() {
  return getViewerIdentity().registered && readViewerProfile()?.is_admin_viewer === true;
}

async function getSwipeUserId() {
  try {
    return await ensureAnonymousUser();
  } catch {
    const key = "vtuber-match-fallback-user-id";
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = `viewer_${crypto.randomUUID()}`;
    localStorage.setItem(key, id);
    return id;
  }
}

function hash(input: string) {
  return input.split("").reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
}

function createRecommendedShareUrl() {
  const text = [
    "今日のおすすめVTuber10人、見終わりました🔟",
    "",
    "VtuberMatchで日替わりのピックアップをやってます。気になる人がいたら早めにチェック👇",
    "",
    "https://www.vtubermatch.com/recommended",
    "",
    "#vtubermatch",
  ].join("\n");
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

const swipePlanScore: Record<Streamer["plan_type"], number> = {
  boost: 3_000_000,
  paid: 2_000_000,
  free: 1_000_000,
};

function shuffleEqualPriorityGroups(streamers: Streamer[], seed: string) {
  return streamers
    .map((streamer, originalIndex) => ({
      streamer,
      originalIndex,
      score: swipePriorityScore(streamer),
      tie: seededIndex(`${seed}:${streamer.id}`, 1_000_000_000),
    }))
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      const tieDiff = a.tie - b.tie;
      if (tieDiff !== 0) return tieDiff;
      return a.originalIndex - b.originalIndex;
    })
    .map((item) => item.streamer);
}

function prioritizeSameVtype(streamers: Streamer[], viewerVtypeId: number | null) {
  if (!viewerVtypeId) return streamers;
  const sameType = streamers.filter((streamer) => streamer.vtype_id === viewerVtypeId);
  if (!sameType.length) return streamers;
  const others = streamers.filter((streamer) => streamer.vtype_id !== viewerVtypeId);
  return [...sameType, ...others];
}

// スワイプカードの既見管理(48hクールダウン): 直近48h以内に見たVTuberは
// 一旦デッキから外す。ただし除外しすぎてデッキが極端に少なくなる場合は、
// 見尽くした利用者が閲覧できなくなるのを避けるため無視して全員を対象に戻す。
function filterRecentlySeen(streamers: Streamer[], seenIds: Set<string>) {
  if (!seenIds.size) return streamers;
  const unseen = streamers.filter((streamer) => !seenIds.has(streamer.id));
  return unseen.length >= 5 ? unseen : streamers;
}

// 課金をやめた(有料プランを解約した)配信者は、通常の並び順から外して
// 後方(最後から5番目くらい)へ固定表示する。あからさまに最後尾にはしない。
function demoteChurnedStreamers(streamers: Streamer[]) {
  const demoted = streamers.filter((streamer) => streamer.subscription_status === "canceled");
  if (!demoted.length) return streamers;
  const rest = streamers.filter((streamer) => streamer.subscription_status !== "canceled");
  const insertAt = Math.max(0, rest.length - 4);
  return [...rest.slice(0, insertAt), ...demoted, ...rest.slice(insertAt)];
}

function swipePriorityScore(streamer: Streamer) {
  const superBoostScore = isActiveSuperBoost(streamer.super_boost_until) ? 5_000_000 : 0;
  return (swipePlanScore[streamer.plan_type] || 0) + superBoostScore;
}

function seededIndex(input: string, modulo: number) {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value) % modulo;
}

function createSwipeShuffleSeed() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}:${Math.random()}`;
}

function isNewStreamer(createdAt?: string) {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  if (!Number.isFinite(created) || created > now) return false;
  return now - created <= 30 * 24 * 60 * 60 * 1000;
}

function isActiveSuperBoost(value?: string) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > Date.now();
}
