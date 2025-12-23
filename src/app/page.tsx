import { auth } from "@/auth";
import { SiteHeader } from "@/components/header";
import { AddEntryPanel } from "@/components/add-entry-panel";
import { EntryCard, type EntryWithUser } from "@/components/entry-card";
import { prisma } from "@/lib/prisma";

async function getLatestEntries() {
  return prisma.watchEntry.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, name: true, image: true },
      },
    },
    take: 12,
  });
}

export default async function Home() {
  const session = await auth();
  const entries = (await getLatestEntries()) as EntryWithUser[];

  return (
    <div className="min-h-screen pb-24">
      <SiteHeader session={session} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6">
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

        {session?.user ? <AddEntryPanel name={session.user.name} /> : null}

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-white/50">
                Signal feed
              </p>
              <h2 className="text-2xl font-semibold">Latest drops</h2>
            </div>
          </div>
          {entries.length > 0 ? (
            <div className="grid gap-6">
              {entries.map((entry) => (
                <EntryCard
                  entry={entry}
                  key={`${entry.userId}-${entry.imdbId}`}
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
