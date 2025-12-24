import type { GroupRole } from "@prisma/client";

import { auth } from "@/auth";
import { SiteHeader } from "@/components/header";
import { GroupManagerPanel } from "@/components/group-manager-panel";
import { getUserGroups } from "@/lib/groups";

function isPromise<T>(value: unknown): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

type SearchParams = {
  group?: string | string[];
  invite?: string | string[];
};

type GroupSummary = {
  id: string;
  name: string;
  slug: string;
  shareCode: string;
  role: GroupRole;
};

export default async function CirclesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const session = await auth();
  const resolvedParams =
    searchParams && isPromise<SearchParams>(searchParams)
      ? await searchParams
      : (searchParams as SearchParams | undefined);

  if (!session?.user?.id) {
    return (
      <div className="min-h-screen pb-24">
        <SiteHeader session={session} />
        <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6">
          <section className="rounded-3xl border border-white/10 bg-night/40 p-6 text-center text-white/80">
            <p className="text-lg font-semibold">Sign in required</p>
            <p className="mt-2 text-sm text-white/60">
              Circles are available once you log in. Use the button above to
              continue.
            </p>
          </section>
        </main>
      </div>
    );
  }

  const memberships = await getUserGroups(session.user.id);
  const groups: GroupSummary[] = memberships.map((membership) => ({
    id: membership.group.id,
    name: membership.group.name,
    slug: membership.group.slug,
    shareCode: membership.group.shareCode,
    role: membership.role,
  }));

  const requestedCodeRaw = resolvedParams?.group;
  const requestedCode = Array.isArray(requestedCodeRaw)
    ? requestedCodeRaw[0] ?? "personal"
    : requestedCodeRaw ?? "personal";
  const selectedGroup =
    requestedCode !== "personal"
      ? groups.find((group) => group.shareCode === requestedCode) ??
        groups.find((group) => group.slug === requestedCode) ??
        null
      : null;
  const inviteParamRaw = resolvedParams?.invite;
  const inviteToken = Array.isArray(inviteParamRaw)
    ? inviteParamRaw[0] ?? null
    : inviteParamRaw ?? null;
  const activeFeedCode =
    selectedGroup?.shareCode ?? selectedGroup?.slug ?? "personal";
  const groupMismatch =
    requestedCode !== "personal" && !selectedGroup && groups.length > 0;

  const viewingFeedConfig = {
    groups,
    activeCode: activeFeedCode,
  };

  return (
    <div className="min-h-screen pb-24">
      <SiteHeader session={session} viewingFeed={viewingFeedConfig} />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 text-white">
        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">
            Circles
          </p>
          <h1 className="text-4xl font-semibold">Manage your circles</h1>
          <p className="text-sm text-white/70">
            Start new circles, invite trusted people, join via token, or leave
            groups you no longer follow.
          </p>
          {groupMismatch ? (
            <p className="text-sm text-amber-300">
              You are not part of that group. Pick another from the menu above.
            </p>
          ) : null}
        </section>
        <GroupManagerPanel
          groups={groups}
          activeGroupId={selectedGroup?.id ?? null}
          activeGroupRole={selectedGroup?.role ?? null}
          initialJoinToken={inviteToken}
        />
      </main>
    </div>
  );
}
