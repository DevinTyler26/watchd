import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { jsonResponse } from "@/lib/api-response";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";

const joinSchema = z.object({
  token: z.string().min(10, "Invite token is required"),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return jsonResponse({ error: "Sign in required." }, { status: 401 });
  }
  const limiter = await rateLimit(getRateLimitKey(request, session.user.id), {
    keyPrefix: "groups:join",
    max: 6,
    intervalMs: 60_000,
  });
  if (limiter.limited) {
    const retryAfter = Math.ceil((limiter.resetAt - Date.now()) / 1000);
    return jsonResponse(
      { error: "Too many attempts. Try again soon." },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
    );
  }

  const userId = session.user.id;

  const body = await request.json().catch(() => ({}));
  const parsed = joinSchema.safeParse(body);

  if (!parsed.success) {
    return jsonResponse(
      { error: parsed.error.flatten().formErrors.join(", ") },
      { status: 400 }
    );
  }

  const invite = await prisma.groupInvite.findUnique({
    where: { token: parsed.data.token },
  });

  if (!invite) {
    return jsonResponse({ error: "Invite not found." }, { status: 404 });
  }

  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return jsonResponse({ error: "Invite expired." }, { status: 410 });
  }

  const roleToAssign = invite.inviteRole ?? "EDITOR";

  const group = await prisma.$transaction(async (tx) => {
    await tx.groupInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });

    const createdMembership = await tx.groupMembership.upsert({
      where: {
        groupId_userId: {
          groupId: invite.groupId,
          userId,
        },
      },
      update: { status: "ACTIVE", role: roleToAssign },
      create: {
        groupId: invite.groupId,
        userId,
        role: roleToAssign,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (roleToAssign === "OWNER") {
      const currentOwner = await tx.group.findUnique({
        where: { id: invite.groupId },
        select: { ownerId: true },
      });

      if (currentOwner?.ownerId && currentOwner.ownerId !== userId) {
        await tx.groupMembership.updateMany({
          where: { groupId: invite.groupId, userId: currentOwner.ownerId },
          data: { role: "EDITOR" },
        });
      }

      await tx.group.update({
        where: { id: invite.groupId },
        data: { ownerId: userId },
      });
    }

    return tx.group.findUnique({
      where: { id: invite.groupId },
      select: { id: true, name: true, slug: true, shareCode: true },
    });
  });

  if (!group) {
    return jsonResponse(
      { error: "Group no longer exists." },
      { status: 404 }
    );
  }

  return jsonResponse({ group });
}
