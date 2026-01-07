import { randomUUID } from "node:crypto";

import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendInviteEmail } from "@/lib/email";
import { jsonResponse } from "@/lib/api-response";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["OWNER", "EDITOR", "VIEWER"]).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return jsonResponse({ error: "Sign in required." }, { status: 401 });
  }
  const limiter = await rateLimit(getRateLimitKey(request, session.user.id), {
    keyPrefix: "groups:invite",
    max: 6,
    intervalMs: 60_000,
  });
  if (limiter.limited) {
    const retryAfter = Math.ceil((limiter.resetAt - Date.now()) / 1000);
    return jsonResponse(
      { error: "Too many invites. Try again soon." },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
    );
  }

  const { groupId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = inviteSchema.safeParse(body);

  if (!parsed.success) {
    return jsonResponse(
      { error: parsed.error.flatten().formErrors.join(", ") },
      { status: 400 }
    );
  }

  const membership = await prisma.groupMembership.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId: session.user.id,
      },
    },
  });

  const canInvite =
    membership &&
    membership.status === "ACTIVE" &&
    (membership.role === "OWNER" || membership.role === "EDITOR");

  if (!canInvite) {
    return jsonResponse(
      { error: "Only owners or editors can invite members." },
      { status: 403 }
    );
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { name: true },
  });

  if (!group) {
    return jsonResponse({ error: "Group not found." }, { status: 404 });
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  const normalizedEmail = parsed.data.email.toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingUser) {
    const existingMembership = await prisma.groupMembership.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: existingUser.id,
        },
      },
      select: { status: true },
    });

    if (existingMembership && existingMembership.status === "ACTIVE") {
      return jsonResponse(
        { error: "That email already belongs to the circle." },
        { status: 400 }
      );
    }
  }

  const inviteRole = parsed.data.role ?? "EDITOR";

  if (inviteRole === "OWNER" && membership.role !== "OWNER") {
    return jsonResponse(
      { error: "Only the current owner can invite another owner." },
      { status: 403 }
    );
  }

  await prisma.groupAllowlist.upsert({
    where: { email: normalizedEmail },
    update: {},
    create: { email: normalizedEmail, createdById: session.user.id },
  });

  const invite = await prisma.groupInvite.create({
    data: {
      groupId,
      email: normalizedEmail,
      token,
      expiresAt,
      createdById: session.user.id,
      inviteRole,
    },
  });

  const emailResult = await sendInviteEmail({
    to: normalizedEmail,
    groupName: group.name,
    token,
    inviterName: session.user.name,
  });

  return jsonResponse({
    token: invite.token,
    expiresAt: invite.expiresAt,
    emailSent: emailResult.sent,
  });
}
