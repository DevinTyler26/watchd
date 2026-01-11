import type { GroupRole } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { SiteHeader } from "@/components/header";
import { AddEntryPanel } from "@/components/add-entry-panel";
import { EntryCard, type EntryWithUser } from "@/components/entry-card";
import { FeedFilterMenu } from "@/components/feed-filter-menu";
import { SharedWatchlistHero } from "@/components/shared-watchlist-hero";
import { getUserGroups } from "@/lib/groups";
import { prisma } from "@/lib/prisma";

function isPromise<T>(value: unknown): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

type SortMode = "recent" | "likes";
type ReactionType = "LIKE" | "DISLIKE";
type MediaFilterParam = "all" | "movie" | "tv";
type MediaTypeFilter = "all" | "movie" | "series";

type FeedEntryQuery = Prisma.WatchEntryGetPayload<{
  include: {
    user: {
      select: { id: true; name: true; image: true };
    };
    group: {
      select: { id: true; name: true; slug: true };
    };
    media: {
      select: {
        tmdbId: true;
        title: true;
        year: true;
        posterUrl: true;
        type: true;
        plot: true;
        genre: true;
        watchProviders: true;
        runtimeMinutes: true;
        seasonCount: true;
        trailerUrl: true;
      };
    };
  };
}>;

const feedEntryInclude = {
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
} satisfies Prisma.WatchEntryInclude;

async function getLatestEntries(
  groupId: string | null,
  viewerId: string | null,
  mediaType: MediaTypeFilter,
  genreFilter: string
): Promise<FeedEntryQuery[]> {
  if (!groupId && !viewerId) {
    return [];
  }

  const where: Prisma.WatchEntryWhereInput = groupId
    ? { groupId }
    : { groupId: null, userId: viewerId ?? "__none__" };
  if (mediaType !== "all") {
    where.media = { type: mediaType };
  }
  if (genreFilter) {
    where.media = {
      ...(where.media ?? {}),
      genre: { contains: genreFilter, mode: "insensitive" },
    };
  }
  const orderBy: Prisma.WatchEntryOrderByWithRelationInput[] = [
    { createdAt: "desc" },
  ];

  return prisma.watchEntry.findMany({
    where,
    orderBy,
    include: feedEntryInclude,
    take: 12,
  }) as Promise<FeedEntryQuery[]>;
}

async function getGenreOptions(
  groupId: string | null,
  viewerId: string | null,
  mediaType: MediaTypeFilter
): Promise<string[]> {
  if (!groupId && !viewerId) {
    return [];
  }

  const where: Prisma.WatchEntryWhereInput = groupId
    ? { groupId }
    : { groupId: null, userId: viewerId ?? "__none__" };
  if (mediaType !== "all") {
    where.media = { type: mediaType };
  }

  const rows = await prisma.watchEntry.findMany({
    where,
    select: {
      media: {
        select: {
          genre: true,
        },
      },
    },
    distinct: ["mediaId"],
  });

  const genres = new Set<string>();
  rows.forEach((row) => {
    if (!row.media?.genre) return;
    row.media.genre
      .split(",")
      .map((genre) => genre.trim())
      .filter(Boolean)
      .forEach((genre) => genres.add(genre));
  });

  return Array.from(genres).sort((a, b) => a.localeCompare(b));
}

type SearchParams = {
  group?: string | string[];
  sort?: string;
  type?: string;
  genre?: string;
};

type GroupSummary = {
  id: string;
  name: string;
  slug: string;
  shareCode: string;
  role: GroupRole;
};

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const session = await auth();
  const resolvedParams =
    searchParams && isPromise<SearchParams>(searchParams)
      ? await searchParams
      : (searchParams as SearchParams | undefined);
  let memberships: Awaited<ReturnType<typeof getUserGroups>> = [];
  let heroDismissed = false;
  if (session?.user?.id) {
    const heroPreferencePromise = prisma.user
      .findUnique({
        where: { id: session.user.id },
        select: { heroDismissedAt: true },
      })
      .catch((error) => {
        console.warn("Hero preference lookup failed", error);
        return null;
      });
    const [membershipRows, viewerPreferences] = await Promise.all([
      getUserGroups(session.user.id),
      heroPreferencePromise,
    ]);
    memberships = membershipRows;
    heroDismissed = Boolean(viewerPreferences?.heroDismissedAt);
  }
  const groups: GroupSummary[] = memberships.map((membership) => ({
    id: membership.group.id,
    name: membership.group.name,
    slug: membership.group.slug,
    shareCode: membership.group.shareCode,
    role: membership.role,
  }));
  const shareTargets = session?.user
    ? [
        { id: null as string | null, name: "Personal feed" },
        ...groups.map((group) => ({ id: group.id, name: group.name })),
      ]
    : [];

  const requestedCodeRaw = resolvedParams?.group;
  const requestedCode = Array.isArray(requestedCodeRaw)
    ? requestedCodeRaw[0] ?? "personal"
    : requestedCodeRaw ?? "personal";
  const requestedSortRaw = resolvedParams?.sort;
  const sortMode: SortMode = requestedSortRaw === "likes" ? "likes" : "recent";
  const requestedTypeRaw = resolvedParams?.type;
  const typeFilterParam: MediaFilterParam =
    requestedTypeRaw === "movie" || requestedTypeRaw === "tv"
      ? requestedTypeRaw
      : "all";
  const mediaTypeFilter: MediaTypeFilter =
    typeFilterParam === "tv" ? "series" : typeFilterParam;
  const requestedGenreRaw = resolvedParams?.genre;
  const genreFilter =
    typeof requestedGenreRaw === "string" ? requestedGenreRaw.trim() : "";
  const selectedGroup =
    requestedCode !== "personal"
      ? groups.find((group) => group.shareCode === requestedCode) ??
        groups.find((group) => group.slug === requestedCode) ??
        null
      : null;
  const activeFeedCode =
    selectedGroup?.shareCode ?? selectedGroup?.slug ?? "personal";
  const viewerId = session?.user?.id ?? null;
  const baseGroupId = selectedGroup ? selectedGroup.id : null;
  const genreOptions = await getGenreOptions(
    baseGroupId,
    viewerId,
    mediaTypeFilter
  );
  const entriesRaw = await getLatestEntries(
    baseGroupId,
    viewerId,
    mediaTypeFilter,
    genreFilter
  );
  const entriesAllRaw =
    sortMode === "recent" && mediaTypeFilter === "all" && !genreFilter
      ? entriesRaw
      : await getLatestEntries(baseGroupId, viewerId, "all", "");
  const entryIds = entriesRaw.map((entry) => entry.id);
  const entryIdSqlList = entryIds.map((id) => Prisma.sql`${id}`);
  const reactionCounts = entryIds.length
    ? await prisma.$queryRaw<
        { entryId: string; reaction: ReactionType; count: number }[]
      >(
        Prisma.sql`
          SELECT "entryId", "reaction", COUNT(*)::int AS count
          FROM "WatchEntryReaction"
          WHERE "entryId" IN (${Prisma.join(entryIdSqlList)})
          GROUP BY "entryId", "reaction"
        `
      )
    : [];
  const reactionCountMap = new Map<
    string,
    { likeCount: number; dislikeCount: number }
  >();
  reactionCounts.forEach((item) => {
    const existing = reactionCountMap.get(item.entryId) ?? {
      likeCount: 0,
      dislikeCount: 0,
    };
    if (item.reaction === "LIKE") {
      existing.likeCount = Number(item.count);
    } else if (item.reaction === "DISLIKE") {
      existing.dislikeCount = Number(item.count);
    }
    reactionCountMap.set(item.entryId, existing);
  });
  const viewerReactionRows =
    viewerId && entryIds.length
      ? await prisma.$queryRaw<{ entryId: string; reaction: ReactionType }[]>(
          Prisma.sql`
          SELECT "entryId", "reaction"
          FROM "WatchEntryReaction"
          WHERE "entryId" IN (${Prisma.join(
            entryIdSqlList
          )}) AND "userId" = ${viewerId}
        `
        )
      : [];
  const viewerReactionMap = new Map(
    viewerReactionRows.map((item) => [item.entryId, item.reaction])
  );
  const sharedGroupsByKey = new Map<
    string,
    Array<{ id: string; name: string }>
  >();
  const uniqueMediaIds = Array.from(
    new Set(entriesRaw.map((entry) => entry.mediaId).filter(Boolean))
  ) as string[];
  const uniqueUserIds = Array.from(
    new Set(entriesRaw.map((entry) => entry.userId))
  );
  if (uniqueMediaIds.length && uniqueUserIds.length) {
    const sharedRows = await prisma.watchEntry.findMany({
      where: {
        userId: { in: uniqueUserIds },
        mediaId: { in: uniqueMediaIds },
        groupId: { not: null },
      },
      select: {
        mediaId: true,
        userId: true,
        group: {
          select: { id: true, name: true },
        },
      },
    });
    sharedRows.forEach((row) => {
      if (!row.group) {
        return;
      }
      const key = `${row.userId}:${row.mediaId}`;
      const existing = sharedGroupsByKey.get(key) ?? [];
      sharedGroupsByKey.set(key, [...existing, row.group]);
    });
  }
  const entries: EntryWithUser[] = entriesRaw
    .filter(
      (
        entry
      ): entry is FeedEntryQuery & {
        media: NonNullable<FeedEntryQuery["media"]>;
      } => entry.media !== null
    )
    .map((entry) => {
      const counts = reactionCountMap.get(entry.id) ?? {
        likeCount: 0,
        dislikeCount: 0,
      };
      return {
        ...entry,
        likeCount: counts.likeCount,
        dislikeCount: counts.dislikeCount,
        viewerReaction: viewerReactionMap.get(entry.id) ?? null,
        sharedGroups:
          sharedGroupsByKey.get(`${entry.userId}:${entry.mediaId ?? ""}`) ?? [],
      };
    });
  const uniqueGenres = genreFilter
    ? Array.from(new Set([...genreOptions, genreFilter])).sort((a, b) =>
        a.localeCompare(b)
      )
    : genreOptions;

  if (sortMode === "likes") {
    entries.sort((a, b) => {
      if (b.likeCount !== a.likeCount) {
        return b.likeCount - a.likeCount;
      }
      if (a.dislikeCount !== b.dislikeCount) {
        return a.dislikeCount - b.dislikeCount;
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }
  const existingFeedIds = Array.from(
    new Set(entries.map((entry) => entry.media.tmdbId).filter(Boolean))
  );
  const shareTarget = {
    id: selectedGroup ? selectedGroup.id : null,
    label: selectedGroup ? `${selectedGroup.name}` : "Personal feed",
  };
  const groupMismatch =
    requestedCode !== "personal" && !selectedGroup && groups.length > 0;

  const viewingFeedConfig = session?.user
    ? { groups, activeCode: activeFeedCode }
    : undefined;

  return (
    <div className="min-h-screen pb-24">
      <SiteHeader session={session} viewingFeed={viewingFeedConfig} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 sm:px-6">
        <SharedWatchlistHero
          signedIn={Boolean(session?.user)}
          initiallyDismissed={heroDismissed}
        />

        {session?.user ? (
          <AddEntryPanel
            name={session.user.name}
            target={shareTarget}
            existingFeedIds={existingFeedIds}
          />
        ) : null}

        <section id="signal-feed" className="space-y-6">
          <div className="">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.4em] text-white/50">
                Signal feed
              </p>
              <div className="sm:hidden">
                <FeedFilterMenu
                  activeType={typeFilterParam}
                  activeGenre={genreFilter}
                  genres={uniqueGenres}
                  activeSort={sortMode}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">
                  Latest drops ·{" "}
                  {selectedGroup ? selectedGroup.name : "Personal"}
                </h2>
                {groupMismatch ? (
                  <p className="mt-1 text-sm text-amber-300">
                    You are not part of that group. Showing personal feed
                    instead.
                  </p>
                ) : null}
              </div>
              <div className="hidden sm:flex">
                <FeedFilterMenu
                  activeType={typeFilterParam}
                  activeGenre={genreFilter}
                  genres={uniqueGenres}
                  activeSort={sortMode}
                />
              </div>
            </div>
          </div>
          {entries.length > 0 ? (
            <div className="grid gap-6">
              {entries.map((entry, index) => (
                <div
                  key={`${entry.userId}-${entry.media.tmdbId}-${
                    entry.groupId ?? "personal"
                  }`}
                  id={index === 0 ? "latest-entry" : undefined}
                >
                  <EntryCard
                    entry={entry}
                    canRemove={session?.user?.id === entry.userId}
                    canReact={Boolean(session?.user)}
                    canComment={Boolean(session?.user)}
                    currentUserId={session?.user?.id}
                    shareTargets={shareTargets}
                    animateIn={index === 0}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-white/10 p-10 text-center text-white/60">
              {entriesAllRaw.length === 0
                ? "Nobody has logged anything yet. Be the first to drop a rec!"
                : "No drops match these filters yet."}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
