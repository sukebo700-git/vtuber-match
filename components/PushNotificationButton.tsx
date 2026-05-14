"use client";

import { Bell } from "lucide-react";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { useEffect, useMemo, useState } from "react";
import { getClientFirebase, hasClientFirebaseConfig } from "@/lib/firebase";

type NotificationTargetType = "admin" | "creator" | "viewer";

type PushNotificationButtonProps = {
  targetType: NotificationTargetType;
};

const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

export function PushNotificationButton({ targetType }: PushNotificationButtonProps) {
  const [status, setStatus] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  const label = useMemo(() => {
    if (enabled) return "通知ON";
    if (targetType === "admin") return "新規登録通知を受け取る";
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
    if (busy) return;
    setBusy(true);
    if (!hasClientFirebaseConfig) {
      setStatus("Firebase設定が未設定です。");
      setBusy(false);
      return;
    }
    if (!vapidKey) {
      setStatus("通知用のVAPIDキーが未設定です。");
      setBusy(false);
      return;
    }
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("このブラウザは通知に対応していません。");
      setBusy(false);
      return;
    }

    const target = readNotificationTarget(targetType);
    if (!target.userId) {
      setStatus(targetType === "admin" ? "管理画面で利用できます。" : targetType === "creator" ? "配信者ログイン後に利用できます。" : "視聴者ログイン後に利用できます。");
      setBusy(false);
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus("通知が許可されませんでした。");
      setBusy(false);
      return;
    }

    const supported = await isSupported().catch(() => false);
    if (!supported) {
      setStatus("このブラウザではFirebase通知を利用できません。");
      setBusy(false);
      return;
    }

    setStatus("通知を設定中...");
    const firebase = getClientFirebase();
    if (!firebase) {
      setStatus("Firebase設定を確認してください。");
      setBusy(false);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const token = await getToken(getMessaging(firebase.app), {
        vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (!token) {
        setStatus("通知トークンを取得できませんでした。");
        setBusy(false);
        return;
      }

      const response = await fetch("/api/users/fcm-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: target.userId,
          target_type: targetType,
          streamer_id: target.streamerId,
          application_id: target.applicationId,
          viewer_profile_id: target.viewerProfileId,
          fcm_token: token,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setStatus(data.error || "通知設定の保存に失敗しました。");
        setBusy(false);
        return;
      }

      localStorage.setItem(tokenStorageKey(targetType), "saved");
      setEnabled(true);
      setStatus("通知を受け取れるようにしました。");
    } catch {
      setStatus("通知設定に失敗しました。ブラウザの通知許可を確認してください。");
    } finally {
      setBusy(false);
    }
  }

  async function sendTestNotification() {
    if (testing) return;
    setTesting(true);
    setStatus("テスト通知を送信中...");
    const target = readNotificationTarget(targetType);
    const response = await fetch("/api/users/fcm-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: target.userId,
        target_type: targetType,
        streamer_id: target.streamerId,
        application_id: target.applicationId,
        viewer_profile_id: target.viewerProfileId,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setTesting(false);
    setStatus(response.ok ? "テスト通知を送信しました。" : data.error || "テスト通知を送信できませんでした。");
  }

  return (
    <section className="status-band push-notice-card">
      <div>
        <h2>プッシュ通知</h2>
        <p>{targetType === "admin" ? "新規配信者登録を管理者だけに通知します。" : targetType === "creator" ? "視聴者からのいいねを通知します。" : "配信者からのいいねを通知します。"}</p>
      </div>
      <div className="inline-actions">
        <button className={enabled ? "secondary-button" : "primary-button"} type="button" onClick={enablePush} disabled={busy}>
          <Bell size={18} />
          {busy ? "設定中..." : label}
        </button>
        {enabled && (
          <button className="secondary-button" type="button" onClick={sendTestNotification} disabled={testing}>
            {testing ? "送信中..." : "テスト通知"}
          </button>
        )}
      </div>
      {status && <p className="help-text">{status}</p>}
    </section>
  );
}

function readNotificationTarget(targetType: NotificationTargetType) {
  if (targetType === "admin") {
    return { userId: "admin", streamerId: "", applicationId: "", viewerProfileId: "" };
  }

  if (targetType === "creator") {
    const streamerId = localStorage.getItem("vtuber-match-creator-streamer-id") || "";
    const applicationId = localStorage.getItem("vtuber-match-creator-application-id") || "";
    const userId =
      streamerId ||
      applicationId ||
      localStorage.getItem("vtuber-match-creator-login-id") ||
      localStorage.getItem("vtuber-match-creator-email") ||
      "";

    return { userId, streamerId, applicationId, viewerProfileId: "" };
  }

  const viewerProfile = safeParse<{ id?: string }>(localStorage.getItem("vtuber-match-viewer-profile"));
  const viewerProfileId = localStorage.getItem("vtuber-match-viewer-id") || viewerProfile?.id || "";
  const userId =
    viewerProfileId ||
    localStorage.getItem("vtuber-match-viewer-email") ||
    "";

  return { userId, streamerId: "", applicationId: "", viewerProfileId };
}

function tokenStorageKey(targetType: NotificationTargetType) {
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
