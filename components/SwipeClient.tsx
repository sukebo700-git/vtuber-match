"use client";

import { BadgeCheck, ChevronDown, ExternalLink, Heart, Info, Search, Sparkles, Star, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, REGIONS, virtualRegionLabel } from "@/lib/constants";
import { diagnosisTypes } from "@/lib/diagnosis";
import { viewerVtypeStorageKey, type VtypeProfileFields } from "@/lib/diagnosisProfile";
import { ensureAnonymousUser } from "@/lib/firebase";
import { anonymousViewerProfile, getViewerIdentity } from "@/lib/viewerIdentity";
import { videoSiteLabel, youtubeSubscribeUrl } from "@/lib/youtube";
import type { Streamer, ViewerProfile } from "@/lib/types";
import { UiBadge } from "@/components/ui/UiBadge";
import { UiButton } from "@/components/ui/UiButton";
import { UiPanel } from "@/components/ui/UiPanel";

type SwipeClientProps = {
  initialStreamers: Streamer[];
};

const viewerProfileKey = "vtuber-match-viewer-profile";
const analyticsVisitorKey = "vtuber-match-analytics-visitor-id";
const guestSwipeCountKey = "vtuber-match-guest-swipe-count-v2";
const guestSwipeDateKey = "vtuber-match-guest-swipe-date-v2";
const guestSwipeLimit = 40;
const impressionSessionPrefix = "vtuber-match-impression-session-";
const pendingImpressionKey = "vtuber-match-pending-impressions";
const pendingImpressionFlushTimerKey = "vtuber-match-pending-impressions-flush-timer";
const pendingSwipeActionKey = "vtuber-match-pending-swipe-actions";
const pendingSwipeActionLastSentKey = "vtuber-match-pending-swipe-actions-last-sent";

export function SwipeClient({ initialStreamers }: SwipeClientProps) {
  const [index, setIndex] = useState(0);
  const [loopCount, setLoopCount] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [shuffleSeed, setShuffleSeed] = useState("initial");
  const [filterOpen, setFilterOpen] = useState(false);
  const [regionFilterOpen, setRegionFilterOpen] = useState(false);
  const [likedStreamer, setLikedStreamer] = useState<Streamer | null>(null);
  const [superBoostStreamer, setSuperBoostStreamer] = useState<Streamer | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [swipeNotice, setSwipeNotice] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [adminViewerMode, setAdminViewerMode] = useState(false);
  const [viewerVtypeId, setViewerVtypeId] = useState<number | null>(null);

  const streamers = useMemo(
    () => prioritizeSameVtype(
      shuffleEqualPriorityGroups(
        (categoryFilter || regionFilter)
          ? initialStreamers.filter((streamer) => (
              (!categoryFilter || streamer.categories.includes(categoryFilter)) &&
              (!regionFilter || streamer.region === regionFilter)
            ))
          : initialStreamers,
        shuffleSeed,
      ),
      viewerVtypeId,
    ),
    [categoryFilter, regionFilter, initialStreamers, shuffleSeed, viewerVtypeId],
  );
  const current = streamers.length ? streamers[index % streamers.length] : undefined;
  const next = streamers.length ? streamers[(index + 1) % streamers.length] : undefined;
  const isLooping = loopCount > 0;
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
    setLoopCount(0);
    setLikedStreamer(null);
    setSwipeNotice("");
    setMoreOpen(false);
  }, [categoryFilter, regionFilter, shuffleSeed]);

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
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const flush = () => {
      flushImpressions();
      flushSwipeActions();
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

  async function swipe(direction: "left" | "right") {
    if (!current || !streamers.length || likedStreamer) return;
    if (!canGuestSwipe()) {
      setLimitReached(true);
      return;
    }
    trackSwipeAnalytics();
    trackSwipeAction();
    incrementGuestSwipeCount();

    if (direction === "right") {
      const liked = current;
      const userId = await getSwipeUserId();
      const identity = getViewerIdentity();
      const creatorProfile = readCreatorSwipeProfile();
      if (creatorProfile?.creator_streamer_id === liked.id) {
        setSwipeNotice("自分の配信者プロフィールにはいいねできません。");
        return;
      }
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
        body: JSON.stringify({
          user_id: likeUserId,
          streamer_id: liked.id,
          viewer_profile_id: likeProfileId,
          viewer_profile: publicViewerProfile,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setSwipeNotice(data.error || "いいねを送信できませんでした。");
        return;
      }
      setLikedStreamer(liked);
      return;
    }

    advance();
  }

  function advance() {
    setIndex((value) => {
      const nextIndex = value + 1;
      if (nextIndex > 0 && streamers.length && nextIndex % streamers.length === 0) setLoopCount((loop) => loop + 1);
      return nextIndex;
    });
  }

  function continueSwiping() {
    setLikedStreamer(null);
    advance();
  }

  function openStreamingSite() {
    if (!likedStreamer) return;
    window.location.href = youtubeSubscribeUrl(likedStreamer.youtube_url);
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
    <section className="swipe-stage">
      <div className="swipe-main">
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

        {!current ? (
          <div className="status-band">
            <h2>該当する配信者がいません</h2>
            <p>カテゴリや活動地域を変更するか、検索を解除してください。</p>
          </div>
        ) : (
          <>
            <div className="deck" aria-live="polite">
              {next && <PreviewCard streamer={next} />}
              <SwipeCard
                key={`${current.id}-${index}`}
                streamer={current}
                thumbnail={visibleThumbnail}
                onSwipe={swipe}
              />
            </div>
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
          </>
        )}
      </div>

      <aside className="side-panel">
        <button className="more-toggle" type="button" onClick={() => setMoreOpen((value) => !value)} aria-expanded={moreOpen}>
          <ChevronDown size={18} />
          さらに見る
        </button>
        <div className={`swipe-more-panel ${moreOpen ? "is-open" : ""}`}>
          {current && (current.one_liner || (current.plan_type === "boost" && current.archive_url)) && (
            <div className="status-band today-note">
              <h2>
                <Sparkles size={19} /> 今日のひとこと
              </h2>
              {current.one_liner && <p>{current.one_liner}</p>}
              {current.plan_type === "boost" && current.archive_url && <ArchiveEmbed url={current.archive_url} name={current.name} />}
            </div>
          )}
          <div className="status-band next-find-panel">
            <h2>{isLooping ? "再表示中" : "次の推しを見つける"}</h2>
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

      {likedStreamer && (
        <div className="like-choice-backdrop" role="dialog" aria-modal="true" aria-labelledby="like-choice-title">
          <div className="like-choice-modal">
            <div className="like-choice-icon">
              <Heart size={28} fill="currentColor" />
            </div>
            <h2 id="like-choice-title">いいねしました</h2>
            <p>{likedStreamer.name}さんの{videoSiteLabel(likedStreamer.youtube_url)}へ移動するか、このままスワイプを続けられます。</p>
            <div className="like-choice-actions">
              <button className="secondary-button" type="button" onClick={continueSwiping}>
                スワイプを続ける
              </button>
              <button className="primary-button" type="button" onClick={openStreamingSite}>
                <ExternalLink size={18} />
                {videoSiteLabel(likedStreamer.youtube_url)}を開く
              </button>
            </div>
          </div>
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
