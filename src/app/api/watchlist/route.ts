import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { fetchTitleById } from "@/lib/imdb";
import { prisma } from "@/lib/prisma";
import { sendGroupUpdateEmail } from "@/lib/email";

const payloadSchema = z.object({
  imdbId: z.string().min(2, "IMDb id is required"),
  note: z.string().max(500).optional(),
  liked: z.boolean().optional(),
  groupId: z.string().cuid().optional().nullable(),
});

const deleteSchema = z.object({
  imdbId: z.string().min(2, "IMDb id is required"),
  groupId: z.string().cuid().optional().nullable(),
});

export async function GET() {
  const entries = await prisma.watchEntry.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, name: true, image: true },
      },
    },
    take: 50,
  });

  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().formErrors.join(", ") }, { status: 400 });
  }

  const title = await fetchTitleById(parsed.data.imdbId);

  if (!title) {
    return NextResponse.json({ error: "IMDb title not found" }, { status: 404 });
  }

  const targetGroupId = parsed.data.groupId ?? null;

  if (targetGroupId) {
    const membership = await prisma.groupMembership.findUnique({
      where: {
        groupId_userId: {
          groupId: targetGroupId,
          userId: session.user.id,
        },
      },
    });

    if (!membership || membership.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "You are not part of that group." },
        { status: 403 },
      );
    }

    if (membership.role === "VIEWER") {
      return NextResponse.json(
        { error: "View-only members cannot add titles to this group." },
        { status: 403 },
      );
    }

    const existingInGroup = await prisma.watchEntry.findFirst({
      where: {
        groupId: targetGroupId,
        imdbId: parsed.data.imdbId,
      },
      select: {
        id: true,
        user: { select: { name: true } },
      },
    });

    if (existingInGroup) {
      const message = existingInGroup.user?.name
        ? `${existingInGroup.user.name} already shared this to the group. React or add a comment on the existing card.`
        : "That title is already in this group. React or add a comment on the existing card.";
      return NextResponse.json({ error: message }, { status: 409 });
    }
  }

  const note = parsed.data.note?.trim() || null;
  const liked = parsed.data.liked ?? true;

  const existingEntry = await prisma.watchEntry.findFirst({
    where: {
      userId: session.user.id,
      imdbId: title.imdbId,
      groupId: targetGroupId,
    },
    select: { id: true },
  });

  const includeConfig = {
    user: {
      select: { id: true, name: true, image: true },
    },
    group: {
      select: { id: true, name: true, slug: true },
    },
  } as const;

  type EntryPayload = Prisma.WatchEntryGetPayload<{ include: typeof includeConfig }>;

  const updateExisting = async (id: string) =>
    prisma.watchEntry.update({
      where: { id },
      data: {
        review: note,
        omdb: title.raw ?? undefined,
        liked,
        groupId: targetGroupId,
      },
      include: includeConfig,
    });

  let entry: EntryPayload;
  if (existingEntry) {
    entry = await updateExisting(existingEntry.id);
  } else {
    try {
      entry = await prisma.watchEntry.create({
        data: {
          userId: session.user.id,
          imdbId: title.imdbId,
          title: title.title,
          year: title.year,
          type: title.type,
          posterUrl: title.posterUrl,
          omdb: title.raw ?? undefined,
          review: note,
          liked,
          groupId: targetGroupId,
        },
        include: includeConfig,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          // Uniqueness conflicts: either user's own personal entry or a group duplicate.
          if (targetGroupId) {
            return NextResponse.json(
              {
                error:
                  "That title is already in this group. React or add a comment on the existing card.",
              },
              { status: 409 },
            );
          }

          const conflict = await prisma.watchEntry.findFirst({
            where: {
              userId: session.user.id,
              imdbId: title.imdbId,
              groupId: targetGroupId,
            },
            select: { id: true },
          });

          if (conflict?.id) {
            entry = await updateExisting(conflict.id);
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }
  }

  revalidatePath("/");

  if (targetGroupId) {
    const subscribers = await prisma.groupNotificationPreference.findMany({
      where: {
        groupId: targetGroupId,
        instant: true,
        userId: { not: session.user.id },
      },
      select: {
        user: { select: { email: true, name: true } },
      },
    });

    const addedBy = session.user.name ?? "Someone";
    await Promise.all(
      subscribers
        .map((sub) => sub.user?.email)
        .filter(Boolean)
        .map((email) =>
          sendGroupUpdateEmail({
            to: email as string,
            groupName: entry.group?.name ?? "Your circle",
            title: entry.title,
            addedBy,
            note,
          })
        )
    );
  }

  return NextResponse.json({ entry });
}

export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = deleteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors.join(", ") },
      { status: 400 },
    );
  }

  const targetGroupId = parsed.data.groupId ?? null;

  if (targetGroupId) {
    const membership = await prisma.groupMembership.findUnique({
      where: {
        groupId_userId: {
          groupId: targetGroupId,
          userId: session.user.id,
        },
      },
    });

    if (!membership || membership.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "You are not part of that group." },
        { status: 403 },
      );
    }

    if (membership.role === "VIEWER") {
      return NextResponse.json(
        { error: "View-only members cannot remove titles from this group." },
        { status: 403 },
      );
    }
  }

  const deleteWhere =
    targetGroupId === null
      ? {
          userId: session.user.id,
          imdbId: parsed.data.imdbId,
          groupId: null,
        }
      : {
          userId: session.user.id,
          imdbId: parsed.data.imdbId,
          groupId: targetGroupId,
        };

  const result = await prisma.watchEntry.deleteMany({
    where: deleteWhere,
  });

  if (result.count === 0) {
    return NextResponse.json(
      { error: "Entry not found." },
      { status: 404 },
    );
  }

  revalidatePath("/");
  return NextResponse.json({ success: true });
}
