"use client";

import { useEffect, useState } from "react";
import { LogOut, UserRound } from "lucide-react";

type LoginState = {
  type: "creator" | "viewer";
  name: string;
};

const viewerAuthKey = "vtuber-match-viewer-auth";
const viewerProfileKey = "vtuber-match-viewer-profile";

export function HeaderAuthStatus() {
  const [login, setLogin] = useState<LoginState | null>(null);

  useEffect(() => {
    setLogin(readLoginState());

    function refresh() {
      setLogin(readLoginState());
    }

    window.addEventListener("storage", refresh);
    window.addEventListener("vtuber-match-auth-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("vtuber-match-auth-changed", refresh);
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
      "vtuber-match-viewer-id"
    ].forEach((key) => localStorage.removeItem(key));
    setLogin(null);
    window.dispatchEvent(new Event("vtuber-match-auth-changed"));
  }

  if (!login) return null;

  return (
    <div className="header-auth-status" aria-label="ログイン状態">
      <span>
        <UserRound size={15} />
        ログイン中: {login.name}
      </span>
      <button type="button" onClick={logout}>
        <LogOut size={15} />
        ログアウト
      </button>
    </div>
  );
}

function readLoginState(): LoginState | null {
  const creatorEmail = localStorage.getItem("vtuber-match-creator-email") || "";
  if (creatorEmail) {
    return {
      type: "creator",
      name: localStorage.getItem("vtuber-match-creator-name") || creatorEmail
    };
  }

  const viewerAuth = safeParse(localStorage.getItem(viewerAuthKey));
  const viewerProfile = safeParse(localStorage.getItem(viewerProfileKey));
  const viewerName = viewerAuth?.name || viewerProfile?.display_name || viewerProfile?.youtube_display_name || viewerAuth?.email || "";
  if (viewerName) {
    return {
      type: "viewer",
      name: viewerName
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
