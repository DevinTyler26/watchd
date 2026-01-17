"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { apiJson, ApiError } from "@/lib/api-client";
import { ModalShell } from "@/components/modal-shell";

type NameCaptureModalProps = {
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
};

export function NameCaptureModal({ user }: NameCaptureModalProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (user && !user.name) {
      setOpen(true);
      setName("");
      setError(null);
    }
  }, [user]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError("Please enter at least 2 characters.");
      return;
    }

    setError(null);
    startTransition(() => {
      void apiJson<{ name: string }>("/api/user/name", {
        method: "POST",
        body: JSON.stringify({ name: trimmedName }),
      })
        .then(() => {
          setOpen(false);
          router.refresh();
        })
        .catch((err) => {
          if (err instanceof ApiError) {
            setError(err.message);
            return;
          }
          setError("Unable to save your name right now.");
        });
    });
  }

  if (!open) {
    return null;
  }

  return (
    <ModalShell
      onClose={() => setOpen(false)}
      dismissable={false}
      overlayClassName="bg-black/70"
      panelClassName="w-full max-w-lg"
    >
      {() => (
        <div className="rounded-2xl border border-white/10 bg-night/95 px-6 py-8 text-white shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/50">
              Quick intro
            </p>
            <h2 className="text-2xl font-semibold">
              What should we call you?
            </h2>
            <p className="text-sm text-white/70">
              Add a display name so your circle knows who you are.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-white/80">
              Display name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/40"
                placeholder="e.g. Devin"
                disabled={isPending}
              />
            </label>
            {error ? <p className="text-sm text-rose-200">{error}</p> : null}
            <button
              type="submit"
              disabled={isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-night transition hover:bg-brand/90 disabled:opacity-60"
            >
              {isPending ? (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-night/70 border-t-transparent"
                  aria-hidden
                />
              ) : null}
              {isPending ? "Saving..." : "Save name"}
            </button>
          </form>
        </div>
      )}
    </ModalShell>
  );
}
