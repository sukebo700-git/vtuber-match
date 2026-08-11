// Resend REST APIへの薄いラッパー。SDK追加なし(fetchのみ)。
// RESEND_API_KEY未設定(ローカル開発等)ではエラーにせずログのみで済ませる。
export async function sendEmail(input: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM_ADDRESS || process.env.COLLABORATION_EMAIL_FROM || "";

  if (!apiKey || !from) {
    console.warn("sendEmail skipped: RESEND_API_KEY or MAIL_FROM_ADDRESS/COLLABORATION_EMAIL_FROM not set", { to: input.to, subject: input.subject });
    return { ok: false, skipped: true as const };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("sendEmail failed:", response.status, body);
      return { ok: false, skipped: false as const };
    }
    return { ok: true, skipped: false as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("sendEmail threw:", message);
    return { ok: false, skipped: false as const };
  }
}
