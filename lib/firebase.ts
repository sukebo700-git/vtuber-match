import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export const hasClientFirebaseConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export function getClientFirebase() {
  if (!hasClientFirebaseConfig) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app)
  };
}

export async function ensureAnonymousUser() {
  const firebase = getClientFirebase();
  if (!firebase) {
    let id = window.localStorage.getItem("swipecast_guest_id");
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem("swipecast_guest_id", id);
    }
    return id;
  }

  if (firebase.auth.currentUser) return firebase.auth.currentUser.uid;
  const result = await signInAnonymously(firebase.auth);
  return result.user.uid;
}
