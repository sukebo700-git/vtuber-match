"use client";

import { useEffect, useState } from "react";
import { LogOut, UserRound } from "lucide-react";

type LoginState = {
  type: "creator" | "viewer";
  name: string;
  email?: string;
};

const viewerAuthKey = "vtuber-match-viewer-auth";
const viewerProfileKey = "vtuber-match-viewer-profile";

export function HeaderAuthStatus() {
  const [login, setLogin] = useState<LoginState | null>(null);

  useEffect(() => {
    function refresh() {
      const nextLogin = readLoginState();
      setLogin(nextLogin);
      document.body.classList.toggle("creator-auth", nextLogin?.type === "creator");
      document.body.classList.toggle("viewer-auth", nextLogin?.type === "viewer");
    }

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("vtuber-match-auth-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("vtuber-match-auth-changed", refresh);
      document.body.classList.remove("creator-auth", "viewer-auth");
    };
  }, []);

  function logout() {
    [
      "vtuber-match-creator-login-id",
      "vtuber-match-creator-email",
      "vtuber-match-creator-name",
      "vtuber-match-creator-application-id",
      "vtuber-match-creator-streamer-id",
      "vtuber-match-creator-plan",
      "vtuber-match-viewer-auth",
      "vtuber-match-viewer-id",
      "vtuber-match-viewer-profile"
    ].forEach((key) => localStorage.removeItem(key));
    setLogin(null);
    document.body.classList.remove("creator-auth", "viewer-auth");
    window.dispatchEvent(new Event("vtuber-match-auth-changed"));
  }

  const label = login ? login.name || login.email || "ログイン中" : "未ログイン";

  return (
    <div className="header-auth-block" aria-label="ログイン状態">
      <nav className="global-nav" aria-label="メイン">
        <a href="/">スワイプ</a>
        <a href="/creator">配信者用</a>
        <a href="/viewer">視聴者用</a>
      </nav>
      <div className="header-auth-row">
        <span className="header-user-name">
          <UserRound size={15} />
          {label}
        </span>
        {login ? (
          <button className="header-auth-action" type="button" onClick={logout}>
            <LogOut size={15} />
            ログアウト
          </button>
        ) : (
          <a className="header-auth-action" href="/viewer/login">ログイン</a>
        )}
        <span className="header-login-links">
          ログインページ: <a href="/viewer/login">視聴者</a> / <a href="/creator/login">配信者</a>
        </span>
      </div>
    </div>
  );
}

function readLoginState(): LoginState | null {
  const creatorEmail = localStorage.getItem("vtuber-match-creator-email") || "";
  if (creatorEmail) {
    return {
      type: "creator",
      name: localStorage.getItem("vtuber-match-creator-name") || creatorEmail,
      email: creatorEmail
    };
  }

  const viewerAuth = safeParse(localStorage.getItem(viewerAuthKey));
  const viewerProfile = safeParse(localStorage.getItem(viewerProfileKey));
  const viewerName = viewerAuth?.name || viewerProfile?.display_name || viewerProfile?.youtube_display_name || viewerAuth?.email || "";
  if (viewerName) {
    return {
      type: "viewer",
      name: viewerName,
      email: viewerAuth?.email || viewerProfile?.email
    };
  }

  return null;
}

function safeParse(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, string>;
  } catch {
    return null;
  }
}
