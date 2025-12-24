"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

type GroupSummary = {
  id: string;
  name: string;
  shareCode: string;
  role: string;
};

type Props = {
  groups: GroupSummary[];
  activeGroupId: string | null;
  activeGroupRole: string | null;
  initialJoinToken?: string | null;
};

export function GroupManagerPanel({
  groups,
  activeGroupId,
  activeGroupRole,
  initialJoinToken = null,
}: Props) {
  const router = useRouter();
  const [createName, setCreateName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [joinToken, setJoinToken] = useState(initialJoinToken ?? "");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<{
    name: string;
    shareCode: string;
  } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState<GroupSummary | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [autoJoinTriggered, setAutoJoinTriggered] = useState(false);

  const attemptJoinToken = useCallback(
    async (token: string, options?: { fromLink?: boolean }) => {
      const trimmed = token.trim();
      if (trimmed.length === 0) {
        setStatusMessage("Paste the invite token to join.");
        return;
      }

      setStatusMessage(
        options?.fromLink ? "Joining you via invite link..." : null
      );

      try {
        const response = await fetch("/api/groups/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: trimmed }),
        });
        const payload = await response.json();
        if (!response.ok) {
          setStatusMessage(payload.error ?? "Unable to join group.");
          return;
        }

        setJoinToken("");
        setStatusMessage(null);
        if (payload?.group?.name && payload?.group?.shareCode) {
          setJoinSuccess({
            name: payload.group.name,
            shareCode: payload.group.shareCode,
          });
        }
        router.refresh();
      } catch {
        setStatusMessage("Network issue joining the group.");
      } finally {
        if (options?.fromLink) {
          router.replace("/circles");
        }
      }
    },
    [router]
  );

  useEffect(() => {
    if (!initialJoinToken || autoJoinTriggered) {
      return;
    }
    setJoinToken(initialJoinToken);
    setAutoJoinTriggered(true);
    void attemptJoinToken(initialJoinToken, { fromLink: true });
  }, [initialJoinToken, autoJoinTriggered, attemptJoinToken]);

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

    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setStatusMessage("Enter an email to invite.");
      return;
    }

    try {
      const response = await fetch(`/api/groups/${activeGroupId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatusMessage(payload.error ?? "Unable to send invite.");
        return;
      }

      setInviteEmail("");
      if (payload.emailSent) {
        setStatusMessage(`Invite sent to ${normalizedEmail}.`);
      } else {
        setStatusMessage(`Invite ready. Share token: ${payload.token}`);
      }
    } catch {
      setStatusMessage("Network issue sending the invite.");
    }
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);
    await attemptJoinToken(joinToken);
  }

  async function confirmLeaveGroup() {
    if (!confirmLeave) {
      return;
    }

    setStatusMessage(null);
    setIsLeaving(true);

    try {
      const response = await fetch(`/api/groups/${confirmLeave.id}/leave`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatusMessage(payload.error ?? "Unable to leave group.");
        setIsLeaving(false);
        return;
      }

      setStatusMessage(`Left ${confirmLeave.name}.`);
      const leftGroupId = confirmLeave.id;
      setConfirmLeave(null);
      if (leftGroupId === activeGroupId) {
        void router.push("/");
      }
      router.refresh();
    } catch {
      setStatusMessage("Network issue leaving the group.");
    } finally {
      setIsLeaving(false);
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

      <div className="space-y-4 rounded-2xl border border-white/10 bg-night/30 p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/50">
              Your circles
            </p>
            <p className="text-sm text-white/60">
              Leave any group you no longer want to follow.
            </p>
          </div>
          <span className="text-xs text-white/50">{groups.length} joined</span>
        </div>
        {groups.length ? (
          <ul className="space-y-3">
            {groups.map((group) => (
              <li
                key={group.id}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-night/40 px-4 py-3"
              >
                <div>
                  <p className="text-base font-semibold text-white">
                    {group.name}
                  </p>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                    {group.role === "OWNER" ? "Owner" : "Member"}
                  </p>
                </div>
                {group.role === "OWNER" ? (
                  <span className="text-xs text-white/50">
                    Owners can&apos;t leave
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusMessage(null);
                      setConfirmLeave(group);
                    }}
                    className="rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Leave group
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-white/60">
            You&apos;re not in any shared circles yet. Create one or accept an
            invite.
          </p>
        )}
      </div>

      {joinSuccess ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 py-8">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-night/90 p-8 text-white shadow-2xl shadow-black/40">
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">
              You&apos;re in
            </p>
            <h3 className="mt-2 text-2xl font-semibold">
              Welcome to {joinSuccess.name}
            </h3>
            <p className="mt-3 text-sm text-white/70">
              Hop into that signal feed now or stay here to keep managing your
              groups.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setJoinSuccess(null)}
                className="flex-1 rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Stay here
              </button>
              <button
                type="button"
                onClick={() => {
                  router.push(`/?group=${joinSuccess.shareCode}`);
                  setJoinSuccess(null);
                }}
                className="flex-1 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold uppercase tracking-wide text-night transition hover:opacity-90"
              >
                Go to feed
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmLeave ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 py-8">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-night/90 p-8 text-white shadow-2xl shadow-black/40">
            <p className="text-xs uppercase tracking-[0.4em] text-white/50">
              Leave circle
            </p>
            <h3 className="mt-2 text-2xl font-semibold">
              Leave {confirmLeave.name}?
            </h3>
            <p className="mt-3 text-sm text-white/70">
              You will lose access to this signal feed until someone invites you
              again.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setConfirmLeave(null)}
                disabled={isLeaving}
                className="flex-1 rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Stay in group
              </button>
              <button
                type="button"
                onClick={confirmLeaveGroup}
                disabled={isLeaving}
                className="flex-1 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLeaving ? "Leaving..." : "Leave group"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
