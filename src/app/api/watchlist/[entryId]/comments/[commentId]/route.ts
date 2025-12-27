import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(500, "Keep comments under 500 characters"),
});

type RouteParams = { params: Promise<{ entryId: string; commentId: string }> };

async function ensureOwnership(
  entryId: string,
  commentId: string,
  userId: string,
) {
  const comment = await prisma.watchEntryComment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      body: true,
      entryId: true,
      userId: true,
      entry: { select: { groupId: true } },
    },
  });

  if (!comment || comment.entryId !== entryId) {
    return { error: "Comment not found", status: 404 as const };
  }

  if (comment.userId !== userId) {
    return { error: "You can only edit your own comments.", status: 403 as const };
  }

  if (comment.entry.groupId) {
    const membership = await prisma.groupMembership.findUnique({
      where: {
        groupId_userId: {
          groupId: comment.entry.groupId,
          userId,
        },
      },
      select: { status: true },
    });

    if (!membership || membership.status !== "ACTIVE") {
      return { error: "You are not part of this circle.", status: 403 as const };
    }
  }

  return { comment };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { entryId, commentId } = await params;

  const ownership = await ensureOwnership(entryId, commentId, session.user.id);
  if ("error" in ownership) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().formErrors.join(", ") }, { status: 400 });
  }

  const updated = await prisma.watchEntryComment.update({
    where: { id: commentId },
    data: { body: parsed.data.body },
    select: {
      id: true,
      body: true,
      createdAt: true,
      user: { select: { id: true, name: true, image: true } },
    },
  });

  return NextResponse.json({ comment: updated });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { entryId, commentId } = await params;
  const ownership = await ensureOwnership(entryId, commentId, session.user.id);
  if ("error" in ownership) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status });
  }

  await prisma.watchEntryComment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
