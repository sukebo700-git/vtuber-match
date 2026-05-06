"use client";

import { useState } from "react";

export function AdminEntryForm() {
  const [password, setPassword] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password.trim()) return;
    window.location.assign(`/admin?key=${encodeURIComponent(password.trim())}`);
  }

  return (
    <form className="admin-entry" onSubmit={submit}>
      <label htmlFor="admin_password">管理者用</label>
      <div>
        <input
          id="admin_password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="パスワード"
        />
        <button type="submit">入る</button>
      </div>
    </form>
  );
}
