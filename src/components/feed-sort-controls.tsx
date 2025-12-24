"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type SortMode = "recent" | "likes";

const sortOptions: Array<{ label: string; value: SortMode }> = [
  { label: "Most recent", value: "recent" },
  { label: "Most likes", value: "likes" },
];

export function FeedSortControls({ activeSort }: { activeSort: SortMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateSort = (value: SortMode) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "recent") {
      params.delete("sort");
    } else {
      params.set("sort", value);
    }
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 text-xs uppercase tracking-[0.3em] text-white/60">
      {sortOptions.map((option) => {
        const isActive = option.value === activeSort;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => updateSort(option.value)}
            className={`rounded-full px-3 py-1 font-semibold transition ${
              isActive ? "bg-white text-night" : "hover:text-white/90"
            }`}
            aria-pressed={isActive}
            disabled={isActive}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
