import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type ReactionType = "LIKE" | "DISLIKE";

async function assertAccess(entryId: string, userId: string) {
  const entry = await prisma.watchEntry.findUnique({
    where: { id: entryId },
    select: { id: true, userId: true, groupId: true },
  });

  if (!entry) {
    return {
      entry: null,
      error: NextResponse.json({ error: "Entry not found." }, { status: 404 }),
    };
  }

  if (entry.groupId) {
    const membership = await prisma.groupMembership.findUnique({
      where: {
        groupId_userId: {
          groupId: entry.groupId,
          userId,
        },
      },
    });

    if (!membership || membership.status !== "ACTIVE") {
      return {
        entry: null,
        error: NextResponse.json(
          { error: "You are not part of that group." },
          { status: 403 }
        ),
      };
    }
  } else if (entry.userId !== userId) {
    return {
      entry: null,
      error: NextResponse.json(
        { error: "This entry belongs to someone else." },
        { status: 403 }
      ),
    };
  }

  return { entry, error: null };
}

const VALID_REACTIONS = new Set<ReactionType>(["LIKE", "DISLIKE"]);

type ReactionPayload = { reaction?: ReactionType } | null;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { entryId } = await params;
  const { error } = await assertAccess(entryId, session.user.id);

  if (error) {
    return error;
  }

  const payload = (await request.json().catch(() => null)) as ReactionPayload;
  const reaction = payload?.reaction;

  if (!reaction || !VALID_REACTIONS.has(reaction)) {
    return NextResponse.json({ error: "Invalid reaction." }, { status: 400 });
  }

  await prisma.$executeRaw`
    INSERT INTO "WatchEntryReaction" ("id", "entryId", "userId", "reaction", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${entryId}, ${session.user.id}, ${reaction}, NOW(), NOW())
    ON CONFLICT ("entryId", "userId")
    DO UPDATE SET "reaction" = EXCLUDED."reaction", "updatedAt" = NOW()
  `;

  revalidatePath("/");
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { entryId } = await params;
  const { error } = await assertAccess(entryId, session.user.id);

  if (error) {
    return error;
  }

  await prisma.$executeRaw`
    DELETE FROM "WatchEntryReaction"
    WHERE "entryId" = ${entryId} AND "userId" = ${session.user.id}
  `;

  revalidatePath("/");
  return NextResponse.json({ success: true });
}
