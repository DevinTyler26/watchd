import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { jsonResponse } from "@/lib/api-response";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  groupId: z.string().cuid(),
  instant: z.boolean().optional(),
  weekly: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonResponse({ error: "Sign in required." }, { status: 401 });
  }

  const memberships = await prisma.groupMembership.findMany({
    where: { userId: session.user.id, status: "ACTIVE" },
    select: {
      group: { select: { id: true, name: true, shareCode: true, slug: true } },
    },
  });

  const prefs = await prisma.groupNotificationPreference.findMany({
    where: { userId: session.user.id },
    select: { groupId: true, instant: true, weekly: true },
  });
  const prefMap = new Map(prefs.map((p) => [p.groupId, p]));

  return jsonResponse(
    {
      groups: memberships.map((m) => ({
        id: m.group.id,
        name: m.group.name,
        shareCode: m.group.shareCode,
        slug: m.group.slug,
        instant: prefMap.get(m.group.id)?.instant ?? false,
        weekly: prefMap.get(m.group.id)?.weekly ?? false,
      })),
    },
    { noStore: true }
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonResponse({ error: "Sign in required." }, { status: 401 });
  }
  const limiter = rateLimit(getRateLimitKey(request, session.user.id), {
    keyPrefix: "notifications:update",
    max: 12,
    intervalMs: 60_000,
  });
  if (limiter.limited) {
    const retryAfter = Math.ceil((limiter.resetAt - Date.now()) / 1000);
    return jsonResponse(
      { error: "Too many updates. Try again soon." },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
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

  const membership = await prisma.groupMembership.findUnique({
    where: {
      groupId_userId: {
        groupId: parsed.data.groupId,
        userId: session.user.id,
      },
    },
  });

  if (!membership || membership.status !== "ACTIVE") {
    return jsonResponse(
      { error: "You are not part of that group." },
      { status: 403 }
    );
  }

  const updates: { instant?: boolean; weekly?: boolean } = {};
  if (typeof parsed.data.instant === "boolean") updates.instant = parsed.data.instant;
  if (typeof parsed.data.weekly === "boolean") updates.weekly = parsed.data.weekly;

  await prisma.groupNotificationPreference.upsert({
    where: { groupId_userId: { groupId: parsed.data.groupId, userId: session.user.id } },
    update: updates,
    create: {
      groupId: parsed.data.groupId,
      userId: session.user.id,
      instant: updates.instant ?? false,
      weekly: updates.weekly ?? false,
    },
  });

  return jsonResponse({ success: true });
}
