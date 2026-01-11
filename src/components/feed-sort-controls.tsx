"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type SortMode = "recent" | "likes";

const sortOptions: Array<{ label: string; value: SortMode }> = [
  { label: "Most recent", value: "recent" },
  { label: "Most likes", value: "likes" },
];

export function FeedSortControls({
  activeSort,
  variant = "inline",
}: {
  activeSort: SortMode;
  variant?: "inline" | "sheet";
}) {
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

  const isSheet = variant === "sheet";

  return (
    <div
      className={`inline-flex items-center gap-2 p-1 text-xs uppercase tracking-[0.3em] text-white/60 ${
        isSheet ? "w-full" : "w-fit"
      }`}
    >
      {sortOptions.map((option) => {
        const isActive = option.value === activeSort;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => updateSort(option.value)}
            className={`rounded-md px-2.5 py-1 font-semibold transition sm:px-3 ${
              isSheet ? "flex-1 text-center" : ""
            } ${
              isActive
                ? "border border-brand text-brand"
                : "border border-transparent hover:text-white/90"
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
