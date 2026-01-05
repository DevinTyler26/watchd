import { Suspense } from "react";
import { SearchAndShare } from "@/components/search-and-share";

type ShareTarget = {
  id: string | null;
  label: string;
};

export function AddEntryPanel({
  name,
  target,
  existingFeedIds,
}: {
  name?: string | null;
  target: ShareTarget;
  existingFeedIds: string[];
}) {
  return (
    <section className="relative overflow-visible rounded-3xl border-none bg-transparent p-0 shadow-none sm:border sm:border-white/5 sm:bg-gradient-to-br sm:from-white/10 sm:via-white/5 sm:to-transparent sm:p-8 sm:shadow-2xl sm:shadow-black/30">
      <div className="space-y-2 pb-4 sm:pb-6">
        <p className="text-sm uppercase tracking-[0.4em] text-white/60">
          New drop
        </p>
        <h2 className="text-3xl font-semibold">
          Hey {name?.split(" ")[0] ?? "there"}, what did you watch & love?
        </h2>
        <p className="text-base text-white/70">
          Search TMDB, add a note, and Watchd will let your circle know exactly
          what deserves their next binge.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="text-sm text-white/60">Loading controls…</div>
        }
      >
        <SearchAndShare target={target} existingIds={existingFeedIds} />
      </Suspense>
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br from-brand via-brand-muted to-transparent opacity-40 blur-3xl" />
    </section>
  );
}
