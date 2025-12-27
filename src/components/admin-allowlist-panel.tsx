"use client";

import { useEffect, useState } from "react";

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
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/allowlist");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load allowlist");
      }
      setEntries(payload.allowlist ?? []);
    } catch (err) {
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
      const response = await fetch("/api/admin/allowlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to add email");
      }
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add email");
    } finally {
      setBusy(false);
    }
  }

  async function removeEmail(target: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/allowlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to remove email");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-night/30 p-4 text-white">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">
            Allowlist
          </p>
          <p className="text-sm text-white/70">
            Only emails here can sign in (admins always can).
          </p>
        </div>
        <span className="text-xs text-white/50">{entries.length} allowed</span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="person@example.com"
          className="flex-1 rounded-2xl border border-white/10 bg-transparent px-4 py-2 text-sm text-white focus:border-brand focus:outline-none"
          disabled={busy}
        />
        <button
          type="button"
          onClick={addEmail}
          disabled={busy || !email.trim()}
          className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/20 disabled:opacity-40"
        >
          Add email
        </button>
      </div>

      {error ? (
        <p className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-white/60">Loading allowlist...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-white/60">No allowed emails yet.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.email}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-night/40 px-4 py-3"
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
                className="rounded-2xl border border-white/20 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-40"
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
