"use client";

import { Bell } from "lucide-react";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { useEffect, useMemo, useState } from "react";
import { getClientFirebase, hasClientFirebaseConfig } from "@/lib/firebase";

type PushNotificationButtonProps = {
  targetType: "creator" | "viewer";
};

const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

export function PushNotificationButton({ targetType }: PushNotificationButtonProps) {
  const [status, setStatus] = useState("");
  const [enabled, setEnabled] = useState(false);

  const label = useMemo(() => {
    if (enabled) return "通知ON";
    return targetType === "creator" ? "いいね通知を受け取る" : "配信者からの通知を受け取る";
  }, [enabled, targetType]);

  useEffect(() => {
    if (typeof window === "undefined" || Notification.permission !== "granted") return;
    setEnabled(localStorage.getItem(tokenStorageKey(targetType)) === "saved");
  }, [targetType]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function listenForegroundMessages() {
      if (!hasClientFirebaseConfig || !(await isSupported().catch(() => false))) return;
      const firebase = getClientFirebase();
      if (!firebase) return;

      const messaging = getMessaging(firebase.app);
      unsubscribe = onMessage(messaging, (payload) => {
        const title = payload.notification?.title || "VtuberMatch";
        const body = payload.notification?.body || "新しい通知があります";
        setStatus(`${title}: ${body}`);
        if (Notification.permission === "granted") {
          navigator.serviceWorker.ready
            .then((registration) => registration.showNotification(title, {
              body,
              icon: "/icon.svg",
              badge: "/icon.svg",
              data: { url: payload.data?.url || "/" },
            }))
            .catch(() => undefined);
        }
      });
    }

    listenForegroundMessages();
    return () => unsubscribe?.();
  }, []);

  async function enablePush() {
    if (!hasClientFirebaseConfig) {
      setStatus("Firebase設定が未設定です。");
      return;
    }
    if (!vapidKey) {
      setStatus("通知用のVAPIDキーが未設定です。");
      return;
    }
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("このブラウザは通知に対応していません。");
      return;
    }

    const target = readNotificationTarget(targetType);
    if (!target.userId) {
      setStatus(targetType === "creator" ? "配信者ログイン後に利用できます。" : "視聴者ログイン後に利用できます。");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus("通知が許可されませんでした。");
      return;
    }

    const supported = await isSupported().catch(() => false);
    if (!supported) {
      setStatus("このブラウザではFirebase通知を利用できません。");
      return;
    }

    setStatus("通知を設定中...");
    const firebase = getClientFirebase();
    if (!firebase) {
      setStatus("Firebase設定を確認してください。");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(firebase.app), {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      setStatus("通知トークンを取得できませんでした。");
      return;
    }

    const response = await fetch("/api/users/fcm-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: target.userId,
        target_type: targetType,
        streamer_id: target.streamerId,
        viewer_profile_id: target.viewerProfileId,
        fcm_token: token,
      }),
    });

    if (!response.ok) {
      setStatus("通知設定の保存に失敗しました。");
      return;
    }

    localStorage.setItem(tokenStorageKey(targetType), "saved");
    setEnabled(true);
    setStatus("通知を受け取れるようにしました。");
  }

  return (
    <section className="status-band push-notice-card">
      <div>
        <h2>プッシュ通知</h2>
        <p>{targetType === "creator" ? "視聴者からのいいねを通知します。" : "配信者からのいいねを通知します。"}</p>
      </div>
      <button className={enabled ? "secondary-button" : "primary-button"} type="button" onClick={enablePush}>
        <Bell size={18} />
        {label}
      </button>
      {status && <p className="help-text">{status}</p>}
    </section>
  );
}

function readNotificationTarget(targetType: "creator" | "viewer") {
  if (targetType === "creator") {
    const streamerId = localStorage.getItem("vtuber-match-creator-streamer-id") || "";
    const userId =
      streamerId ||
      localStorage.getItem("vtuber-match-creator-login-id") ||
      localStorage.getItem("vtuber-match-creator-email") ||
      "";

    return { userId, streamerId, viewerProfileId: "" };
  }

  const viewerProfile = safeParse<{ id?: string }>(localStorage.getItem("vtuber-match-viewer-profile"));
  const viewerProfileId = localStorage.getItem("vtuber-match-viewer-id") || viewerProfile?.id || "";
  const userId =
    viewerProfileId ||
    localStorage.getItem("vtuber-match-viewer-email") ||
    "";

  return { userId, streamerId: "", viewerProfileId };
}

function tokenStorageKey(targetType: "creator" | "viewer") {
  return `vtuber-match-${targetType}-push-token-saved`;
}

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
