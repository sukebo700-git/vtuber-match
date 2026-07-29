"use client";

import { useEffect, useState } from "react";

type PreferredContact = "x" | "discord" | "email";

type SettingsResponse = {
  collaboration_enabled: boolean;
  collaboration_email_enabled: boolean;
  contact: {
    preferred_contact: PreferredContact;
    x_account: string;
    discord_username: string;
    contact_email: string;
  } | null;
};

export function CollaborationSettingsForm() {
  const [loaded, setLoaded] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const [collaborationEnabled, setCollaborationEnabled] = useState(false);
  const [collaborationEmailEnabled, setCollaborationEmailEnabled] = useState(true);
  const [preferredContact, setPreferredContact] = useState<PreferredContact>("x");
  const [xAccount, setXAccount] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  useEffect(() => {
    fetch("/api/collaboration/settings")
      .then((response) => {
        if (response.status === 401) {
          setLoginRequired(true);
          return null;
        }
        return response.ok ? (response.json() as Promise<SettingsResponse>) : null;
      })
      .then((data) => {
        if (!data) return;
        setCollaborationEnabled(data.collaboration_enabled);
        setCollaborationEmailEnabled(data.collaboration_email_enabled);
        if (data.contact) {
          setPreferredContact(data.contact.preferred_contact);
          setXAccount(data.contact.x_account);
          setDiscordUsername(data.contact.discord_username);
          setContactEmail(data.contact.contact_email);
        }
      })
      .catch(() => setStatus("設定を読み込めませんでした。"))
      .finally(() => setLoaded(true));
  }, []);

  const hasAnyContact = Boolean(xAccount.trim() || discordUsername.trim() || contactEmail.trim());

  // preferredContactが「入力が空になったフィールド」を指したままにならないよう、
  // 選択肢が変わるたびに、埋まっているフィールドの中から自動的に補正する。
  useEffect(() => {
    const filled: PreferredContact[] = [];
    if (xAccount.trim()) filled.push("x");
    if (discordUsername.trim()) filled.push("discord");
    if (contactEmail.trim()) filled.push("email");
    if (filled.length && !filled.includes(preferredContact)) {
      setPreferredContact(filled[0]);
    }
  }, [xAccount, discordUsername, contactEmail, preferredContact]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (collaborationEnabled && !hasAnyContact) {
      setStatus("コラボ受付をONにするには、連絡先を最低1つ登録してください。");
      return;
    }
    setBusy(true);
    setStatus("保存しています...");
    try {
      const response = await fetch("/api/collaboration/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collaboration_enabled: collaborationEnabled,
          collaboration_email_enabled: collaborationEmailEnabled,
          preferred_contact: preferredContact,
          x_account: xAccount,
          discord_username: discordUsername,
          contact_email: contactEmail,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(data.error || "保存できませんでした。");
        return;
      }
      setStatus("設定を保存しました。");
    } catch {
      setStatus("通信に失敗しました。時間をおいてもう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return <section className="status-band"><p>読み込み中...</p></section>;
  }

  if (loginRequired) {
    return (
      <section className="status-band">
        <p>コラボのお誘い設定には配信者ログインが必要です。</p>
        <div className="creator-hero-actions">
          <a className="primary-button" href="/login">配信者ログイン</a>
        </div>
      </section>
    );
  }

  return (
    <section className="status-band">
      <form className="form" onSubmit={submit}>
        <div className="field consent-field">
          <label className="choice consent-choice">
            <input
              type="checkbox"
              checked={collaborationEnabled}
              onChange={(event) => setCollaborationEnabled(event.target.checked)}
            />
            コラボのお誘いを受け付ける
          </label>
          <p className="help-text">
            {collaborationEnabled
              ? "受け付ける: プロフィールに「コラボ募集中」バッジが表示され、他のVTuberからお誘いを受け取れます。"
              : "現在は受け付けない: 本人が明示的にONにするまで、他のVTuberからお誘いは届きません。"}
          </p>
        </div>

        <div className="field">
          <label>コラボ用連絡先(非公開・承諾した相手にだけ開示されます)</label>
          <p className="help-text">最低1つ登録してください。通常の公開プロフィールには表示されません。</p>

          <div className="field">
            <label htmlFor="collab_x_account">Xアカウント</label>
            <input
              id="collab_x_account"
              type="text"
              value={xAccount}
              maxLength={40}
              placeholder="@example"
              onChange={(event) => setXAccount(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="collab_discord">Discordユーザー名</label>
            <input
              id="collab_discord"
              type="text"
              value={discordUsername}
              maxLength={60}
              placeholder="example_user"
              onChange={(event) => setDiscordUsername(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="collab_email">連絡用メールアドレス</label>
            <input
              id="collab_email"
              type="email"
              value={contactEmail}
              maxLength={120}
              placeholder="example@example.com"
              onChange={(event) => setContactEmail(event.target.value)}
            />
          </div>

          {hasAnyContact && (
            <div className="field">
              <label htmlFor="collab_preferred">優先連絡方法</label>
              <select
                id="collab_preferred"
                value={preferredContact}
                onChange={(event) => setPreferredContact(event.target.value as PreferredContact)}
              >
                {xAccount.trim() && <option value="x">Xアカウント</option>}
                {discordUsername.trim() && <option value="discord">Discordユーザー名</option>}
                {contactEmail.trim() && <option value="email">連絡用メールアドレス</option>}
              </select>
            </div>
          )}
        </div>

        <div className="field consent-field">
          <label className="choice consent-choice">
            <input
              type="checkbox"
              checked={collaborationEmailEnabled}
              onChange={(event) => setCollaborationEmailEnabled(event.target.checked)}
            />
            コラボのお誘いや承諾結果をメールでも通知する
          </label>
          <p className="help-text">
            コラボのお誘いや承諾結果を、登録メールアドレスへ通知します。アプリ内通知はこの設定に関係なく表示されます。
          </p>
        </div>

        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? "保存中..." : "設定を保存する"}
        </button>
        {status ? <p className="form-status">{status}</p> : null}
      </form>
    </section>
  );
}
