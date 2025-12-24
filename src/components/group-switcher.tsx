"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type GroupOption = {
  id: string;
  name: string;
  shareCode?: string | null;
  slug?: string | null;
};

type GroupSwitcherProps = {
  groups: GroupOption[];
  activeCode: string;
};

function useGroupNavigation() {
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

  return { updateSelection, isPending } as const;
}

export function GroupSwitcher({ groups, activeCode }: GroupSwitcherProps) {
  const { updateSelection, isPending } = useGroupNavigation();

  const hasGroups = groups.length > 0;
  const getValue = (group: GroupOption) =>
    group.shareCode ?? group.slug ?? group.id;

  return (
    <label className="flex flex-col gap-2 text-sm text-white/70">
      <span className="uppercase tracking-[0.3em] text-xs text-white/50">
        Viewing feed
      </span>
      <select
        value={activeCode}
        onChange={(event) => updateSelection(event.target.value)}
        disabled={!hasGroups && activeCode !== "personal"}
        className="rounded-2xl border border-white/10 bg-night/40 px-4 py-3 text-base text-white focus:border-brand focus:outline-none disabled:opacity-60"
      >
        <option value="personal">Personal feed</option>
        {groups.map((group) => (
          <option key={group.id} value={getValue(group)}>
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

export function NavGroupSwitcher({ groups, activeCode }: GroupSwitcherProps) {
  const { updateSelection, isPending } = useGroupNavigation();
  const hasGroups = groups.length > 0;
  const getValue = (group: GroupOption) =>
    group.shareCode ?? group.slug ?? group.id;

  return (
    <div className="flex flex-col gap-1 text-xs text-white/60 sm:flex-row sm:items-center sm:gap-3">
      <span className="uppercase tracking-[0.3em] text-white/40">Viewing</span>
      <div className="relative">
        <select
          value={activeCode}
          onChange={(event) => updateSelection(event.target.value)}
          disabled={!hasGroups && activeCode !== "personal"}
          className="appearance-none rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white focus:border-brand focus:outline-none disabled:opacity-60"
        >
          <option value="personal">Personal feed</option>
          {groups.map((group) => (
            <option key={group.id} value={getValue(group)}>
              {group.name}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/50">
          ▾
        </span>
      </div>
      {isPending ? (
        <span className="text-xs uppercase tracking-[0.3em] text-white/40">
          Switching…
        </span>
      ) : null}
    </div>
  );
}
