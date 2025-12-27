"use client";

import { signIn, signOut } from "next-auth/react";
import { useMemo, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type AuthButtonProps = {
  isAuthenticated: boolean;
};

export function AuthButton({ isAuthenticated }: AuthButtonProps) {
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const callbackUrl = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const origin = window.location.origin;
    if (!pathname) return undefined;
    const query = searchParams?.toString();
    return query ? `${origin}${pathname}?${query}` : `${origin}${pathname}`;
  }, [pathname, searchParams]);

  function handleClick() {
    startTransition(() => {
      if (isAuthenticated) {
        void signOut();
        return;
      }

      void signIn("google", {
        prompt: "select_account",
        callbackUrl,
      });
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center justify-center gap-2 rounded-full bg-white/10 px-5 py-2 text-sm font-medium uppercase tracking-wide text-mist transition hover:bg-white/20 disabled:opacity-60"
    >
      {isPending ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent"
          aria-hidden
        />
      ) : null}
      {isAuthenticated
        ? isPending
          ? "Signing out..."
          : "Sign out"
        : isPending
        ? "Signing in..."
        : "Sign in with Google"}
    </button>
  );
}
