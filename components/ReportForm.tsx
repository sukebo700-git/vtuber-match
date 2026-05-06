"use client";

import { useState } from "react";
import { Flag } from "lucide-react";

export function ReportForm({ streamerId, streamerName }: { streamerId: string; streamerName: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("送信中...");
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        streamer_id: streamerId,
        streamer_name: streamerName,
        reason: form.get("reason"),
        detail: form.get("detail"),
        reporter_contact: form.get("reporter_contact")
      })
    });

    if (response.ok) {
      setStatus("通報を送信しました。運営が確認します。");
      event.currentTarget.reset();
      return;
    }
    setStatus("送信に失敗しました。理由を選択してください。");
  }

  return (
    <section className="status-band report-section">
      <button className="danger-button" type="button" onClick={() => setOpen((value) => !value)}>
        <Flag size={16} />
        この配信者を通報する
      </button>
      {open && (
        <form className="form compact-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="report_reason">理由</label>
            <select id="report_reason" name="reason" required>
              <option value="">選択してください</option>
              <option value="不適切な内容">不適切な内容</option>
              <option value="なりすまし">なりすまし</option>
              <option value="リンク・情報が違う">リンク・情報が違う</option>
              <option value="権利侵害の疑い">権利侵害の疑い</option>
              <option value="その他">その他</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="report_detail">詳細</label>
            <textarea id="report_detail" name="detail" placeholder="確認してほしい内容を入力してください" />
          </div>
          <div className="field">
            <label htmlFor="report_contact">連絡先 任意</label>
            <input id="report_contact" name="reporter_contact" placeholder="メールまたはSNS ID" />
          </div>
          <button className="primary-button" type="submit">送信する</button>
          {status && <p className="help-text">{status}</p>}
        </form>
      )}
    </section>
  );
}
