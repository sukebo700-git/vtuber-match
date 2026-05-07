"use client";

import { BadgeCheck, Heart, Info, Search, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES } from "@/lib/constants";
import { ensureAnonymousUser } from "@/lib/firebase";
import type { Streamer, ViewerProfile } from "@/lib/types";

type SwipeClientProps = {
  initialStreamers: Streamer[];
};

const viewerProfileKey = "vtuber-match-viewer-profile";

export function SwipeClient({ initialStreamers }: SwipeClientProps) {
  const [index, setIndex] = useState(0);
  const [loopCount, setLoopCount] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const streamers = useMemo(
    () => (categoryFilter ? initialStreamers.filter((streamer) => streamer.categories.includes(categoryFilter)) : initialStreamers),
    [categoryFilter, initialStreamers],
  );
  const current = streamers.length ? streamers[index % streamers.length] : undefined;
  const next = streamers.length ? streamers[(index + 1) % streamers.length] : undefined;
  const isLooping = loopCount > 0;

  const visibleThumbnail = useMemo(() => {
    if (!current?.thumbnails.length) return "";
    const pick = Math.abs(hash(`${current.id}-${index}`)) % current.thumbnails.length;
    return current.thumbnails[pick];
  }, [current, index]);

  useEffect(() => {
    setIndex(0);
    setLoopCount(0);
  }, [categoryFilter]);

  useEffect(() => {
    if (!current) return;
    fetch("/api/impressions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ streamer_id: current.id }),
    }).catch(() => undefined);
  }, [current]);

  async function swipe(direction: "left" | "right") {
    if (!current || !streamers.length) return;

    if (direction === "right") {
      const userId = await getSwipeUserId();
      const viewerProfile = readViewerProfile();
      await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          streamer_id: current.id,
          viewer_profile_id: viewerProfile?.id,
          viewer_profile: viewerProfile?.visible_to_matched_streamers ? viewerProfile : { id: viewerProfile?.id },
        }),
      });
      window.location.href = current.youtube_url;
    }

    setIndex((value) => {
      const nextIndex = value + 1;
      if (nextIndex > 0 && nextIndex % streamers.length === 0) setLoopCount((loop) => loop + 1);
      return nextIndex;
    });
  }

  if (!initialStreamers.length) {
    return (
      <div className="status-band">
        <h2>掲載中の配信者がまだいません</h2>
        <p>配信者の掲載後、ここにスワイプカードが表示されます。</p>
      </div>
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
        </div>

        {!current ? (
          <div className="status-band">
            <h2>該当する配信者がいません</h2>
            <p>カテゴリを変更するか、検索を解除してください。</p>
          </div>
        ) : (
          <>
            <div className="deck" aria-live="polite">
              {next && <PreviewCard streamer={next} />}
              <SwipeCard key={`${current.id}-${index}`} streamer={current} thumbnail={visibleThumbnail} onSwipe={swipe} />
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
              <button className="icon-button like action-like" aria-label="いいね" onClick={() => swipe("right")}>
                <Heart size={28} fill="currentColor" />
                <span>いいね!</span>
              </button>
            </div>
          </>
        )}
      </div>

      <aside className="side-panel">
        {current && current.plan_type !== "free" && (
          <div className="status-band today-note">
            <h2>
              <Sparkles size={19} /> 今日のひとこと
            </h2>
            <p>{current.one_liner}</p>
          </div>
        )}
        <div className="status-band next-find-panel">
          <h2>{isLooping ? "再表示中" : "次の推しを見つける"}</h2>
          <p>右でいいね、左でスキップ。中央ボタンでプロフィールを確認できます。</p>
        </div>
      </aside>
    </section>
  );
}

function SwipeCard({ streamer, thumbnail, onSwipe }: { streamer: Streamer; thumbnail: string; onSwipe: (direction: "left" | "right") => void }) {
  const cardRef = useRef<HTMLElement | null>(null);
  const dragStartRef = useRef<number | null>(null);
  const dragXRef = useRef(0);
  const didDragRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const isPaidOrPremium = streamer.plan_type === "paid" || streamer.plan_type === "boost";

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
      return;
    }
    if (dragX < -76) {
      onSwipe("left");
      return;
    }
    resetCard();
  }

  return (
    <article
      ref={cardRef}
      className={`card plan-${streamer.plan_type}`}
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
      {isPaidOrPremium && (
        <div className="floating-badge">
          {streamer.plan_type === "boost" ? "PREMIUM" : "公式"}
          <br />
          {streamer.plan_type === "boost" ? "推し枠" : "バッジ"}
        </div>
      )}
      <div className="floating-like">
        ♥
        <br />
        いいね!
      </div>
      <img src={thumbnail} alt={`${streamer.name} 掲載画像`} loading="eager" decoding="async" />
      <div className="card-overlay">
        {isPaidOrPremium && (
          <div className="pill-row">
            <span className="official-badge">
              <BadgeCheck size={15} />
              公式
            </span>
            {streamer.categories.slice(0, 1).map((category) => (
              <span className="pill" key={category}>{category}</span>
            ))}
            {streamer.tags.slice(0, 3).map((tag) => (
              <span className="pill" key={tag}>#{tag}</span>
            ))}
            <span className="pill">マッチ{streamer.likes ?? 0}</span>
          </div>
        )}
        <h1>{streamer.name}</h1>
        {isPaidOrPremium && streamer.one_liner && <p>{streamer.one_liner}</p>}
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

function readViewerProfile() {
  try {
    const raw = localStorage.getItem(viewerProfileKey);
    return raw ? (JSON.parse(raw) as Partial<ViewerProfile>) : undefined;
  } catch {
    return undefined;
  }
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
