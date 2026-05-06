"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { BadgeCheck, ExternalLink, Heart, Info, Search, Sparkles, X } from "lucide-react";
import { CATEGORIES } from "@/lib/constants";
import type { Streamer, ViewerProfile } from "@/lib/types";
import { ensureAnonymousUser } from "@/lib/firebase";

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
    [categoryFilter, initialStreamers]
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
      body: JSON.stringify({ streamer_id: current.id })
    }).catch(() => undefined);
  }, [current]);

  async function swipe(direction: "left" | "right") {
    if (!current || !streamers.length) return;

    if (direction === "right") {
      const userId = await ensureAnonymousUser();
      const viewerProfile = readViewerProfile();
      await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          user_id: userId,
          streamer_id: current.id,
          viewer_profile: viewerProfile?.visible_to_matched_streamers ? viewerProfile : undefined
        })
      });
      window.location.assign(current.youtube_url);
    }

    setIndex((value) => {
      const nextIndex = value + 1;
      if (nextIndex > 0 && nextIndex % streamers.length === 0) {
        setLoopCount((loop) => loop + 1);
      }
      return nextIndex;
    });
  }

  if (!initialStreamers.length) {
    return (
      <div className="status-band">
        <h2>掲載中の配信者がまだいません</h2>
        <p>配信者用ページから掲載を申し込むか、管理画面で申込を承認してください。</p>
      </div>
    );
  }

  return (
    <section className="swipe-stage">
      <div>
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
            <p>カテゴリを変えるか、検索を解除してもう一度探してください。</p>
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
        <div className="status-band">
          <h2>{isLooping ? "再表示中" : "次の推しを見つける"}</h2>
          <p>気になる配信者を右へ。スキップは左へ。カードをタップするとプロフィールを確認できます。</p>
        </div>
        <a className="secondary-button" href="/viewer">視聴者プロフィールを設定</a>
        {current && (
          <>
            <a className="primary-button" href={`/detail/${current.id}`}>
              <ExternalLink size={18} />
              プロフィールを見る
            </a>
            <div className="status-band">
              <h2>
                <Sparkles size={19} /> 今日の一言
              </h2>
              <p>{current.one_liner}</p>
            </div>
          </>
        )}
      </aside>
    </section>
  );
}

function SwipeCard({ streamer, thumbnail, onSwipe }: { streamer: Streamer; thumbnail: string; onSwipe: (direction: "left" | "right") => void }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-180, 180], [-12, 12]);
  const hasOfficialBadge = streamer.plan_type === "paid" || streamer.plan_type === "boost";

  return (
    <motion.article
      className="card"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 110) onSwipe("right");
        if (info.offset.x < -110) onSwipe("left");
      }}
      onTap={() => window.location.assign(`/detail/${streamer.id}`)}
      whileTap={{ scale: 0.98 }}
    >
      {hasOfficialBadge && (
        <div className="floating-badge">
          公式
          <br />
          バッジ
        </div>
      )}
      <div className="floating-like">
        ♥
        <br />
        いいね!
      </div>
      <img src={thumbnail} alt={`${streamer.name} 掲載画像`} loading="eager" />
      <div className="card-overlay">
        <div className="pill-row">
          {hasOfficialBadge && (
            <span className="official-badge">
              <BadgeCheck size={15} />
              公式
            </span>
          )}
          <span className="pill">{streamer.categories[0] || "配信"}</span>
          {streamer.tags.slice(0, 3).map((tag) => (
            <span className="pill" key={tag}>
              #{tag}
            </span>
          ))}
        </div>
        <h1>{streamer.name}</h1>
        <p>{streamer.one_liner}</p>
      </div>
    </motion.article>
  );
}

function PreviewCard({ streamer }: { streamer: Streamer }) {
  return (
    <article className="card" style={{ transform: "scale(0.96) translateY(16px)", opacity: 0.42 }}>
      <img src={streamer.thumbnails[0]} alt="" loading="eager" />
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

function hash(input: string) {
  return input.split("").reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
}
