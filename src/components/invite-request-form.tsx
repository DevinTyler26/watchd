"use client";

import { useState, useTransition } from "react";

import { apiJson, ApiError } from "@/lib/api-client";

type InviteRequestFormProps = {
  initialEmail?: string | null;
};

type InviteResponse = {
  requested?: boolean;
  alreadyRequested?: boolean;
};

export function InviteRequestForm({ initialEmail }: InviteRequestFormProps) {
  const lockedEmail = initialEmail?.trim().toLowerCase() ?? "";
  const [status, setStatus] = useState<"idle" | "sent" | "exists">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lockedEmail) {
      setError("Sign in again so we can capture your email.");
      return;
    }

    setError(null);
    startTransition(() => {
      void apiJson<InviteResponse>("/api/invite-request", {
        method: "POST",
        body: JSON.stringify({ email: lockedEmail }),
      })
        .then((response) => {
          if (response.data?.alreadyRequested) {
            setStatus("exists");
            return;
          }
          setStatus("sent");
        })
        .catch((err) => {
          if (err instanceof ApiError) {
            setError(err.message);
            return;
          }
          setError("Unable to submit request right now.");
        });
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-xs uppercase tracking-[0.35em] text-white/50">
        Request an invite
        <input
          type="email"
          value={lockedEmail}
          placeholder="you@example.com"
          className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/40"
          readOnly
          disabled
          required={Boolean(lockedEmail)}
        />
      </label>
      {error ? <p className="text-sm text-rose-200">{error}</p> : null}
      {status === "sent" ? (
        <p className="text-sm text-emerald-200">
          Request received. We will reach out when your invite is ready.
        </p>
      ) : null}
      {status === "exists" ? (
        <p className="text-sm text-sky-200">
          We already have your request. Sit tight and watch your inbox.
        </p>
      ) : null}
      {status === "idle" ? (
        <p className="text-sm text-white/60">
          We usually respond within 1-2 business days.
        </p>
      ) : null}
      {!lockedEmail && status === "idle" ? (
        <p className="text-sm text-white/70">
          Sign in with email again to auto-fill your request.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isPending || status !== "idle" || !lockedEmail}
        className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-white transition hover:bg-white/20 disabled:opacity-60"
      >
        {isPending ? "Sending..." : "Request invite"}
      </button>
    </form>
  );
}
