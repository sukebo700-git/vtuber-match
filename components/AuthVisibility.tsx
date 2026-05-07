"use client";

import { useEffect, useState } from "react";

type Role = "creator" | "viewer";
type Mode = "logged-in" | "logged-out";

type AuthVisibilityProps = {
  role: Role;
  mode: Mode;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export function AuthVisibility({ role, mode, children, fallback = null }: AuthVisibilityProps) {
  const [checked, setChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    function refresh() {
      setLoggedIn(isLoggedIn(role));
      setChecked(true);
    }

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("vtuber-match-auth-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("vtuber-match-auth-changed", refresh);
    };
  }, [role]);

  if (!checked) return null;
  const shouldShow = mode === "logged-in" ? loggedIn : !loggedIn;
  return shouldShow ? <>{children}</> : <>{fallback}</>;
}

function isLoggedIn(role: Role) {
  if (role === "creator") return Boolean(localStorage.getItem("vtuber-match-creator-email"));
  return Boolean(localStorage.getItem("vtuber-match-viewer-auth"));
}
