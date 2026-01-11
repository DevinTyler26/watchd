"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiJson, ApiError } from "@/lib/api-client";
import { reportClientError } from "@/lib/client-errors";
import { groupMembersResponseSchema } from "@/lib/group-schemas";
import { useToast } from "@/components/toast-provider";
import { ModalShell } from "@/components/modal-shell";

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
  const [isInviting, setIsInviting] = useState(false);
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [pendingOwnershipChange, setPendingOwnershipChange] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [autoJoinTriggered, setAutoJoinTriggered] = useState(false);
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const { addToast } = useToast();
  const [pendingInviteModal, setPendingInviteModal] = useState<{
    email: string;
  } | null>(null);
  const [createdGroupModal, setCreatedGroupModal] = useState<{
    name: string;
    shareCode: string;
  } | null>(null);
  const [deleteGroupModal, setDeleteGroupModal] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  const activeGroup = activeGroupId
    ? groups.find((group) => group.id === activeGroupId) ?? null
    : null;
  const isManager = activeGroupRole === "OWNER" || activeGroupRole === "EDITOR";
  const isOwner = activeGroupRole === "OWNER";

  useEffect(() => {
    if (!activeGroup) {
      setGroupNameDraft("");
      setIsEditingName(false);
      return;
    }
    setGroupNameDraft(activeGroup.name);
  }, [activeGroup]);

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
        const { data } = await apiJson<{
          group?: { name?: string; shareCode?: string };
        }>("/api/groups/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: trimmed }),
          retries: 1,
        });

        setJoinToken("");
        setStatusMessage(null);
        if (data?.group?.name && data?.group?.shareCode) {
          setJoinSuccess({
            name: data.group.name,
            shareCode: data.group.shareCode,
          });
        }
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError && err.requestId) {
          void reportClientError({
            message: err.message,
            requestId: err.requestId,
            context: { action: "join-group" },
          });
        }
        if (err instanceof ApiError) {
          setStatusMessage(err.message);
          return;
        }
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

    void (async () => {
      try {
        const { data } = await apiJson<{ members: MemberEntry[] }>(
          `/api/groups/${activeGroupId}/members`,
          { retries: 2 },
          groupMembersResponseSchema
        );
        if (!cancelled) {
          setMembers(data.members ?? []);
        }
      } catch (error: unknown) {
        if (error instanceof ApiError && error.requestId) {
          void reportClientError({
            message: error.message,
            requestId: error.requestId,
            context: { action: "load-members", groupId: activeGroupId },
          });
        }
        if (!cancelled) {
          setMembersError(
            error instanceof Error ? error.message : "Unable to load members."
          );
          setMembers([]);
        }
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    })();

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
      const { data } = await apiJson<{
        group: { id: string; name: string; shareCode: string };
      }>("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim() }),
        retries: 1,
      });

      setCreateName("");
      setStatusMessage(null);
      setCreatedGroupModal({
        name: data.group.name,
        shareCode: data.group.shareCode,
      });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.requestId) {
        void reportClientError({
          message: err.message,
          requestId: err.requestId,
          context: { action: "create-group" },
        });
      }
      if (err instanceof ApiError) {
        if (err.message === "That email already has a pending invite.") {
          setStatusMessage(null);
          addToast(err.message, "warning");
          return;
        }
        setStatusMessage(err.message);
        return;
      }
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

    setIsInviting(true);
    try {
      const { data } = await apiJson<{ emailSent: boolean; token?: string }>(
        `/api/groups/${activeGroupId}/invite`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, role: inviteRole }),
          retries: 1,
        }
      );

      setInviteEmail("");
      setInviteRole("EDITOR");
      setStatusMessage(null);
      if (data.emailSent) {
        addToast(`Invite sent to ${normalizedEmail}.`, "success");
      } else {
        addToast(`Invite ready. Share token: ${data.token}`, "success");
      }
    } catch (err) {
      if (err instanceof ApiError && err.requestId) {
        void reportClientError({
          message: err.message,
          requestId: err.requestId,
          context: { action: "invite-member", groupId: activeGroupId },
        });
      }
      if (err instanceof ApiError) {
        if (err.message.includes("pending invite")) {
          setPendingInviteModal({ email: normalizedEmail });
          return;
        }
        addToast(err.message, "error");
        return;
      }
      addToast("Network issue sending the invite.", "error");
    } finally {
      setIsInviting(false);
    }
  }

  async function resendInvite(email: string) {
    if (!activeGroupId) return;
    setIsInviting(true);
    try {
      const { data } = await apiJson<{ emailSent: boolean; token?: string }>(
        `/api/groups/${activeGroupId}/invite`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            role: inviteRole,
            resend: true,
          }),
          retries: 0,
        }
      );
      if (data.emailSent) {
        addToast(`Invite resent to ${email}.`, "success");
      } else {
        addToast(`Invite refreshed. Share token: ${data.token}`, "success");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        addToast(err.message, "error");
        return;
      }
      addToast("Network issue resending invite.", "error");
    } finally {
      setIsInviting(false);
    }
  }

  async function confirmDeleteGroup() {
    if (!deleteGroupModal) return;
    setIsDeletingGroup(true);
    try {
      await apiJson(`/api/groups/${deleteGroupModal.id}`, {
        method: "DELETE",
        retries: 0,
      });
      addToast(`Deleted ${deleteGroupModal.name}.`, "success");
      setDeleteGroupModal(null);
      void router.push("/circles");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        addToast(err.message, "error");
        return;
      }
      addToast("Network issue deleting the circle.", "error");
    } finally {
      setIsDeletingGroup(false);
    }
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);
    await attemptJoinToken(joinToken);
  }

  async function handleRename(nextName: string) {
    if (!activeGroupId || !activeGroup) return;
    const trimmedName = nextName.trim();
    if (nextName.length < 2) {
      addToast("Group names need at least two characters.", "error");
      return;
    }
    if (trimmedName === activeGroup.name) {
      setIsEditingName(false);
      return;
    }

    setIsRenaming(true);
    try {
      const { data } = await apiJson<{ group?: { name?: string } }>(
        `/api/groups/${activeGroupId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmedName }),
          retries: 0,
        }
      );
      const updatedName = data?.group?.name ?? trimmedName;
      setGroupNameDraft(updatedName);
      addToast(`Renamed to ${updatedName}.`, "success");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.requestId) {
        void reportClientError({
          message: err.message,
          requestId: err.requestId,
          context: { action: "rename-group", groupId: activeGroupId },
        });
      }
      if (err instanceof ApiError && err.status === 429) {
        addToast(
          "You're renaming too quickly. Try again in a moment.",
          "error"
        );
        return;
      }
      if (err instanceof ApiError) {
        addToast(err.message, "error");
        return;
      }
      addToast("Network issue renaming the group.", "error");
    } finally {
      setIsRenaming(false);
      setIsEditingName(false);
    }
  }

  async function confirmLeaveGroup() {
    if (!confirmLeave) {
      return;
    }

    setStatusMessage(null);
    setIsLeaving(true);

    try {
      await apiJson(`/api/groups/${confirmLeave.id}/leave`, {
        method: "POST",
        retries: 1,
      });

      setStatusMessage(`Left ${confirmLeave.name}.`);
      const leftGroupId = confirmLeave.id;
      setConfirmLeave(null);
      if (leftGroupId === activeGroupId) {
        void router.push("/");
      }
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.requestId) {
        void reportClientError({
          message: err.message,
          requestId: err.requestId,
          context: { action: "leave-group", groupId: confirmLeave.id },
        });
      }
      if (err instanceof ApiError) {
        setStatusMessage(err.message);
        return;
      }
      setStatusMessage("Network issue leaving the group.");
    } finally {
      setIsLeaving(false);
    }
  }

  async function updateMemberRole(
    userId: string,
    role: MemberEntry["role"],
    memberName?: string
  ) {
    if (!activeGroupId) return;
    setStatusMessage(null);
    setRoleUpdatingId(userId);
    try {
      const { data } = await apiJson<{ member?: MemberEntry }>(
        `/api/groups/${activeGroupId}/members`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, role }),
          retries: 1,
        }
      );
      setMembers((prev) =>
        prev.map((member) =>
          member.userId === userId
            ? { ...member, role: data.member?.role ?? role }
            : member
        )
      );
      addToast(`${memberName ?? "Member"} role updated.`, "success");
    } catch (err) {
      if (err instanceof ApiError && err.requestId) {
        void reportClientError({
          message: err.message,
          requestId: err.requestId,
          context: { action: "update-role", groupId: activeGroupId, userId },
        });
      }
      if (err instanceof ApiError) {
        setStatusMessage(err.message);
        return;
      }
      setStatusMessage("Network issue updating role.");
    } finally {
      setRoleUpdatingId(null);
    }
  }

  function handleRoleChange(member: MemberEntry, role: MemberEntry["role"]) {
    if (role === "OWNER" && member.role !== "OWNER" && isOwner) {
      setPendingOwnershipChange({ userId: member.userId, name: member.name });
      return;
    }
    void updateMemberRole(member.userId, role, member.name);
  }

  async function removeMember(userId: string) {
    if (!activeGroupId) return;
    setStatusMessage(null);
    setRemovingId(userId);
    try {
      await apiJson(`/api/groups/${activeGroupId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
        retries: 1,
      });
      setMembers((prev) => prev.filter((member) => member.userId !== userId));
    } catch (err) {
      if (err instanceof ApiError && err.requestId) {
        void reportClientError({
          message: err.message,
          requestId: err.requestId,
          context: { action: "remove-member", groupId: activeGroupId, userId },
        });
      }
      if (err instanceof ApiError) {
        setStatusMessage(err.message);
        return;
      }
      setStatusMessage("Network issue removing member.");
    } finally {
      setRemovingId(null);
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
      {createdGroupModal ? (
        <ModalShell
          onClose={() => setCreatedGroupModal(null)}
          overlayClassName="bg-black/60"
          panelClassName="w-full max-w-sm rounded-lg border border-white/10 bg-night/95 p-6 text-white shadow-2xl shadow-black/40 md:max-w-lg md:p-8"
        >
          {(requestClose) => (
            <>
              <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">
                Circle created
              </p>
              <h3 className="mt-2 text-2xl font-semibold">
                Jump to {createdGroupModal.name}?
              </h3>
              <p className="mt-3 text-sm text-white/70">
                You can start inviting members or manage roles right away.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={requestClose}
                  className="flex-1 rounded-lg border border-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Stay here
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetCode = createdGroupModal.shareCode;
                    requestClose();
                    void router.push(`/circles?group=${targetCode}`);
                  }}
                  className="flex-1 rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-night transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Manage this circle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetCode = createdGroupModal.shareCode;
                    requestClose();
                    void router.push(`/?group=${targetCode}`);
                  }}
                  className="flex-1 rounded-lg border border-emerald-400/50 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-emerald-100 transition hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  View feed
                </button>
              </div>
            </>
          )}
        </ModalShell>
      ) : null}
      {deleteGroupModal ? (
        <ModalShell
          onClose={() => setDeleteGroupModal(null)}
          overlayClassName="bg-black/60"
          panelClassName="w-full max-w-sm rounded-lg border border-white/10 bg-night/95 p-6 text-white shadow-2xl shadow-black/40"
        >
          {(requestClose) => (
            <>
              <p className="text-xs uppercase tracking-[0.4em] text-rose-300">
                Danger zone
              </p>
              <h3 className="mt-2 text-2xl font-semibold">
                Delete {deleteGroupModal.name}?
              </h3>
              <p className="mt-3 text-sm text-white/70">
                This will permanently remove the circle and all of its entries.
                This action cannot be undone.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={requestClose}
                  className="flex-1 rounded-lg border border-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isDeletingGroup}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDeleteGroup()}
                  className="flex-1 rounded-lg bg-rose-500 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isDeletingGroup}
                >
                  {isDeletingGroup ? "Deleting..." : "Delete circle"}
                </button>
              </div>
            </>
          )}
        </ModalShell>
      ) : null}
      {pendingInviteModal ? (
        <ModalShell
          onClose={() => setPendingInviteModal(null)}
          overlayClassName="bg-black/60"
          panelClassName="w-full max-w-sm rounded-lg border border-white/10 bg-night/95 p-6 text-white shadow-2xl shadow-black/40"
        >
          {(requestClose) => (
            <>
              <p className="text-xs uppercase tracking-[0.4em] text-amber-300">
                Invite pending
              </p>
              <h3 className="mt-2 text-2xl font-semibold">
                Resend this invite?
              </h3>
              <p className="mt-3 text-sm text-white/70">
                {pendingInviteModal.email} already has a pending invite. You can
                resend it or keep the existing one. If you resend, the previous
                invite link will no longer work.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={requestClose}
                  className="flex-1 rounded-lg border border-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isInviting}
                >
                  Keep existing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const email = pendingInviteModal.email;
                    requestClose();
                    void resendInvite(email);
                  }}
                  className="flex-1 rounded-lg bg-amber-400 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-night transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isInviting}
                >
                  {isInviting ? "Resending..." : "Resend invite"}
                </button>
              </div>
            </>
          )}
        </ModalShell>
      ) : null}

      {statusMessage ? (
        <p className="rounded-lg border border-white/10 bg-night/30 p-3 text-center text-sm text-white/80">
          {statusMessage}
        </p>
      ) : null}

      {activeGroup ? (
        <div className="space-y-4 border-t-2 border-white/25 pt-4 md:rounded-lg md:border md:border-white/10 md:bg-night/30 md:p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                Active circle
              </p>
              {isEditingName && isOwner ? (
                <input
                  type="text"
                  value={groupNameDraft}
                  onChange={(event) => setGroupNameDraft(event.target.value)}
                  onBlur={() => void handleRename(groupNameDraft)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleRename(groupNameDraft);
                    }
                    if (event.key === "Escape") {
                      setGroupNameDraft(activeGroup.name);
                      setIsEditingName(false);
                    }
                  }}
                  className="w-full rounded-lg border border-white/15 bg-transparent px-2 py-1.5 text-xl font-semibold text-white focus:border-brand focus:outline-none"
                  disabled={isRenaming}
                  autoFocus
                />
              ) : (
                <p
                  className={`text-xl font-semibold text-white ${
                    isOwner ? "cursor-text" : ""
                  }`}
                  onDoubleClick={() => {
                    if (!isOwner) return;
                    setIsEditingName(true);
                  }}
                  title={isOwner ? "Double click to rename" : undefined}
                >
                  {activeGroup.name}
                </p>
              )}
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                {activeGroupRole}
              </p>
            </div>
            {isManager ? (
              <div className="w-full space-y-3 md:max-w-sm">
                <form onSubmit={handleInvite} className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                    Invite with role
                  </p>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="friend@example.com"
                    className="w-full rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm text-white focus:border-brand focus:outline-none"
                  />
                  <div className="flex items-stretch gap-2">
                    <select
                      value={inviteRole}
                      onChange={(event) =>
                        setInviteRole(event.target.value as MemberEntry["role"])
                      }
                      className="h-10 flex-1 rounded-lg border border-white/10 bg-night/60 pl-4 pr-10 text-sm text-white focus:border-brand focus:outline-none"
                    >
                      <option value="EDITOR">Editor</option>
                      <option value="VIEWER">Viewer</option>
                      <option value="OWNER" disabled={!isOwner}>
                        Owner (owners only)
                      </option>
                    </select>
                    <button
                      type="submit"
                      disabled={isInviting}
                      className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-white/10 px-4 text-sm font-semibold uppercase tracking-widest text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isInviting ? (
                        <>
                          <span
                            className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                            aria-hidden
                          />
                          Sending...
                        </>
                      ) : (
                        "Send invite"
                      )}
                    </button>
                  </div>
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

          <div className="space-y-3 border-t border-dashed border-white/20 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                  Members
                </p>
                <p className="text-sm text-white/60">
                  Roles and access for this circle.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/50">
                {membersLoading ? (
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    aria-hidden
                  />
                ) : null}
                <span>
                  {membersLoading ? "Loading..." : `${members.length} total`}
                </span>
              </div>
            </div>
            {membersError ? (
              <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                {membersError}
              </p>
            ) : null}

            {membersLoading ? null : members.length === 0 ? (
              <p className="text-sm text-white/60">No members found.</p>
            ) : (
              <ul className="space-y-3">
                {members.map((member) => {
                  const isOwnerMember = member.role === "OWNER";
                  const canManageMember =
                    activeGroupRole === "OWNER" ||
                    (activeGroupRole === "EDITOR" && !isOwnerMember);
                  return (
                    <li
                      key={member.userId}
                      className="flex flex-col gap-3 rounded-md bg-white/5 px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white">
                            {member.name}
                          </p>
                          <p className="text-xs text-white/50">
                            {member.email ?? "No email"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                          {canManageMember ? (
                            isOwnerMember ? (
                              <span className="inline-flex shrink-0 rounded-md border border-white/20 bg-night/60 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
                                Owner
                              </span>
                            ) : (
                              <select
                                value={member.role}
                                onChange={(event) =>
                                  handleRoleChange(
                                    member,
                                    event.target.value as MemberEntry["role"]
                                  )
                                }
                                className="w-26 shrink-0 rounded-lg border border-white/20 bg-night/60 pl-2.5 pr-8 py-1.5 text-sm text-white focus:border-brand focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={
                                  roleUpdatingId === member.userId ||
                                  removingId === member.userId
                                }
                              >
                                <option value="OWNER" disabled={!isOwner}>
                                  Owner
                                </option>
                                <option value="EDITOR">Editor</option>
                                <option value="VIEWER">Viewer</option>
                              </select>
                            )
                          ) : (
                            <span className="shrink-0 text-xs uppercase tracking-[0.3em] text-white/40">
                              {member.role}
                            </span>
                          )}
                          {canManageMember && !isOwnerMember ? (
                            <button
                              type="button"
                              onClick={() => removeMember(member.userId)}
                              className="flex items-center gap-2 rounded-md border border-white/20 px-2.5 py-1.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={removingId === member.userId}
                            >
                              {removingId === member.userId ? (
                                <>
                                  <span
                                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                                    aria-hidden
                                  />
                                  Removing...
                                </>
                              ) : (
                                "Remove"
                              )}
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {canManageMember && isOwnerMember ? (
                        <p className="text-[11px] text-white/40">
                          Promote someone else to transfer ownership.
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="border-t-2 border-white/25 pt-4 text-sm text-white/60 md:rounded-lg md:border md:border-white/10 md:bg-night/30 md:p-4">
          Select a circle above to manage members and invites.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleCreate}
          className="space-y-2 border-t-2 border-white/25 pt-4 md:rounded-lg md:border md:border-white/10 md:bg-night/30 md:p-4"
        >
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">
            Start a circle
          </p>
          <input
            type="text"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            placeholder="e.g. Family Signal"
            className="w-full rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm text-white focus:border-brand focus:outline-none"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold uppercase tracking-widest text-night"
          >
            Create
          </button>
        </form>

        <form
          onSubmit={handleJoin}
          className="space-y-2 border-t-2 border-white/25 pt-4 md:rounded-lg md:border md:border-white/10 md:bg-night/30 md:p-4"
        >
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">
            Join via token
          </p>
          <input
            type="text"
            value={joinToken}
            onChange={(event) => setJoinToken(event.target.value)}
            placeholder="Paste invite token"
            className="w-full rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm text-white focus:border-brand focus:outline-none"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-white"
          >
            Join circle
          </button>
        </form>
      </div>

      <div className="space-y-4 border-t-2 border-white/25 pt-4 md:rounded-lg md:border md:border-white/10 md:bg-night/30 md:p-4">
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
                className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3"
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
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteGroupModal({
                        id: group.id,
                        name: group.name,
                      })
                    }
                    className="rounded-lg border border-rose-500/40 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/10"
                  >
                    Delete circle
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusMessage(null);
                      setConfirmLeave(group);
                    }}
                    className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
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
        <ModalShell
          onClose={() => setJoinSuccess(null)}
          overlayClassName="bg-black/70"
          panelClassName="w-full max-w-md rounded-lg border border-white/10 bg-night/90 p-8 text-white shadow-2xl shadow-black/40"
        >
          {(requestClose) => (
            <>
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
                  onClick={requestClose}
                  className="flex-1 rounded-lg border border-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Stay here
                </button>
                <button
                  type="button"
                  onClick={() => {
                    requestClose();
                    router.push(`/?group=${joinSuccess.shareCode}`);
                  }}
                  className="flex-1 rounded-lg bg-brand px-4 py-3 text-sm font-semibold uppercase tracking-wide text-night transition hover:opacity-90"
                >
                  Go to feed
                </button>
              </div>
            </>
          )}
        </ModalShell>
      ) : null}

      {confirmLeave ? (
        <ModalShell
          onClose={() => setConfirmLeave(null)}
          overlayClassName="bg-black/70"
          panelClassName="w-full max-w-md rounded-lg border border-white/10 bg-night/90 p-8 text-white shadow-2xl shadow-black/40"
        >
          {(requestClose) => (
            <>
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                Leave circle
              </p>
              <h3 className="mt-2 text-2xl font-semibold">
                Leave {confirmLeave.name}?
              </h3>
              <p className="mt-3 text-sm text-white/70">
                You will lose access to this signal feed until someone invites
                you again.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={requestClose}
                  disabled={isLeaving}
                  className="flex-1 rounded-lg border border-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Stay in group
                </button>
                <button
                  type="button"
                  onClick={confirmLeaveGroup}
                  disabled={isLeaving}
                  className="flex-1 rounded-lg bg-rose-500 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLeaving ? "Leaving..." : "Leave group"}
                </button>
              </div>
            </>
          )}
        </ModalShell>
      ) : null}

      {pendingOwnershipChange ? (
        <ModalShell
          onClose={() => setPendingOwnershipChange(null)}
          overlayClassName="bg-black/70"
          panelClassName="w-full max-w-md rounded-lg border border-amber-400/30 bg-night/90 p-8 text-white shadow-2xl shadow-black/40"
        >
          {(requestClose) => (
            <>
              <p className="text-xs uppercase tracking-[0.4em] text-amber-200">
                Transfer ownership
              </p>
              <h3 className="mt-2 text-2xl font-semibold">
                Make {pendingOwnershipChange.name} the owner?
              </h3>
              <p className="mt-3 text-sm text-white/70">
                Owners control invites, roles, and removal rights. You will
                lose owner-only powers after this change.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={requestClose}
                  disabled={roleUpdatingId === pendingOwnershipChange.userId}
                  className="flex-1 rounded-lg border border-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!pendingOwnershipChange) return;
                    void updateMemberRole(
                      pendingOwnershipChange.userId,
                      "OWNER",
                      pendingOwnershipChange.name
                    );
                    requestClose();
                  }}
                  disabled={roleUpdatingId === pendingOwnershipChange.userId}
                  className="flex-1 rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-night transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {roleUpdatingId === pendingOwnershipChange.userId
                    ? "Transferring..."
                    : "Confirm transfer"}
                </button>
              </div>
            </>
          )}
        </ModalShell>
      ) : null}
    </div>
  );
}
