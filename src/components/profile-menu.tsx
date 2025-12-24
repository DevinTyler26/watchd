"use client";

import Image from "next/image";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type ProfileMenuProps = {
  user: {
    name?: string | null;
    image?: string | null;
  };
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

export function ProfileMenu({ user }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    <div ref={containerRef} className="relative">
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
        <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-white/10 bg-night/90 p-3 text-sm text-white shadow-2xl shadow-black/40">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            Signed in
          </p>
          <p className="mt-1 truncate text-sm font-semibold">
            {user.name ?? "Account"}
          </p>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="mt-3 w-full rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/20"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
