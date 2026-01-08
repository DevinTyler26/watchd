import { auth } from "@/auth";
import { AdminAllowlistPanel } from "@/components/admin-allowlist-panel";
import { SiteHeader } from "@/components/header";

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ group?: string | string[] }>;
}) {
  const session = await auth();
  const resolvedSearchParams = (await searchParams) ?? {};
  const activeCircleCode = Array.isArray(resolvedSearchParams.group)
    ? resolvedSearchParams.group[0]
    : resolvedSearchParams.group;

  if (!session?.user?.id) {
    return (
      <div className="min-h-screen pb-24">
        <SiteHeader session={session} activeCircleCode={activeCircleCode} />
        <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6">
          <section className="border-t-2 border-white/25 pt-4 text-center text-white/80 md:rounded-lg md:border md:border-white/10 md:bg-night/40 md:p-6">
            <p className="text-lg font-semibold">Sign in required</p>
            <p className="mt-2 text-sm text-white/60">
              Admin controls are available once you log in. Use the button above
              to continue.
            </p>
          </section>
        </main>
      </div>
    );
  }

  if (session.user.role !== "ADMIN") {
    return (
      <div className="min-h-screen pb-24">
        <SiteHeader session={session} activeCircleCode={activeCircleCode} />
        <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6">
          <section className="border-t-2 border-amber-400/40 pt-4 text-center text-white/90 md:rounded-lg md:border md:border-amber-400/20 md:bg-amber-400/10 md:p-6">
            <p className="text-lg font-semibold">Admins only</p>
            <p className="mt-2 text-sm text-white/80">
              You need elevated access to manage sign-in allowlists. Ask an
              admin to grant you the ADMIN role.
            </p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <SiteHeader session={session} activeCircleCode={activeCircleCode} />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 text-white">
        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">
            Admin
          </p>
          <h1 className="text-4xl font-semibold">Access control</h1>
          <p className="text-sm text-white/70">
            Gate sign-ins behind a curated allowlist. Admins always bypass, but
            everyone else needs their email on the list.
          </p>
        </section>

        <AdminAllowlistPanel />

        <section className="border-t-2 border-white/25 pt-4 text-sm text-white/70 md:rounded-lg md:border md:border-white/5 md:bg-night/40 md:p-4">
          <p className="font-semibold text-white">How this works</p>
          <p className="mt-2 text-white/70">
            Sign-in succeeds only for emails on the allowlist. ADMIN accounts
            skip this check so you can bootstrap access even if the list is
            empty.
          </p>
        </section>
      </main>
    </div>
  );
}
