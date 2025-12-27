import Link from "next/link";

const ERROR_COPY: Record<string, { title: string; message: string }> = {
  AccessDenied: {
    title: "Can't sign in yet",
    message:
      "Your email isn't on the allowlist. Ask an admin to add you, or try another account that's approved.",
  },
  Configuration: {
    title: "Sign-in is misconfigured",
    message:
      "Something in the auth setup is off. Ping an admin to check environment keys and provider settings.",
  },
  Verification: {
    title: "Verification failed",
    message:
      "That link expired or was already used. Start a fresh sign-in to get a new link.",
  },
  Default: {
    title: "Sign-in failed",
    message:
      "We hit a snag while signing you in. Try again or use a different account.",
  },
};

function isPromise<T>(value: unknown): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function resolveError(searchParams?: { error?: string | string[] }) {
  if (!searchParams?.error) return ERROR_COPY.Default;
  const code = Array.isArray(searchParams.error)
    ? searchParams.error[0] ?? "Default"
    : searchParams.error;
  return ERROR_COPY[code] ?? ERROR_COPY.Default;
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string | string[] }> | { error?: string | string[] };
}) {
  const resolvedParams =
    searchParams && isPromise(searchParams)
      ? await searchParams
      : (searchParams as { error?: string | string[] } | undefined);
  const copy = resolveError(resolvedParams);

  return (
    <div className="min-h-screen bg-night pb-24 text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 pt-16">
        <header className="flex items-center gap-3 text-lg font-semibold tracking-[0.3em] uppercase">
          <Link
            href="/"
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-xl font-black text-glow shadow-lg shadow-brand/50"
            aria-label="Back to home"
          >
            W
          </Link>
          Watchd
        </header>

        <section className="space-y-4 rounded-3xl border border-white/10 bg-night/60 p-8 shadow-2xl shadow-black/40">
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">
            Access
          </p>
          <h1 className="text-4xl font-semibold">{copy.title}</h1>
          <p className="text-sm text-white/70">{copy.message}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/api/auth/signin"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/20"
            >
              Try another account
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/10"
            >
              Back home
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-white/5 bg-night/40 p-5 text-sm text-white/70">
          <p className="font-semibold text-white">Why am I seeing this?</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-white/70">
            <li>
              Only allowlisted emails can sign in. Ask an admin to add yours.
            </li>
            <li>Admins bypass the allowlist so they can bootstrap access.</li>
            <li>
              If this is unexpected, try another account or reach out to the
              team.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
