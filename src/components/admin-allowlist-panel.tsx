"use client";

import { useEffect, useMemo, useState } from "react";
import { apiJson, ApiError } from "@/lib/api-client";
import { reportClientError } from "@/lib/client-errors";

type AllowEntry = {
  email: string;
  createdAt: string;
  createdById: string | null;
};

export function AdminAllowlistPanel() {
  const [entries, setEntries] = useState<AllowEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [busy, setBusy] = useState(false);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "email">(
    "newest"
  );

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
      const { data } = await apiJson<{ allowlist: AllowEntry[] }>(
        "/api/admin/allowlist",
        { retries: 2 }
      );
      setEntries(data.allowlist ?? []);
    } catch (err) {
      if (err instanceof ApiError && err.requestId) {
        void reportClientError({
          message: err.message,
          requestId: err.requestId,
          context: { action: "load-allowlist" },
        });
      }
      setError(err instanceof Error ? err.message : "Unable to load allowlist");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function addEmail() {
    const value = email.trim().toLowerCase();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      await apiJson("/api/admin/allowlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
        retries: 1,
      });
      setEmail("");
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.requestId) {
        void reportClientError({
          message: err.message,
          requestId: err.requestId,
          context: { action: "add-allowlist" },
        });
      }
      setError(err instanceof Error ? err.message : "Unable to add email");
    } finally {
      setBusy(false);
    }
  }

  async function removeEmail(target: string) {
    setBusy(true);
    setError(null);
    try {
      await apiJson("/api/admin/allowlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
        retries: 1,
      });
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.requestId) {
        void reportClientError({
          message: err.message,
          requestId: err.requestId,
          context: { action: "remove-allowlist" },
        });
      }
      setError(err instanceof Error ? err.message : "Unable to remove email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 border-t-2 border-white/25 pt-4 text-white md:rounded-lg md:border md:border-white/10 md:bg-night/30 md:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">
            Allowlist
          </p>
          <p className="text-sm text-white/70">
            Only emails here can sign in (admins always can).
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-white/50">
          <span>{entries.length} allowed</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="person@example.com"
          className="flex-1 rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm text-white focus:border-brand focus:outline-none"
          disabled={busy}
        />
        <button
          type="button"
          onClick={addEmail}
          disabled={busy || !email.trim()}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/20 disabled:opacity-40"
        >
          Add email
        </button>
      </div>
      <div className="border-t border-dashed border-white/20" />
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
        <p className="text-sm text-white/60">Loading allowlist...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-white/60">No allowed emails yet.</p>
      ) : sortedEntries.length === 0 ? (
        <p className="text-sm text-white/60">No matching emails.</p>
      ) : (
        <ul className="space-y-2">
          {sortedEntries.map((entry) => (
            <li
              key={entry.email}
              className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold">{entry.email}</p>
                <p className="text-xs text-white/50">
                  Added {new Date(entry.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeEmail(entry.email)}
                disabled={busy}
                className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-40"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
