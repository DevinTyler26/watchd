"use client";

import { useEffect, useRef } from "react";
import { apiJson } from "@/lib/api-client";
import { getCachedComments, setCachedComments } from "@/lib/comments-cache";
import { commentsResponseSchema } from "@/lib/comment-schemas";

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
            const { data } = await apiJson<{ comments: unknown[] }>(
              `/api/watchlist/${entryId}/comments`,
              { cache: "no-store", retries: 1 },
              commentsResponseSchema
            );
            if (Array.isArray(data.comments)) {
              setCachedComments(entryId, data.comments);
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
