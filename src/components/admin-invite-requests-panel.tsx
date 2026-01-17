"use client";

import { useEffect, useMemo, useState } from "react";

import { apiJson, ApiError } from "@/lib/api-client";
import { reportClientError } from "@/lib/client-errors";

type InviteRequest = {
  email: string;
  createdAt: string;
  status: "PENDING" | "APPROVED" | "DECLINED";
  decidedAt: string | null;
  approvedEmailSentAt: string | null;
  decidedBy?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
};

export function AdminInviteRequestsPanel() {
  const [entries, setEntries] = useState<InviteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "email">(
    "newest"
  );
  const pendingCount = entries.filter(
    (entry) => entry.status === "PENDING"
  ).length;

  const sortedEntries = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filtered = normalizedSearch
      ? entries.filter((entry) =>
          entry.email.toLowerCase().includes(normalizedSearch)
        )
      : entries;
    const copy = [...filtered];
    switch (sortOrder) {
      case "oldest":
        return copy.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime()
        );
      case "email":
        return copy.sort((a, b) => a.email.localeCompare(b.email));
      default:
        return copy.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
        );
    }
  }, [entries, sortOrder, searchTerm]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiJson<{ requests: InviteRequest[] }>(
        "/api/admin/invite-requests",
        { retries: 2 }
      );
      setEntries(data.requests ?? []);
    } catch (err) {
      if (err instanceof ApiError && err.requestId) {
        void reportClientError({
          message: err.message,
          requestId: err.requestId,
          context: { action: "load-invite-requests" },
        });
      }
      setError(
        err instanceof Error ? err.message : "Unable to load invite requests"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function approveRequest(email: string) {
    setBusyEmail(email);
    setError(null);
    try {
      await apiJson<{ emailSent?: boolean }>("/api/admin/invite-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        retries: 1,
      });
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.requestId) {
        void reportClientError({
          message: err.message,
          requestId: err.requestId,
          context: { action: "approve-invite-request", email },
        });
      }
      setError(
        err instanceof Error ? err.message : "Unable to approve request"
      );
    } finally {
      setBusyEmail(null);
    }
  }

  async function resendApprovalEmail(email: string) {
    setBusyEmail(email);
    setError(null);
    try {
      await apiJson<{ emailSent?: boolean }>("/api/admin/invite-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, action: "resend" }),
        retries: 1,
      });
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.requestId) {
        void reportClientError({
          message: err.message,
          requestId: err.requestId,
          context: { action: "resend-invite-request", email },
        });
      }
      setError(
        err instanceof Error ? err.message : "Unable to resend email"
      );
    } finally {
      setBusyEmail(null);
    }
  }

  async function declineRequest(email: string) {
    setBusyEmail(email);
    setError(null);
    try {
      await apiJson("/api/admin/invite-requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        retries: 1,
      });
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.requestId) {
        void reportClientError({
          message: err.message,
          requestId: err.requestId,
          context: { action: "decline-invite-request", email },
        });
      }
      setError(
        err instanceof Error ? err.message : "Unable to decline request"
      );
    } finally {
      setBusyEmail(null);
    }
  }

  return (
    <div className="space-y-4 border-t-2 border-white/25 pt-4 text-white md:rounded-lg md:border md:border-white/10 md:bg-night/30 md:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">
            Invite requests
          </p>
          <p className="text-sm text-white/70">
            Emails submitted from the access request form.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-white/50">
          <span>{pendingCount} pending</span>
          <span>{entries.length} total</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search email"
          className="flex-1 rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
        />
        <div className="flex items-center gap-3 text-xs text-white/50">
          <label className="flex items-center gap-2">
            <span className="hidden uppercase tracking-[0.3em] text-white/40 sm:inline">
              Sort
            </span>
            <select
              value={sortOrder}
              onChange={(event) =>
                setSortOrder(event.target.value as typeof sortOrder)
              }
              className="rounded-lg border border-white/10 bg-night/60 px-2 py-1 text-xs text-white focus:border-brand focus:outline-none"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="email">Email</option>
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-white/60">Loading invite requests...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-white/60">No invite requests yet.</p>
      ) : sortedEntries.length === 0 ? (
        <p className="text-sm text-white/60">No matching emails.</p>
      ) : (
        <ul className="space-y-2">
          {sortedEntries.map((entry) => {
            const decidedByLabel =
              entry.decidedBy?.name ??
              entry.decidedBy?.email ??
              "Admin";
            const decidedAt = entry.decidedAt
              ? new Date(entry.decidedAt).toLocaleString()
              : null;
            const approvedSentAt = entry.approvedEmailSentAt
              ? new Date(entry.approvedEmailSentAt).toLocaleString()
              : null;
            return (
              <li
                key={entry.email}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/5 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">{entry.email}</p>
                  <p className="text-xs text-white/50">
                    Requested {new Date(entry.createdAt).toLocaleString()}
                  </p>
                  {entry.status === "PENDING" ? (
                    <p className="text-xs text-sky-200">Pending review</p>
                  ) : entry.status === "APPROVED" ? (
                    <p className="text-xs text-emerald-200">
                      Approved by {decidedByLabel}
                      {decidedAt ? ` · ${decidedAt}` : ""}
                      {approvedSentAt ? ` · email sent ${approvedSentAt}` : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-200">
                      Declined by {decidedByLabel}
                      {decidedAt ? ` · ${decidedAt}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {entry.status === "PENDING" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => declineRequest(entry.email)}
                        disabled={busyEmail === entry.email}
                        className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:bg-white/10 disabled:opacity-40"
                      >
                        {busyEmail === entry.email ? "Working..." : "Decline"}
                      </button>
                      <button
                        type="button"
                        onClick={() => approveRequest(entry.email)}
                        disabled={busyEmail === entry.email}
                        className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/10 disabled:opacity-40"
                      >
                        {busyEmail === entry.email ? "Approving..." : "Approve"}
                      </button>
                    </>
                  ) : entry.status === "APPROVED" ? (
                    <button
                      type="button"
                      onClick={() => resendApprovalEmail(entry.email)}
                      disabled={busyEmail === entry.email}
                      className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/10 disabled:opacity-40"
                    >
                      {busyEmail === entry.email ? "Sending..." : "Resend email"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
