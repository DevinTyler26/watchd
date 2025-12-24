import Link from "next/link";
import type { GroupRole } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { SiteHeader } from "@/components/header";
import { AddEntryPanel } from "@/components/add-entry-panel";
import { EntryCard, type EntryWithUser } from "@/components/entry-card";
import { FeedSortControls } from "@/components/feed-sort-controls";
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

type FeedEntryQuery = Prisma.WatchEntryGetPayload<{
  include: {
    user: {
      select: { id: true; name: true; image: true };
    };
    group: {
      select: { id: true; name: true; slug: true };
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
} satisfies Prisma.WatchEntryInclude;

async function getLatestEntries(
  groupId: string | null,
  viewerId: string | null
): Promise<FeedEntryQuery[]> {
  if (!groupId && !viewerId) {
    return [];
  }

  const where = groupId
    ? { groupId }
    : { groupId: null, userId: viewerId ?? "__none__" };
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

type SearchParams = {
  group?: string | string[];
  sort?: string;
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
  const entriesRaw = await getLatestEntries(baseGroupId, viewerId);
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
  const viewerEntryImdbIds =
    viewerId && entriesRaw.length
      ? Array.from(
          new Set(
            entriesRaw
              .filter((entry) => entry.userId === viewerId)
              .map((entry) => entry.imdbId)
          )
        )
      : [];
  const sharedGroupsByImdb = new Map<
    string,
    Array<{ id: string; name: string }>
  >();
  if (viewerId && viewerEntryImdbIds.length) {
    const sharedRows = await prisma.watchEntry.findMany({
      where: {
        userId: viewerId,
        imdbId: { in: viewerEntryImdbIds },
        groupId: { not: null },
      },
      select: {
        imdbId: true,
        group: {
          select: { id: true, name: true },
        },
      },
    });
    sharedRows.forEach((row) => {
      if (!row.group) {
        return;
      }
      const existing = sharedGroupsByImdb.get(row.imdbId) ?? [];
      sharedGroupsByImdb.set(row.imdbId, [...existing, row.group]);
    });
  }
  const entries: EntryWithUser[] = entriesRaw.map((entry) => {
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
        entry.userId === viewerId
          ? sharedGroupsByImdb.get(entry.imdbId) ?? []
          : undefined,
    };
  });

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
    new Set(entries.map((entry) => entry.imdbId))
  );
  const shareTarget = {
    id: selectedGroup ? selectedGroup.id : null,
    label: selectedGroup ? `${selectedGroup.name}` : "Personal feed",
  };
  const viewingLabel = selectedGroup ? selectedGroup.name : "Personal feed";
  const groupMismatch =
    requestedCode !== "personal" && !selectedGroup && groups.length > 0;

  const viewingFeedConfig = session?.user
    ? { groups, activeCode: activeFeedCode }
    : undefined;

  return (
    <div className="min-h-screen pb-24">
      <SiteHeader session={session} viewingFeed={viewingFeedConfig} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6">
        {session?.user ? (
          <section className="space-y-4 rounded-3xl border border-white/5 bg-night/30 p-6 text-white">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                  Share destination
                </p>
                <h2 className="text-2xl font-semibold text-white">
                  {viewingLabel}
                </h2>
                <p className="text-sm text-white/60">
                  {groups.length === 0
                    ? "No circles yet—create one to start sharing."
                    : `${groups.length} active ${
                        groups.length === 1 ? "circle" : "circles"
                      } available.`}
                </p>
              </div>
              <Link
                href={
                  activeFeedCode !== "personal"
                    ? `/circles?group=${activeFeedCode}`
                    : "/circles"
                }
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/20"
              >
                Manage circles
              </Link>
            </div>
          </section>
        ) : null}

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
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-white/50">
                Signal feed
              </p>
              <h2 className="text-2xl font-semibold">
                Latest drops · {selectedGroup ? selectedGroup.name : "Personal"}
              </h2>
              {groupMismatch ? (
                <p className="mt-1 text-sm text-amber-300">
                  You are not part of that group. Showing personal feed instead.
                </p>
              ) : null}
            </div>
            <FeedSortControls activeSort={sortMode} />
          </div>
          {entries.length > 0 ? (
            <div className="grid gap-6">
              {entries.map((entry) => (
                <EntryCard
                  entry={entry}
                  canRemove={session?.user?.id === entry.userId}
                  canReact={Boolean(session?.user)}
                  shareTargets={shareTargets}
                  key={`${entry.userId}-${entry.imdbId}-${
                    entry.groupId ?? "personal"
                  }`}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-white/60">
              Nobody has logged anything yet. Be the first to drop a rec!
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
