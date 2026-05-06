import type { PlanType } from "@/lib/types";

type ApplicationEmailPayload = {
  id: string;
  name: string;
  email: string;
  youtube_url: string;
  desired_plan: PlanType;
};

export async function notifyAdminApplication(payload: ApplicationEmailPayload) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const to = process.env.ADMIN_NOTIFY_EMAIL;
  const from = process.env.NOTIFICATION_FROM_EMAIL;
  if (!apiKey || !to || !from) return { skipped: true };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vtuber-match.vercel.app";
  const subject = `【Vtuberマッチ】新しい掲載申込: ${payload.name}`;
  const text = [
    "新しい掲載申込がありました。",
    "",
    `申込ID: ${payload.id}`,
    `配信者名: ${payload.name}`,
    `非公開メール: ${payload.email}`,
    `YouTube URL: ${payload.youtube_url}`,
    `希望プラン: ${payload.desired_plan}`,
    "",
    `管理画面入口: ${appUrl}/terms`
  ].join("\n");

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content: [{ type: "text/plain", value: text }]
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`SendGrid notification failed: ${response.status} ${detail}`);
  }
  return { sent: true };
}
