import { auth } from "@/auth";
import { SiteHeader } from "@/components/header";
import { NotificationPreferences } from "@/components/notification-preferences";
import { prisma } from "@/lib/prisma";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className="min-h-screen pb-24">
        <SiteHeader session={session} />
        <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6">
          <section className="rounded-3xl border border-white/10 bg-night/40 p-6 text-center text-white/80">
            <p className="text-lg font-semibold">Sign in required</p>
            <p className="mt-2 text-sm text-white/60">
              Notifications are available once you log in.
            </p>
          </section>
        </main>
      </div>
    );
  }

  const memberships = await prisma.groupMembership.findMany({
    where: { userId: session.user.id, status: "ACTIVE" },
    select: {
      group: { select: { id: true, name: true } },
    },
  });

  const prefs = await prisma.groupNotificationPreference.findMany({
    where: { userId: session.user.id },
    select: { groupId: true, instant: true, weekly: true },
  });
  const prefMap = new Map(prefs.map((p) => [p.groupId, p]));

  const groups = memberships.map((m) => ({
    id: m.group.id,
    name: m.group.name,
    instant: prefMap.get(m.group.id)?.instant ?? false,
    weekly: prefMap.get(m.group.id)?.weekly ?? false,
  }));

  return (
    <div className="min-h-screen pb-24">
      <SiteHeader session={session} />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 text-white">
        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">
            Notifications
          </p>
          <h1 className="text-4xl font-semibold">Email preferences</h1>
          <p className="text-sm text-white/70">
            Choose which circles email you when new drops land, and whether you
            want weekly summaries.
          </p>
        </section>
        <section className="rounded-3xl border border-white/10 bg-night/40 p-6">
          <NotificationPreferences groups={groups} />
        </section>
      </main>
    </div>
  );
}
