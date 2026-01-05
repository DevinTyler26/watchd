"use client";

import { useEffect, useRef } from "react";
import { getCachedComments, setCachedComments } from "@/lib/comments-cache";

export function CommentPrefetch({ entryId }: { entryId: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const target = ref.current;
    if (!target) {
      return;
    }
    if (getCachedComments(entryId)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          return;
        }
        observer.disconnect();
        void (async () => {
          try {
            const response = await fetch(
              `/api/watchlist/${entryId}/comments`,
              { cache: "no-store" }
            );
            const payload = await response.json();
            if (!response.ok) {
              return;
            }
            if (Array.isArray(payload.comments)) {
              setCachedComments(entryId, payload.comments);
            }
          } catch {
            // Best-effort prefetch only.
          }
        })();
      },
      { rootMargin: "200px" }
    );

    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [entryId]);

  return <span ref={ref} className="sr-only" aria-hidden="true" />;
}
