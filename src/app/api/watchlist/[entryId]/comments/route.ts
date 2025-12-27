import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

  return NextResponse.json({ comments });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { entryId } = await params;
  const entry = await prisma.watchEntry.findUnique({
    where: { id: entryId },
    select: { id: true, userId: true, groupId: true },
  });

  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
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
      return NextResponse.json(
        { error: "You are not part of this circle." },
        { status: 403 }
      );
    }
  } else if (entry.userId !== session.user.id) {
    return NextResponse.json(
      { error: "Only the owner can comment on personal entries." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
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

  return NextResponse.json({ comment: newComment }, { status: 201 });
}
