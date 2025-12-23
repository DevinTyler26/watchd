import type { GroupRole } from "@prisma/client";

import { auth } from "@/auth";
import { SiteHeader } from "@/components/header";
import { AddEntryPanel } from "@/components/add-entry-panel";
import { EntryCard, type EntryWithUser } from "@/components/entry-card";
import { GroupSwitcher } from "@/components/group-switcher";
import { GroupManagerPanel } from "@/components/group-manager-panel";
import { prisma } from "@/lib/prisma";

function isPromise<T>(value: unknown): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

async function getLatestEntries(groupId: string | null) {
  return prisma.watchEntry.findMany({
    where: groupId ? { groupId } : { groupId: null },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, name: true, image: true },
      },
      group: {
        select: { id: true, name: true, slug: true },
      },
    },
    take: 12,
  });
}

async function getUserGroups(userId: string) {
  return prisma.groupMembership.findMany({
    where: { userId, status: "ACTIVE" },
    include: { group: true },
    orderBy: { group: { name: "asc" } },
  });
}

type SearchParams = {
  group?: string | string[];
};

type GroupSummary = {
  id: string;
  name: string;
  slug: string;
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
  const memberships = session?.user?.id
    ? await getUserGroups(session.user.id)
    : [];
  const groups: GroupSummary[] = memberships.map((membership) => ({
    id: membership.group.id,
    name: membership.group.name,
    slug: membership.group.slug,
    role: membership.role,
  }));

  const requestedSlugRaw = resolvedParams?.group;
  const requestedSlug = Array.isArray(requestedSlugRaw)
    ? requestedSlugRaw[0] ?? "personal"
    : requestedSlugRaw ?? "personal";
  const selectedGroup =
    requestedSlug !== "personal"
      ? groups.find((group) => group.slug === requestedSlug) ?? null
      : null;
  const activeSlug = selectedGroup ? selectedGroup.slug : "personal";
  const entries = (await getLatestEntries(
    selectedGroup ? selectedGroup.id : null
  )) as EntryWithUser[];
  const shareTarget = {
    id: selectedGroup ? selectedGroup.id : null,
    label: selectedGroup ? `${selectedGroup.name}` : "Personal feed",
  };
  const viewingLabel = selectedGroup ? selectedGroup.name : "Personal feed";
  const groupMismatch =
    requestedSlug !== "personal" && !selectedGroup && groups.length > 0;

  return (
    <div className="min-h-screen pb-24">
      <SiteHeader session={session} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6">
        {session?.user ? (
          <section className="space-y-6 rounded-3xl border border-white/5 bg-night/30 p-6 text-white">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                  Share destination
                </p>
                <h2 className="text-2xl font-semibold text-white">
                  {viewingLabel}
                </h2>
                {groupMismatch ? (
                  <p className="text-sm text-amber-300">
                    You are not part of that group. Showing personal feed
                    instead.
                  </p>
                ) : null}
              </div>
              <GroupSwitcher groups={groups} activeSlug={activeSlug} />
            </div>
            <GroupManagerPanel
              groups={groups}
              activeGroupId={selectedGroup?.id ?? null}
              activeGroupRole={selectedGroup?.role ?? null}
            />
          </section>
        ) : null}

        <section className="space-y-6 rounded-3xl border border-white/5 bg-midnight/60 p-8 text-white shadow-2xl shadow-black/40">
          <p className="text-sm uppercase tracking-[0.5em] text-white/60">
            Shared watchlist
          </p>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-tight">
              Watch party signal for the people you trust most.
            </h1>
            <p className="max-w-2xl text-lg text-white/70">
              Watchd keeps a living feed of movies and shows your inner circle
              swears by. Compare notes, save precious time, and never
              doom-scroll for something to watch again.
            </p>
          </div>
          {!session?.user && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
              Sign in with Google to start logging your queue and invite your
              crew.
            </div>
          )}
        </section>

        {session?.user ? (
          <AddEntryPanel name={session.user.name} target={shareTarget} />
        ) : null}

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-white/50">
                Signal feed
              </p>
              <h2 className="text-2xl font-semibold">
                Latest drops · {selectedGroup ? selectedGroup.name : "Personal"}
              </h2>
            </div>
          </div>
          {entries.length > 0 ? (
            <div className="grid gap-6">
              {entries.map((entry) => (
                <EntryCard
                  entry={entry}
                  canRemove={session?.user?.id === entry.userId}
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
