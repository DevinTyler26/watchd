import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { fetchTitleById } from "@/lib/imdb";
import { prisma } from "@/lib/prisma";
import { sendGroupUpdateEmail } from "@/lib/email";
import { jsonResponse } from "@/lib/api-response";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  imdbId: z.string().min(2, "TMDB id is required"),
  type: z.enum(["movie", "series"]).optional(),
  note: z.string().max(500).optional(),
  groupId: z.string().cuid().optional().nullable(),
});

const deleteSchema = z.object({
  imdbId: z.string().min(2, "TMDB id is required"),
  type: z.enum(["movie", "series"]),
  groupId: z.string().cuid().optional().nullable(),
});

export async function GET() {
  const entries = await prisma.watchEntry.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, name: true, image: true },
      },
      media: {
        select: {
          tmdbId: true,
          title: true,
          year: true,
          posterUrl: true,
          type: true,
          plot: true,
          genre: true,
          watchProviders: true,
          runtimeMinutes: true,
          seasonCount: true,
          trailerUrl: true,
        },
      },
    },
    take: 50,
  });

  return jsonResponse({ entries }, { noStore: true });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return jsonResponse({ error: "Sign in required" }, { status: 401 });
  }
  const limiter = await rateLimit(getRateLimitKey(request, session.user.id), {
    keyPrefix: "watchlist:create",
    max: 10,
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
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return jsonResponse(
      { error: parsed.error.flatten().formErrors.join(", ") },
      { status: 400 }
    );
  }

  const title = await fetchTitleById(parsed.data.imdbId, parsed.data.type);

  if (!title) {
    return jsonResponse({ error: "TMDB title not found" }, { status: 404 });
  }

  const targetGroupId = parsed.data.groupId ?? null;
  const media = await prisma.media.upsert({
    where: {
      tmdbId_type: {
        tmdbId: title.imdbId,
        type: title.type,
      },
    },
    update: {
      title: title.title,
      year: title.year,
      posterUrl: title.posterUrl,
      plot: title.plot,
      genre: title.genre,
      inProduction: title.inProduction ?? false,
      watchProviders: title.watchProviders ?? undefined,
      runtimeMinutes: title.runtimeMinutes ?? undefined,
      seasonCount: title.seasonCount ?? undefined,
      trailerUrl: title.trailerUrl ?? undefined,
    },
    create: {
      tmdbId: title.imdbId,
      type: title.type,
      title: title.title,
      year: title.year,
      posterUrl: title.posterUrl,
      plot: title.plot,
      genre: title.genre,
      inProduction: title.inProduction ?? false,
      watchProviders: title.watchProviders ?? [],
      runtimeMinutes: title.runtimeMinutes ?? null,
      seasonCount: title.seasonCount ?? null,
      trailerUrl: title.trailerUrl ?? null,
    },
  });

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
      return jsonResponse(
        { error: "You are not part of that group." },
        { status: 403 },
      );
    }

    if (membership.role === "VIEWER") {
      return jsonResponse(
        { error: "View-only members cannot add titles to this group." },
        { status: 403 },
      );
    }

    const existingInGroup = await prisma.watchEntry.findFirst({
      where: {
        groupId: targetGroupId,
        mediaId: media.id,
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
      return jsonResponse({ error: message }, { status: 409 });
    }
  }

  const note = parsed.data.note?.trim() || null;

  const existingEntry = await prisma.watchEntry.findFirst({
    where: {
      userId: session.user.id,
      mediaId: media.id,
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
    media: {
      select: {
        tmdbId: true,
        title: true,
        year: true,
        posterUrl: true,
        type: true,
        plot: true,
        genre: true,
        watchProviders: true,
        runtimeMinutes: true,
        seasonCount: true,
        trailerUrl: true,
      },
    },
  } as const;

  type EntryPayload = Prisma.WatchEntryGetPayload<{ include: typeof includeConfig }>;

  const updateExisting = async (id: string) =>
    prisma.watchEntry.update({
      where: { id },
      data: {
        mediaId: media.id,
        review: note,
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
          mediaId: media.id,
          review: note,
          groupId: targetGroupId,
        },
        include: includeConfig,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          // Uniqueness conflicts: either user's own personal entry or a group duplicate.
          if (targetGroupId) {
            return jsonResponse(
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
              mediaId: media.id,
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
            title: entry.media?.title ?? "Untitled",
            addedBy,
            note,
          })
        )
    );
  }

  return jsonResponse({ entry });
}

export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return jsonResponse({ error: "Sign in required" }, { status: 401 });
  }
  const limiter = await rateLimit(getRateLimitKey(request, session.user.id), {
    keyPrefix: "watchlist:delete",
    max: 10,
    intervalMs: 60_000,
  });
  if (limiter.limited) {
    const retryAfter = Math.ceil((limiter.resetAt - Date.now()) / 1000);
    return jsonResponse(
      { error: "Too many deletes. Try again soon." },
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

  const targetGroupId = parsed.data.groupId ?? null;
  const media = await prisma.media.findFirst({
    where: {
      tmdbId: parsed.data.imdbId,
      ...(parsed.data.type ? { type: parsed.data.type } : {}),
    },
    select: { id: true },
  });

  if (!media) {
    return jsonResponse(
      { error: "Entry not found." },
      { status: 404 }
    );
  }

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
      return jsonResponse(
        { error: "You are not part of that group." },
        { status: 403 }
      );
    }

    if (membership.role === "VIEWER") {
      return jsonResponse(
        { error: "View-only members cannot remove titles from this group." },
        { status: 403 }
      );
    }
  }

  const deleteWhere =
    targetGroupId === null
      ? {
          userId: session.user.id,
          mediaId: media.id,
          groupId: null,
        }
      : {
          userId: session.user.id,
          mediaId: media.id,
          groupId: targetGroupId,
        };

  const result = await prisma.watchEntry.deleteMany({
    where: deleteWhere,
  });

  if (result.count === 0) {
    return jsonResponse(
      { error: "Entry not found." },
      { status: 404 }
    );
  }

  revalidatePath("/");
  return jsonResponse({ success: true });
}
