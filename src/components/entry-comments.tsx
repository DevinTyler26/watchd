"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";

import { relativeTimeFromNow } from "@/lib/time";

type CommentUser = {
  id: string;
  name: string | null;
  image: string | null;
};

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  user: CommentUser;
};

type EntryCommentsProps = {
  entryId: string;
  canComment: boolean;
  currentUserId?: string | null;
};

export function EntryComments({
  entryId,
  canComment,
  currentUserId,
}: EntryCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/watchlist/${entryId}/comments`, {
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load comments");
        }
        if (!cancelled) {
          setComments(
            Array.isArray(payload.comments)
              ? payload.comments.map((comment: Comment) => ({
                  ...comment,
                  createdAt: comment.createdAt,
                }))
              : []
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load comments"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [entryId]);

  useEffect(() => {
    if (comments.length > 0) {
      setShowForm(true);
    }
  }, [comments.length]);

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/watchlist/${entryId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to add comment");
      }
      if (payload.comment) {
        setComments((prev) => [...prev, payload.comment]);
        setDraft("");
        setShowForm(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add comment");
    } finally {
      setSubmitting(false);
    }
  }

  const hasComments = comments.length > 0;
  const showAddButton = !hasComments && !loading && canComment && !showForm;

  const stackGap = hasComments ? "space-y-2" : "space-y-1";

  const isOwner = (userId: string) =>
    Boolean(currentUserId && currentUserId === userId);

  function startEdit(comment: Comment) {
    setEditingId(comment.id);
    setEditDraft(comment.body);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
  }

  async function saveEdit(commentId: string) {
    if (!editDraft.trim() || editSubmitting) return;
    setEditSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/watchlist/${entryId}/comments/${commentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: editDraft.trim() }),
        }
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update comment");
      }
      if (payload.comment) {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? payload.comment : c))
        );
        cancelEdit();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update comment");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function deleteComment(commentId: string) {
    if (deletingId) return;
    setDeletingId(commentId);
    setError(null);
    try {
      const response = await fetch(
        `/api/watchlist/${entryId}/comments/${commentId}`,
        {
          method: "DELETE",
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete comment");
      }
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      if (editingId === commentId) {
        cancelEdit();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete comment");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div
      className={`${stackGap} rounded-2xl border border-white/10 bg-night/40 p-3`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="mt-1 text-[11px] uppercase tracking-[0.32em] text-white/50">
          Comments
        </p>
        <div className="flex items-start gap-2 self-start">
          {loading ? (
            <span className="text-[10px] text-white/50">Loading…</span>
          ) : null}
          {showAddButton ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white transition hover:bg-white/15"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-sm">
                +
              </span>
              Add comment
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
          {error}
        </p>
      ) : null}

      {hasComments ? (
        <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-2">
              {comment.user.image ? (
                <Image
                  src={comment.user.image}
                  alt={comment.user.name ?? "Commenter"}
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-lg border border-white/20 object-cover"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/20 text-[11px] font-semibold uppercase text-white/70">
                  {(comment.user.name ?? "?").charAt(0)}
                </div>
              )}
              <div className="flex-1 rounded-lg bg-white/5 px-3 py-2">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-white/40">
                  <span className="truncate">
                    {comment.user.name ?? "Someone"}
                  </span>
                  <span>
                    {relativeTimeFromNow(new Date(comment.createdAt))}
                  </span>
                </div>
                {editingId === comment.id ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={editDraft}
                      onChange={(event) => setEditDraft(event.target.value)}
                      className="w-full rounded-xl border border-white/20 bg-white/5 px-2 py-2 text-sm text-white focus:border-brand focus:outline-none"
                      rows={2}
                      maxLength={500}
                      disabled={editSubmitting}
                    />
                    <div className="flex justify-end gap-2 text-[11px] uppercase tracking-[0.24em]">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-lg border border-white/15 px-3 py-1 text-white/70 hover:bg-white/10"
                        disabled={editSubmitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEdit(comment.id)}
                        disabled={editSubmitting || !editDraft.trim()}
                        className="rounded-lg bg-white/15 px-3 py-1 font-semibold text-white hover:bg-white/25 disabled:opacity-60"
                      >
                        {editSubmitting ? "Saving" : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 space-y-2">
                    <p className="text-sm leading-snug text-white/80">
                      {comment.body}
                    </p>
                    {canComment && isOwner(comment.user.id) ? (
                      <div className="flex gap-3 text-[11px] uppercase tracking-[0.24em] text-white/50">
                        <button
                          type="button"
                          onClick={() => startEdit(comment)}
                          className="transition hover:text-white"
                          disabled={Boolean(editingId)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteComment(comment.id)}
                          className="transition hover:text-rose-200"
                          disabled={
                            deletingId === comment.id || Boolean(editingId)
                          }
                        >
                          {deletingId === comment.id ? "Deleting" : "Delete"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : !loading ? (
        <p className="text-sm text-white/60">No comments yet.</p>
      ) : null}

      {showForm ? (
        <form onSubmit={submitComment} className="space-y-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={canComment ? "Add a comment" : "Sign in to comment"}
            disabled={!canComment || submitting}
            className="w-full rounded-2xl border border-white/15 bg-transparent px-3 py-2 text-sm text-white focus:border-brand focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            rows={2}
            maxLength={500}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!canComment || submitting || !draft.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    aria-hidden
                  />
                  Posting
                </>
              ) : (
                "Post comment"
              )}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
