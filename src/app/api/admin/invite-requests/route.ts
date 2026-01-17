import { z } from "zod";

import { auth } from "@/auth";
import { jsonResponse } from "@/lib/api-response";
import { sendInviteApprovedEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

async function assertAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return null;
  }
  return session.user;
}

export async function GET() {
  const user = await assertAdmin();
  if (!user) {
    return jsonResponse({ error: "Admins only." }, { status: 403 });
  }

  const requests = await prisma.inviteRequest.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      email: true,
      createdAt: true,
      status: true,
      decidedAt: true,
      approvedEmailSentAt: true,
      decidedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return jsonResponse({ requests }, { noStore: true });
}

const deleteSchema = z.object({ email: z.string().email() });
const approveSchema = z.object({
  email: z.string().email(),
  action: z.enum(["approve", "resend"]).optional(),
});

export async function DELETE(request: Request) {
  const user = await assertAdmin();
  if (!user) {
    return jsonResponse({ error: "Admins only." }, { status: 403 });
  }
  const limiter = await rateLimit(getRateLimitKey(request, user.id), {
    keyPrefix: "admin:invite-requests:delete",
    max: 30,
    intervalMs: 60_000,
  });
  if (limiter.limited) {
    const retryAfter = Math.ceil((limiter.resetAt - Date.now()) / 1000);
    return jsonResponse(
      { error: "Too many requests. Try again soon." },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { error: parsed.error.flatten().formErrors.join(", ") },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase();
  await prisma.inviteRequest.upsert({
    where: { email },
    update: {
      status: "DECLINED",
      decidedAt: new Date(),
      decidedById: user.id,
    },
    create: {
      email,
      status: "DECLINED",
      decidedAt: new Date(),
      decidedById: user.id,
    },
  });

  return jsonResponse({ success: true });
}

export async function POST(request: Request) {
  const user = await assertAdmin();
  if (!user) {
    return jsonResponse({ error: "Admins only." }, { status: 403 });
  }
  const limiter = await rateLimit(getRateLimitKey(request, user.id), {
    keyPrefix: "admin:invite-requests:approve",
    max: 30,
    intervalMs: 60_000,
  });
  if (limiter.limited) {
    const retryAfter = Math.ceil((limiter.resetAt - Date.now()) / 1000);
    return jsonResponse(
      { error: "Too many requests. Try again soon." },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = approveSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { error: parsed.error.flatten().formErrors.join(", ") },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase();
  const action = parsed.data.action ?? "approve";

  if (action === "resend") {
    const existing = await prisma.inviteRequest.findUnique({
      where: { email },
      select: { status: true },
    });
    if (!existing || existing.status !== "APPROVED") {
      return jsonResponse(
        { error: "Request must be approved to resend." },
        { status: 409 }
      );
    }
    const emailResult = await sendInviteApprovedEmail({ to: email });
    if (emailResult.sent) {
      await prisma.inviteRequest.update({
        where: { email },
        data: { approvedEmailSentAt: new Date() },
      });
    }
    return jsonResponse({ success: true, emailSent: emailResult.sent });
  }

  await prisma.groupAllowlist.upsert({
    where: { email },
    update: {},
    create: { email, createdById: user.id },
  });

  await prisma.inviteRequest.upsert({
    where: { email },
    update: {
      status: "APPROVED",
      decidedAt: new Date(),
      decidedById: user.id,
    },
    create: {
      email,
      status: "APPROVED",
      decidedAt: new Date(),
      decidedById: user.id,
    },
  });

  const emailResult = await sendInviteApprovedEmail({ to: email });
  if (emailResult.sent) {
    await prisma.inviteRequest.update({
      where: { email },
      data: { approvedEmailSentAt: new Date() },
    });
  }

  return jsonResponse({ success: true, emailSent: emailResult.sent });
}
