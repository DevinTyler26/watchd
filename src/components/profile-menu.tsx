"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type ProfileMenuProps = {
  user: {
    name?: string | null;
    image?: string | null;
    role?: "USER" | "ADMIN";
  };
  activeCircleCode?: string;
};

function getInitials(name?: string | null) {
  if (!name) {
    return "?";
  }

  const pieces = name.trim().split(/\s+/);
  if (pieces.length === 1) {
    return pieces[0].slice(0, 2).toUpperCase();
  }

  return (pieces[0][0] + pieces[pieces.length - 1][0]).toUpperCase();
}

export function ProfileMenu({ user, activeCircleCode }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const circlesHref =
    activeCircleCode && activeCircleCode !== "personal"
      ? `/circles?group=${activeCircleCode}`
      : "/circles";

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative z-50">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold uppercase text-white transition hover:border-white/30"
        aria-label="Account menu"
      >
        {user.image ? (
          <Image
            src={user.image}
            alt={user.name ?? "Profile"}
            width={44}
            height={44}
            className="h-11 w-11 rounded-2xl object-cover"
          />
        ) : (
          getInitials(user.name)
        )}
      </button>
      {open ? (
        <div className="absolute right-0 mt-3 w-64 rounded-2xl border border-white/10 bg-night/80 p-4 text-sm text-white shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.25em] text-white/50">
              Signed in
            </p>
            <p className="truncate text-lg font-semibold text-white">
              {user.name ?? "Account"}
            </p>
          </div>

          <div className="mt-4 space-y-2">
            {user.role === "ADMIN" ? (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-between rounded-xl bg-emerald/15 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald/25"
              >
                <span>Admin console</span>
                <span aria-hidden>→</span>
              </Link>
            ) : null}
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              <span>Notifications</span>
              <span aria-hidden>→</span>
            </Link>
            <Link
              href={circlesHref}
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              <span>Manage circles</span>
              <span aria-hidden>→</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
              className="flex w-full items-center justify-between rounded-xl bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <span>Sign out</span>
              <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
