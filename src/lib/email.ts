type InviteEmailInput = {
  to: string;
  groupName: string;
  token: string;
  inviterName?: string | null;
};

type GroupUpdateEmailInput = {
  to: string;
  groupName: string;
  title: string;
  addedBy: string;
  note?: string | null;
};

type WeeklySummaryEmailInput = {
  to: string;
  items: Array<{
    title: string;
    addedBy: string;
    createdAt: Date;
    likeCount: number;
    groupName: string;
    note?: string | null;
  }>;
  subject?: string;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

async function sendEmail(payload: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.INVITE_FROM_EMAIL ?? "noreply@watchd.devincunningham.com";

  if (!apiKey) {
    console.warn("RESEND_API_KEY is not configured; skipping email.");
    return { sent: false };
  }

  const fromField = `Watchd <${fromEmail}>`;

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
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown");
      console.error("Failed to send email", errorText);
      return { sent: false };
    }

    return { sent: true };
  } catch (error) {
    console.error("Email request failed", error);
    return { sent: false };
  }
}

export async function sendInviteEmail(
  payload: InviteEmailInput,
): Promise<{ sent: boolean }> {
  const inviteLinkBase =
    process.env.INVITE_LINK_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  const normalizedBase = inviteLinkBase.endsWith("/")
    ? inviteLinkBase.slice(0, -1)
    : inviteLinkBase;
  const inviteLink = `${normalizedBase}/circles?invite=${encodeURIComponent(payload.token)}`;

  const inviter = payload.inviterName?.trim() || "A friend";
  const subject = `${inviter} invited you to ${payload.groupName} on Watchd`;
  const text = `${inviter} invited you to join the ${payload.groupName} circle on Watchd.\n\nJoin instantly: ${inviteLink}\n\nPrefer to paste a token? Use: ${payload.token}`;
  const html = `
    <p>${inviter} invited you to join <strong>${payload.groupName}</strong> on Watchd.</p>
    <p><a href="${inviteLink}" style="color:#9ef;">Join ${payload.groupName}</a></p>
    <p style="font-size:13px;color:#999">Prefer manual entry? Use invite token <strong>${payload.token}</strong>.</p>
  `;
  return sendEmail({
    to: payload.to,
    subject,
    text,
    html,
  });
}

export async function sendGroupUpdateEmail(
  payload: GroupUpdateEmailInput,
): Promise<{ sent: boolean }> {
  const subject = `${payload.addedBy} shared "${payload.title}" in ${payload.groupName}`;
  const textLines = [
    `${payload.addedBy} just shared a new title in ${payload.groupName}.`,
    payload.title,
  ];
  if (payload.note) {
    textLines.push(`Note: ${payload.note}`);
  }
  textLines.push("Open Watchd to react or comment.");

  const text = textLines.join("\n\n");
  const html = `
    <p><strong>${payload.addedBy}</strong> just shared a new title in <strong>${payload.groupName}</strong>.</p>
    <p style="font-size:16px;font-weight:600;">${payload.title}</p>
    ${payload.note ? `<p style="color:#999">${payload.note}</p>` : ""}
    <p style="font-size:13px;color:#999">Open Watchd to react or comment.</p>
  `;

  return sendEmail({
    to: payload.to,
    subject,
    text,
    html,
  });
}

export async function sendWeeklySummaryEmail(
  payload: WeeklySummaryEmailInput,
): Promise<{ sent: boolean }> {
  if (!payload.items.length) {
    return { sent: true };
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";

  const groups = Array.from(new Set(payload.items.map((item) => item.groupName)));
  const subject =
    payload.subject ??
    (groups.length > 1
      ? `${payload.items.length} new titles across ${groups.length} circles`
      : `${payload.items.length} new titles in ${groups[0]}`);
  const textLines = payload.items.map((item, index) => {
    const rank = index + 1;
    return `${rank}. [${item.groupName}] ${item.title} — shared by ${item.addedBy}${
      item.likeCount ? ` (${item.likeCount} likes)` : ""
    }${item.note ? `\n   Note: ${item.note}` : ""}`;
  });

  const text =
    textLines.join("\n\n") +
    "\n\nOpen Watchd to react or comment on these picks.";

  const htmlItems = payload.items
    .map((item, index) => {
      const rank = index + 1;
      return `<li style="margin-bottom:12px; padding:12px 14px; border-radius:14px; background:#0f1628; border:1px solid #243044; list-style:none;">
        <div style="font-size:11px; color:#8bd3ff; letter-spacing:0.12em; text-transform:uppercase;">${item.groupName}</div>
        <div style="margin-top:6px; font-size:16px; font-weight:700; color:#e6f0ff;">${rank}. ${item.title}</div>
        <div style="margin-top:4px; font-size:13px; color:#cdd5e1;">Shared by ${item.addedBy}${
          item.likeCount ? ` · ${item.likeCount} likes` : ""
        }</div>
        ${item.note ? `<div style="margin-top:8px; font-size:13px; color:#9fb2cc; line-height:1.5;">${item.note}</div>` : ""}
      </li>`;
    })
    .join("");

  const html = `
    <div style="max-width:640px; margin:0 auto; padding:20px; font-family:Inter, system-ui, -apple-system, sans-serif; background:#0b1222; color:#e6f0ff;">
      <div style="display:flex; align-items:center; gap:12px; padding:14px 16px; border-radius:14px; background:linear-gradient(120deg, #0f1f3a, #13294d); border:1px solid #203154;">
        <div style="width:40px; height:40px; border-radius:12px; background:#9ef; color:#0b1222; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:18px;">W</div>
        <div>
          <div style="font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color:#9ecbff;">Weekly Drop</div>
          <div style="font-size:18px; font-weight:700;">Here is what landed in your circles</div>
        </div>
      </div>

      <div style="margin-top:16px;">
        <p style="margin:0 0 12px 0; color:#cdd5e1;">Highlights from the past week, sorted by love and recency.</p>
        <ul style="padding:0; margin:0;">${htmlItems}</ul>
      </div>

      <div style="margin-top:20px; text-align:center;">
        <p style="margin:0; font-size:13px; color:#9fb2cc;">Open <a href="${appUrl}" style="color:#9ef; text-decoration:none; font-weight:600;">Watchd</a> to react, comment, and add your next pick.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: payload.to,
    subject,
    text,
    html,
  });
}
