"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

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
      <div className="flex h-4 items-center text-xs">
        {isPending ? (
          <span className="flex items-center gap-2 text-white/50">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand" aria-hidden />
            <span className="sr-only">Switching feed</span>
          </span>
        ) : !hasGroups ? (
          <span className="text-white/50">
            Create a group below to share with your circle.
          </span>
        ) : null}
      </div>
    </label>
  );
}

export function NavGroupSwitcher({ groups, activeCode }: GroupSwitcherProps) {
  const { updateSelection, isPending } = useGroupNavigation();
  const hasGroups = groups.length > 0;
  const getValue = (group: GroupOption) =>
    group.shareCode ?? group.slug ?? group.id;
  const [isOpen, setIsOpen] = useState(false);

  const options: Array<{ value: string; label: string }> = [
    { value: "personal", label: "Personal feed" },
    ...groups.map((group) => ({ value: getValue(group), label: group.name })),
  ];

  const handleSelect = (value: string) => {
    setIsOpen(false);
    updateSelection(value);
  };

  return (
    <div className="flex flex-col gap-2 text-xs text-white/60 sm:flex-row sm:items-center sm:gap-3">
      <span className="uppercase tracking-[0.3em] text-white/40">Viewing</span>
      {/* Desktop select */}
      <div className="relative hidden sm:block">
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

      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={!hasGroups && activeCode !== "personal"}
        className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60 sm:hidden"
      >
        <span>
          {options.find((o) => o.value === activeCode)?.label ??
            "Personal feed"}
        </span>
        <span className="text-white/50">▾</span>
      </button>

      <div className="flex h-4 items-center text-xs">
        {isPending ? (
          <span className="flex items-center gap-2 text-white/50">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand" aria-hidden />
            <span className="sr-only">Switching feed</span>
          </span>
        ) : null}
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end sm:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setIsOpen(false)}
            aria-hidden
          />
          <div className="relative w-full rounded-t-3xl border border-white/10 bg-night/95 p-4 shadow-2xl shadow-black/40">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
                  Choose feed
                </p>
                <p className="text-sm text-white/70">
                  Where do you want to look?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/60"
              >
                Close
              </button>
            </div>
            <div className="space-y-2">
              {options.map((option) => {
                const isActive = option.value === activeCode;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                      isActive
                        ? "border-brand bg-brand/10 text-white"
                        : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
                    }`}
                  >
                    <span>{option.label}</span>
                    {isActive ? (
                      <span className="text-[10px] uppercase tracking-[0.3em] text-brand">
                        Current
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
