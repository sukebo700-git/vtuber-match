"use client";

import { useState } from "react";

const authKey = "vtuber-match-viewer-auth";
const idKey = "vtuber-match-viewer-id";

export function ViewerLoginForm() {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = localStorage.getItem(idKey) || crypto.randomUUID();
    localStorage.setItem(idKey, id);
    localStorage.setItem(authKey, JSON.stringify({ id, name, loggedInAt: new Date().toISOString() }));
    setStatus("ログインしました。視聴者プロフィールへ移動します。");
    window.location.assign("/viewer");
  }

  return (
    <form className="form compact-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="viewer_name">表示名</label>
        <input id="viewer_name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={40} />
      </div>
      <p className="help-text">スワイプはログインなしでも利用できます。プロフィール登録とファンアピールにはログインが必要です。</p>
      <button className="primary-button" type="submit">視聴者としてログイン</button>
      {status && <p className="help-text">{status}</p>}
    </form>
  );
}
