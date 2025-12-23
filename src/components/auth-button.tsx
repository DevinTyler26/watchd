"use client";

import { signIn, signOut } from "next-auth/react";
import { useTransition } from "react";

type AuthButtonProps = {
  isAuthenticated: boolean;
};

export function AuthButton({ isAuthenticated }: AuthButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(() => {
      if (isAuthenticated) {
        void signOut();
        return;
      }

      void signIn("google");
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="rounded-full bg-white/10 px-5 py-2 text-sm font-medium uppercase tracking-wide text-mist transition hover:bg-white/20 disabled:opacity-60"
    >
      {isAuthenticated ? "Sign out" : "Sign in with Google"}
    </button>
  );
}
