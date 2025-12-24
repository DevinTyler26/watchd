type InviteEmailInput = {
  to: string;
  groupName: string;
  token: string;
  inviterName?: string | null;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export async function sendInviteEmail(
  payload: InviteEmailInput,
): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.INVITE_FROM_EMAIL ?? "noreply@watchd.devincunningham.com";
  const inviteLinkBase =
    process.env.INVITE_LINK_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  const normalizedBase = inviteLinkBase.endsWith("/")
    ? inviteLinkBase.slice(0, -1)
    : inviteLinkBase;
  const inviteLink = `${normalizedBase}/circles?invite=${encodeURIComponent(payload.token)}`;

  if (!apiKey) {
    console.warn("RESEND_API_KEY is not configured; skipping invite email.");
    return { sent: false };
  }

  const fromField = `Watchd Invites <${fromEmail}>`;
  const inviter = payload.inviterName?.trim() || "A friend";
  const subject = `${inviter} invited you to ${payload.groupName} on Watchd`;
  const text = `${inviter} invited you to join the ${payload.groupName} circle on Watchd.\n\nJoin instantly: ${inviteLink}\n\nPrefer to paste a token? Use: ${payload.token}`;
  const html = `
    <p>${inviter} invited you to join <strong>${payload.groupName}</strong> on Watchd.</p>
    <p><a href="${inviteLink}" style="display:inline-block;padding:12px 20px;border-radius:999px;background-color:#ffffff33;color:#000;font-weight:600;text-decoration:none;">Join ${payload.groupName}</a></p>
    <p style="font-size:13px;color:#999">Prefer manual entry? Use invite token <strong>${payload.token}</strong>.</p>
  `;

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromField,
        to: payload.to,
        subject,
        text,
        html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown");
      console.error("Failed to send invite email", errorText);
      return { sent: false };
    }

    return { sent: true };
  } catch (error) {
    console.error("Invite email request failed", error);
    return { sent: false };
  }
}
