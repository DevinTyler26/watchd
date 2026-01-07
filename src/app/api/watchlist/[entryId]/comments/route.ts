import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { jsonResponse } from "@/lib/api-response";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(500, "Keep comments under 500 characters"),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params;

  const comments = await prisma.watchEntryComment.findMany({
    where: { entryId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      createdAt: true,
      user: { select: { id: true, name: true, image: true } },
    },
  });

  return jsonResponse({ comments }, { noStore: true });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return jsonResponse({ error: "Sign in required" }, { status: 401 });
  }

  const { entryId } = await params;
  const limiter = rateLimit(getRateLimitKey(request, session.user.id), {
    keyPrefix: "comments:create",
    max: 12,
    intervalMs: 60_000,
  });
  if (limiter.limited) {
    const retryAfter = Math.ceil((limiter.resetAt - Date.now()) / 1000);
    return jsonResponse(
      { error: "Too many comments. Try again soon." },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
    );
  }
  const entry = await prisma.watchEntry.findUnique({
    where: { id: entryId },
    select: { id: true, userId: true, groupId: true },
  });

  if (!entry) {
    return jsonResponse({ error: "Entry not found" }, { status: 404 });
  }

  // Enforce membership/ownership rules.
  if (entry.groupId) {
    const membership = await prisma.groupMembership.findUnique({
      where: {
        groupId_userId: {
          groupId: entry.groupId,
          userId: session.user.id,
        },
      },
      select: { status: true },
    });

    if (!membership || membership.status !== "ACTIVE") {
      return jsonResponse(
        { error: "You are not part of this circle." },
        { status: 403 }
      );
    }
  } else if (entry.userId !== session.user.id) {
    return jsonResponse(
      { error: "Only the owner can comment on personal entries." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return jsonResponse(
      { error: parsed.error.flatten().formErrors.join(", ") },
      { status: 400 }
    );
  }

  const newComment = await prisma.watchEntryComment.create({
    data: {
      entryId,
      userId: session.user.id,
      body: parsed.data.body,
    },
    select: {
      id: true,
      body: true,
      createdAt: true,
      user: { select: { id: true, name: true, image: true } },
    },
  });

  return jsonResponse({ comment: newComment }, { status: 201 });
}
