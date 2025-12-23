"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type GroupOption = {
  id: string;
  name: string;
  slug: string;
};

type GroupSwitcherProps = {
  groups: GroupOption[];
  activeSlug: string;
};

export function GroupSwitcher({ groups, activeSlug }: GroupSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateSelection(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "personal") {
      next.delete("group");
    } else {
      next.set("group", value);
    }

    startTransition(() => {
      const query = next.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  const hasGroups = groups.length > 0;

  return (
    <label className="flex flex-col gap-2 text-sm text-white/70">
      <span className="uppercase tracking-[0.3em] text-xs text-white/50">
        Viewing feed
      </span>
      <select
        value={activeSlug}
        onChange={(event) => updateSelection(event.target.value)}
        disabled={!hasGroups && activeSlug !== "personal"}
        className="rounded-2xl border border-white/10 bg-night/40 px-4 py-3 text-base text-white focus:border-brand focus:outline-none disabled:opacity-60"
      >
        <option value="personal">Personal feed</option>
        {groups.map((group) => (
          <option key={group.id} value={group.slug}>
            {group.name}
          </option>
        ))}
      </select>
      {isPending ? (
        <span className="text-xs uppercase tracking-[0.3em] text-white/40">
          Switching…
        </span>
      ) : !hasGroups ? (
        <span className="text-xs text-white/50">
          Create a group below to share with your circle.
        </span>
      ) : null}
    </label>
  );
}
