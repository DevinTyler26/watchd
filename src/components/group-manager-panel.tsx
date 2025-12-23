"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type GroupSummary = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

type Props = {
  groups: GroupSummary[];
  activeGroupId: string | null;
  activeGroupRole: string | null;
};

export function GroupManagerPanel({
  groups,
  activeGroupId,
  activeGroupRole,
}: Props) {
  const router = useRouter();
  const [createName, setCreateName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [joinToken, setJoinToken] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);
    if (createName.trim().length < 2) {
      setStatusMessage("Group names need at least two characters.");
      return;
    }

    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatusMessage(payload.error ?? "Unable to create group.");
        return;
      }

      setCreateName("");
      setStatusMessage(`Created ${payload.group.name}.`);
      router.refresh();
    } catch {
      setStatusMessage("Network issue creating the group.");
    }
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);
    if (!activeGroupId) {
      setStatusMessage("Choose a group first.");
      return;
    }

    try {
      const response = await fetch(`/api/groups/${activeGroupId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase() }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatusMessage(payload.error ?? "Unable to send invite.");
        return;
      }

      setInviteEmail("");
      setStatusMessage(`Invite ready. Share code: ${payload.token}`);
    } catch {
      setStatusMessage("Network issue sending the invite.");
    }
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);
    if (joinToken.trim().length === 0) {
      setStatusMessage("Paste the invite token to join.");
      return;
    }

    try {
      const response = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: joinToken.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatusMessage(payload.error ?? "Unable to join group.");
        return;
      }

      setJoinToken("");
      setStatusMessage(`Joined ${payload.group.name}.`);
      router.refresh();
    } catch {
      setStatusMessage("Network issue joining the group.");
    }
  }

  const summaryText =
    groups.length === 0
      ? "No circles yet—start one below."
      : `${groups.length} active ${
          groups.length === 1 ? "circle" : "circles"
        }.`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/60">{summaryText}</p>
      <div className="grid gap-6 lg:grid-cols-3">
        <form
          onSubmit={handleCreate}
          className="space-y-2 rounded-2xl border border-white/10 bg-night/30 p-4"
        >
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">
            Start a group
          </p>
          <input
            type="text"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            placeholder="e.g. Family Signal"
            className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-2 text-sm text-white focus:border-brand focus:outline-none"
          />
          <button
            type="submit"
            className="w-full rounded-2xl bg-brand px-4 py-2 text-sm font-semibold uppercase tracking-widest text-night"
          >
            Create
          </button>
        </form>

        <form
          onSubmit={handleInvite}
          className="space-y-2 rounded-2xl border border-white/10 bg-night/30 p-4"
        >
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">
            Invite someone
          </p>
          <input
            type="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="friend@example.com"
            className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-2 text-sm text-white focus:border-brand focus:outline-none"
            disabled={!activeGroupId || activeGroupRole !== "OWNER"}
          />
          <button
            type="submit"
            disabled={!activeGroupId || activeGroupRole !== "OWNER"}
            className="w-full rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-white disabled:opacity-40"
          >
            Send invite
          </button>
          {!activeGroupId ? (
            <p className="text-xs text-white/50">
              Select a group to invite people.
            </p>
          ) : activeGroupRole !== "OWNER" ? (
            <p className="text-xs text-white/50">Only owners can invite.</p>
          ) : null}
        </form>

        <form
          onSubmit={handleJoin}
          className="space-y-2 rounded-2xl border border-white/10 bg-night/30 p-4"
        >
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">
            Join via token
          </p>
          <input
            type="text"
            value={joinToken}
            onChange={(event) => setJoinToken(event.target.value)}
            placeholder="Paste invite token"
            className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-2 text-sm text-white focus:border-brand focus:outline-none"
          />
          <button
            type="submit"
            className="w-full rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-white"
          >
            Join group
          </button>
        </form>

        {statusMessage ? (
          <p className="lg:col-span-3 rounded-2xl border border-white/10 bg-night/30 p-3 text-center text-sm text-white/80">
            {statusMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
