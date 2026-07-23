"use client";

import { LogOut, Menu, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type HeaderLoginState = {
  id?: string;
  type: "creator" | "viewer";
  name?: string;
  email?: string;
};

type ViewerProfileLike = HeaderLoginState & {
  display_name?: string;
  youtube_display_name?: string;
};

const CREATOR_KEYS = [
  "vtuber-match-creator-id",
  "vtuber-match-creator-login-id",
  "vtuber-match-creator-email",
  "vtuber-match-creator-name",
  "vtuber-match-creator-auth",
  "vtuber-match-creator-application-id",
  "vtuber-match-creator-streamer-id",
  "vtuber-match-creator-plan",
];

const VIEWER_KEYS = [
  "vtuber-match-viewer-id",
  "vtuber-match-viewer-email",
  "vtuber-match-viewer-name",
  "vtuber-match-viewer-auth",
  "vtuber-match-viewer-profile",
];

const GLOBAL_MENU_ITEMS = [
  { href: "/swipe", label: "スワイプ" },
  { href: "/viewer", label: "視聴者用" },
  { href: "/creator", label: "配信者用" },
  { href: "/diagnosis", label: "タイプ診断" },
  { href: "https://www.youtube.com/@VtuberMatch", label: "公式YouTube", external: true },
  { href: "/help", label: "ヘルプ" },
];

function readJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function readLoginState(): HeaderLoginState | null {
  if (typeof window === "undefined") return null;

  const creatorAuth = readJson<HeaderLoginState>(localStorage.getItem("vtuber-match-creator-auth"));
  const creatorId =
    localStorage.getItem("vtuber-match-creator-id") ||
    localStorage.getItem("vtuber-match-creator-login-id") ||
    creatorAuth?.id;
  const creatorEmail = localStorage.getItem("vtuber-match-creator-email") || creatorAuth?.email;
  const creatorName = localStorage.getItem("vtuber-match-creator-name") || creatorAuth?.name;

  if (creatorId || creatorEmail || creatorName) {
    return {
      id: creatorId || undefined,
      type: "creator",
      name: creatorName || undefined,
      email: creatorEmail || undefined,
    };
  }

  const viewerAuth = readJson<HeaderLoginState>(localStorage.getItem("vtuber-match-viewer-auth"));
  const viewerProfile = readJson<ViewerProfileLike>(localStorage.getItem("vtuber-match-viewer-profile"));
  const viewerId = localStorage.getItem("vtuber-match-viewer-id") || viewerAuth?.id || viewerProfile?.id;
  const viewerEmail = localStorage.getItem("vtuber-match-viewer-email") || viewerAuth?.email || viewerProfile?.email;
  const viewerName =
    localStorage.getItem("vtuber-match-viewer-name") ||
    viewerAuth?.name ||
    viewerProfile?.name ||
    viewerProfile?.display_name ||
    viewerProfile?.youtube_display_name;

  if (viewerId || viewerEmail || viewerName) {
    return {
      id: viewerId || undefined,
      type: "viewer",
      name: viewerName || undefined,
      email: viewerEmail || undefined,
    };
  }

  return null;
}

export function HeaderAuthStatus() {
  const [login, setLogin] = useState<HeaderLoginState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    const refresh = () => setLogin(readLoginState());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("vtuber-match-auth-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("vtuber-match-auth-changed", refresh);
    };
  }, []);

  const displayName = useMemo(() => {
    if (!login) return "未ログイン";
    return login.name || login.email || login.id || "ログイン中";
  }, [login]);

  const statusLabel = login ? (login.type === "creator" ? "配信者" : "視聴者") : "未ログイン";

  const menuItems = useMemo(() => {
    if (login?.type === "creator") {
      return [
        { href: "/creator/edit", label: "プロフィール" },
        { href: "/creator/upgrade", label: "アップグレード" },
      ];
    }

    if (login?.type === "viewer") {
      return [
        { href: "/viewer", label: "視聴者用ページ" },
        { href: "/viewer", label: "プロフィール" },
      ];
    }

    return [];
  }, [login]);

  const logout = () => {
    [...CREATOR_KEYS, ...VIEWER_KEYS].forEach((key) => localStorage.removeItem(key));
    fetch("/api/logout", { method: "POST", keepalive: true }).catch(() => undefined);
    setLogin(null);
    setMenuOpen(false);
    setLoginOpen(false);
    window.dispatchEvent(new Event("vtuber-match-auth-changed"));
    window.location.assign("/");
  };

  return (
    <div className="header-auth-block" aria-label="ログイン状態とメニュー">
      <span className="header-user-name" title={displayName}>
        <UserRound size={15} aria-hidden />
        {statusLabel}
      </span>

      {login ? (
        <>
          <span className="header-auth-action header-display-name" title={displayName}>
            {displayName}
          </span>
          <button className="header-auth-action" type="button" onClick={logout}>
            <LogOut size={15} aria-hidden />
            ログアウト
          </button>
        </>
      ) : (
        <>
          <div className="header-menu-wrap">
            <button
              className="header-auth-action"
              type="button"
              aria-expanded={loginOpen}
              aria-haspopup="menu"
              onClick={() => setLoginOpen((current) => !current)}
            >
              ログイン
            </button>
            {loginOpen ? (
              <div className="header-menu-panel compact-menu" role="menu">
                <a href="/creator/login" role="menuitem">配信者ログイン</a>
                <a href="/viewer/login" role="menuitem">視聴者ログイン</a>
              </div>
            ) : null}
          </div>
          <a className="header-auth-action signup-action" href="/signup">
            新規登録
          </a>
        </>
      )}

      <div className="header-menu-wrap">
        <button
          className="header-menu-button"
          type="button"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((current) => !current)}
        >
          <Menu size={17} aria-hidden />
          メニュー
        </button>

        {menuOpen ? (
          <div className="header-menu-panel" role="menu">
            {GLOBAL_MENU_ITEMS.map((item) => (
              <a
                key={`${item.href}-${item.label}`}
                href={item.href}
                role="menuitem"
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noreferrer" : undefined}
              >
                {item.label}
              </a>
            ))}
            {menuItems.length ? (
              menuItems.map((item, index) => (
                <a key={`${item.href}-${item.label}`} className={index === 0 ? "menu-section-start" : undefined} href={item.href} role="menuitem">
                  {item.label}
                </a>
              ))
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
