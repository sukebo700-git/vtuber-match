"use client";

// ログインページの「すでにログイン中です」画面(localStorageのフラグのみで判定)は、
// 実際にはセッション切れでサーバー側の認証が無効になっている場合でも表示され、
// ログインし直す手段がなく行き止まりになる。フラグを手動でクリアして再表示できる
// 脱出口を提供する。
export function ReloginEscapeHatch({ prefix }: { prefix: string }) {
  function handleClick() {
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith(prefix))
        .forEach((key) => localStorage.removeItem(key));
    } catch {
      // localStorage can be unavailable in private contexts.
    }
    window.location.reload();
  }

  return (
    <button type="button" className="secondary-button" onClick={handleClick}>
      ログインし直す(表示がおかしい場合はこちら)
    </button>
  );
}
