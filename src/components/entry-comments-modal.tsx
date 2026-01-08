"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { EntryComments } from "@/components/entry-comments";
import { apiJson, ApiError } from "@/lib/api-client";
import { reportClientError } from "@/lib/client-errors";
import { getCachedComments, setCachedComments } from "@/lib/comments-cache";
import { commentsResponseSchema } from "@/lib/comment-schemas";

type EntryCommentsModalProps = {
  entryId: string;
  canComment: boolean;
  currentUserId?: string | null;
  title: string;
};

type CommentPayload = {
  id: string;
  body: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
};

export function EntryCommentsModal({
  entryId,
  canComment,
  currentUserId,
  title,
}: EntryCommentsModalProps) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number>(0);
  const [mounted, setMounted] = useState(false);
  const [prefetchedComments, setPrefetchedComments] = useState<
    CommentPayload[] | undefined
  >(undefined);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadComments() {
      const cached = getCachedComments(entryId);
      if (cached) {
        if (!cancelled) {
          setPrefetchedComments(cached);
          setCount(cached.length);
        }
        return;
      }
      try {
        if (!cancelled) {
          const { data } = await apiJson<{ comments: CommentPayload[] }>(
            `/api/watchlist/${entryId}/comments`,
            { cache: "no-store", retries: 2 },
            commentsResponseSchema
          );
          const comments = Array.isArray(data.comments)
            ? (data.comments as CommentPayload[])
            : [];
          setPrefetchedComments(comments);
          setCount(comments.length);
          setCachedComments(entryId, comments);
        }
      } catch (err) {
        if (err instanceof ApiError && err.requestId) {
          void reportClientError({
            message: err.message,
            requestId: err.requestId,
            context: { entryId, action: "prefetch-comments" },
          });
        }
        if (!cancelled) {
          setCount(0);
          setPrefetchedComments(undefined);
        }
      }
    }
    void loadComments();
    return () => {
      cancelled = true;
    };
  }, [entryId]);

  useEffect(() => {
    if (!open) return;
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeydown);
    return () => {
      document.removeEventListener("keydown", onKeydown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 transition hover:text-white"
      >
        <span className="sr-only">Comments</span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />
        </svg>
        <span className="text-xs font-mono text-white/60">{count}</span>
      </button>
      {open && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 px-6 py-8"
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  setOpen(false);
                }
              }}
            >
              <div className="w-full max-w-2xl rounded-lg border border-white/10 bg-night/95 p-6 text-white shadow-2xl shadow-black/40">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                      Comments
                    </p>
                    <p className="mt-2 text-2xl font-semibold">{title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-white/40 transition hover:text-white"
                  >
                    <span className="sr-only">Close</span>
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 6l12 12" />
                      <path d="M18 6 6 18" />
                    </svg>
                  </button>
                </div>
                <div className="mt-4">
                  <EntryComments
                    entryId={entryId}
                    canComment={canComment}
                    currentUserId={currentUserId}
                    onCountChange={setCount}
                    onCommentsChange={(comments) => {
                      setPrefetchedComments(comments);
                      setCachedComments(entryId, comments);
                    }}
                    hideHeader
                    containerClassName="space-y-2 bg-transparent p-0"
                    initialComments={prefetchedComments}
                  />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
