"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

type GroupSummary = {
  id: string;
  name: string;
  shareCode: string;
  role: string;
};

type MemberEntry = {
  userId: string;
  name: string;
  email: string | null;
  role: "OWNER" | "EDITOR" | "VIEWER";
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
  const [inviteRole, setInviteRole] = useState<"OWNER" | "EDITOR" | "VIEWER">(
    "EDITOR"
  );
  const [joinToken, setJoinToken] = useState(initialJoinToken ?? "");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<{
    name: string;
    shareCode: string;
  } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState<GroupSummary | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [autoJoinTriggered, setAutoJoinTriggered] = useState(false);
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const activeGroup = activeGroupId
    ? groups.find((group) => group.id === activeGroupId) ?? null
    : null;
  const isManager = activeGroupRole === "OWNER" || activeGroupRole === "EDITOR";
  const isOwner = activeGroupRole === "OWNER";

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

  useEffect(() => {
    if (!activeGroupId) {
      setMembers([]);
      return;
    }

    let cancelled = false;
    setMembersLoading(true);
    setMembersError(null);

    fetch(`/api/groups/${activeGroupId}/members`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load members.");
        }
        if (!cancelled) {
          setMembers(payload.members ?? []);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMembersError(
            error instanceof Error ? error.message : "Unable to load members."
          );
          setMembers([]);
        }
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeGroupId]);

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
        body: JSON.stringify({ email: normalizedEmail, role: inviteRole }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatusMessage(payload.error ?? "Unable to send invite.");
        return;
      }

      setInviteEmail("");
      setInviteRole("EDITOR");
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

  async function updateMemberRole(userId: string, role: MemberEntry["role"]) {
    if (!activeGroupId) return;
    setStatusMessage(null);
    try {
      const response = await fetch(`/api/groups/${activeGroupId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatusMessage(payload.error ?? "Unable to update role.");
        return;
      }
      setMembers((prev) =>
        prev.map((member) =>
          member.userId === userId
            ? { ...member, role: payload.member?.role ?? role }
            : member
        )
      );
    } catch {
      setStatusMessage("Network issue updating role.");
    }
  }

  async function removeMember(userId: string) {
    if (!activeGroupId) return;
    setStatusMessage(null);
    try {
      const response = await fetch(`/api/groups/${activeGroupId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatusMessage(payload.error ?? "Unable to remove member.");
        return;
      }
      setMembers((prev) => prev.filter((member) => member.userId !== userId));
    } catch {
      setStatusMessage("Network issue removing member.");
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

      {statusMessage ? (
        <p className="rounded-2xl border border-white/10 bg-night/30 p-3 text-center text-sm text-white/80">
          {statusMessage}
        </p>
      ) : null}

      {activeGroup ? (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-night/30 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                Active circle
              </p>
              <p className="text-xl font-semibold text-white">
                {activeGroup.name}
              </p>
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                {activeGroupRole}
              </p>
            </div>
            {isManager ? (
              <div className="w-full max-w-sm space-y-2">
                <form onSubmit={handleInvite} className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                    Invite with role
                  </p>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="friend@example.com"
                    className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-2 text-sm text-white focus:border-brand focus:outline-none"
                  />
                  <select
                    value={inviteRole}
                    onChange={(event) =>
                      setInviteRole(event.target.value as MemberEntry["role"])
                    }
                    className="w-full rounded-2xl border border-white/10 bg-night/60 px-4 py-2 text-sm text-white focus:border-brand focus:outline-none"
                  >
                    <option value="EDITOR">Editor</option>
                    <option value="VIEWER">Viewer</option>
                    <option value="OWNER" disabled={!isOwner}>
                      Owner (owners only)
                    </option>
                  </select>
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-white"
                  >
                    Send invite
                  </button>
                  <p className="text-xs text-white/50">
                    Owners can transfer ownership; Editors can invite and manage
                    roles. Viewers can only view and react.
                  </p>
                </form>
              </div>
            ) : (
              <p className="text-sm text-white/60">
                You can view members but cannot invite or change roles.
              </p>
            )}
          </div>

          <div className="space-y-2 rounded-2xl border border-white/10 bg-night/20 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                  Members
                </p>
                <p className="text-sm text-white/60">
                  Roles and access for this circle.
                </p>
              </div>
              {membersLoading ? (
                <span className="text-xs text-white/50">Loading...</span>
              ) : (
                <span className="text-xs text-white/50">
                  {members.length} total
                </span>
              )}
            </div>
            {membersError ? (
              <p className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                {membersError}
              </p>
            ) : null}

            {membersLoading ? null : members.length === 0 ? (
              <p className="text-sm text-white/60">No members found.</p>
            ) : (
              <ul className="space-y-3">
                {members.map((member) => {
                  const canManageMember =
                    activeGroupRole === "OWNER" ||
                    (activeGroupRole === "EDITOR" && member.role !== "OWNER");
                  return (
                    <li
                      key={member.userId}
                      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-night/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {member.name}
                        </p>
                        <p className="text-xs text-white/50">
                          {member.email ?? "No email"}
                        </p>
                      </div>
                      {canManageMember ? (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <select
                            value={member.role}
                            onChange={(event) =>
                              updateMemberRole(
                                member.userId,
                                event.target.value as MemberEntry["role"]
                              )
                            }
                            className="rounded-2xl border border-white/20 bg-night/60 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
                            disabled={member.role === "OWNER" && !isOwner}
                          >
                            <option value="OWNER" disabled={!isOwner}>
                              Owner
                            </option>
                            <option value="EDITOR">Editor</option>
                            <option value="VIEWER">Viewer</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => removeMember(member.userId)}
                            className="rounded-2xl border border-white/20 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                            disabled={member.role === "OWNER"}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs uppercase tracking-[0.3em] text-white/40">
                          {member.role}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-night/30 p-4 text-sm text-white/60">
          Select a circle above to manage members and invites.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleCreate}
          className="space-y-2 rounded-2xl border border-white/10 bg-night/30 p-4"
        >
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">
            Start a circle
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
            Join circle
          </button>
        </form>
      </div>

      <div className="space-y-4 rounded-2xl border border-white/10 bg-night/30 p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/50">
              Your circles
            </p>
            <p className="text-sm text-white/60">
              Leave any circle you no longer want to follow.
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
                    {group.role}
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
                    Leave circle
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
