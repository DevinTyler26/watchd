import Image from "next/image";
import type { WatchEntry, User } from "@prisma/client";
import { relativeTimeFromNow } from "@/lib/time";

export type EntryWithUser = WatchEntry & {
  user: Pick<User, "id" | "name" | "image">;
};

export function EntryCard({ entry }: { entry: EntryWithUser }) {
  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-white/5 bg-white/5 p-6 shadow-xl shadow-black/30">
      <div className="flex items-center gap-4">
        {entry.user.image ? (
          <Image
            src={entry.user.image}
            alt={entry.user.name ?? "Profile"}
            width={48}
            height={48}
            className="rounded-2xl border border-white/20"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 text-lg font-semibold uppercase text-white/70">
            {(entry.user.name ?? "?").charAt(0)}
          </div>
        )}
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">
            {entry.user.name ?? "A friend"}
          </p>
          <p className="text-xs text-white/50">
            {relativeTimeFromNow(entry.createdAt)}
          </p>
        </div>
      </div>
      <div className="flex items-start gap-4">
        {entry.posterUrl ? (
          <Image
            src={entry.posterUrl}
            alt={entry.title}
            width={96}
            height={140}
            className="rounded-2xl border border-white/10 object-cover"
          />
        ) : (
          <div className="flex h-[140px] w-[96px] items-center justify-center rounded-2xl border border-dashed border-white/15 text-xs text-white/50">
            No poster
          </div>
        )}
        <div className="space-y-2">
          <div>
            <p className="text-lg font-semibold text-white">
              {entry.title}
              {entry.year ? (
                <span className="text-white/50"> · {entry.year}</span>
              ) : null}
            </p>
            <p className="text-xs uppercase tracking-[0.4em] text-white/50">
              {entry.type}
            </p>
          </div>
          <p className="rounded-2xl bg-night/60 p-4 text-sm text-white/80">
            {entry.review ??
              (entry.liked ? "Loved it!" : "Mixed feelings but worth noting.")}
          </p>
          <p className="text-xs font-mono uppercase tracking-[0.5em] text-white/40">
            {entry.liked ? "LIKED" : "ON THE FENCE"}
          </p>
        </div>
      </div>
    </article>
  );
}
