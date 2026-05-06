"use client";

import { useEffect, useState } from "react";

export function CreatorUpgradeForm() {
  const [applicationId, setApplicationId] = useState("");
  const [streamerId, setStreamerId] = useState("");

  useEffect(() => {
    setApplicationId(localStorage.getItem("vtuber-match-creator-application-id") || "");
    setStreamerId(localStorage.getItem("vtuber-match-creator-streamer-id") || "");
  }, []);

  return (
    <form className="form checkout-form" action="/checkout">
      <div className="field">
        <label htmlFor="application_id_display">申込ID</label>
        <input id="application_id_display" value={applicationId} onChange={(event) => setApplicationId(event.target.value)} placeholder="申し込み後に固定されます" />
        <p className="help-text">確認用です。決済には掲載IDを使います。</p>
      </div>
      <div className="field">
        <label htmlFor="streamer_id">掲載ID</label>
        <input
          id="streamer_id"
          name="streamer_id"
          required
          value={streamerId}
          onChange={(event) => setStreamerId(event.target.value)}
          placeholder="申し込み後に自動入力されます"
        />
      </div>
      <div className="field">
        <label htmlFor="plan">変更先プラン</label>
        <select id="plan" name="plan" defaultValue="paid">
          <option value="paid">有料掲載 500円</option>
          <option value="boost">さらに上位表示 980円</option>
        </select>
      </div>
      <button className="primary-button" type="submit">決済へ進む</button>
    </form>
  );
}
