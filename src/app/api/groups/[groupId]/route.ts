import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { jsonResponse } from "@/lib/api-response";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";

const updateSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(60),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonResponse({ error: "Sign in required." }, { status: 401 });
  }

  const limiter = await rateLimit(getRateLimitKey(request, session.user.id), {
    keyPrefix: "groups:rename",
    max: 12,
    intervalMs: 60_000,
  });
  if (limiter.limited) {
    const retryAfter = Math.ceil((limiter.resetAt - Date.now()) / 1000);
    return jsonResponse(
      { error: "Too many requests. Try again soon." },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
    );
  }

  const { groupId } = await params;
  const membership = await prisma.groupMembership.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId: session.user.id,
      },
    },
    select: { role: true, status: true },
  });

  if (!membership || membership.status !== "ACTIVE") {
    return jsonResponse({ error: "Not authorized." }, { status: 403 });
  }
  if (membership.role !== "OWNER") {
    return jsonResponse(
      { error: "Only owners can rename this circle." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { error: parsed.error.flatten().formErrors.join(", ") },
      { status: 400 }
    );
  }

  const updated = await prisma.group.update({
    where: { id: groupId },
    data: { name: parsed.data.name.trim() },
    select: { id: true, name: true },
  });

  return jsonResponse({ group: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonResponse({ error: "Sign in required." }, { status: 401 });
  }

  const limiter = await rateLimit(getRateLimitKey(request, session.user.id), {
    keyPrefix: "groups:delete",
    max: 4,
    intervalMs: 60_000,
  });
  if (limiter.limited) {
    const retryAfter = Math.ceil((limiter.resetAt - Date.now()) / 1000);
    return jsonResponse(
      { error: "Too many requests. Try again soon." },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
    );
  }

  const { groupId } = await params;
  const membership = await prisma.groupMembership.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId: session.user.id,
      },
    },
    select: { role: true, status: true },
  });

  if (!membership || membership.status !== "ACTIVE") {
    return jsonResponse({ error: "Not authorized." }, { status: 403 });
  }
  if (membership.role !== "OWNER") {
    return jsonResponse(
      { error: "Only owners can delete this circle." },
      { status: 403 }
    );
  }

  await prisma.group.delete({ where: { id: groupId } });
  return jsonResponse({ ok: true });
}
