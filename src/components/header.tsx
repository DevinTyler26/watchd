import Link from "next/link";
import type { Session } from "next-auth";

import { AuthButton } from "@/components/auth-button";
import { NavGroupSwitcher } from "@/components/group-switcher";
import { ProfileMenu } from "@/components/profile-menu";

type ViewingFeedConfig = {
  groups: Array<{
    id: string;
    name: string;
    shareCode?: string | null;
    slug?: string | null;
  }>;
  activeCode: string;
};

type SiteHeaderProps = {
  session: Session | null;
  viewingFeed?: ViewingFeedConfig;
};

export function SiteHeader({ session, viewingFeed }: SiteHeaderProps) {
  const homeHref =
    viewingFeed?.activeCode && viewingFeed.activeCode !== "personal"
      ? `/?group=${viewingFeed.activeCode}`
      : "/";
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
      <Link
        href={homeHref}
        className="flex items-center gap-3 text-lg font-semibold tracking-[0.3em] uppercase"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-xl font-black leading-none text-glow shadow-lg shadow-brand/50 translate-y-[1px] translate-x-[0.5px]">
          W
        </span>
        Watchd
      </Link>
      <div className="flex items-center gap-4">
        {viewingFeed ? (
          <NavGroupSwitcher
            groups={viewingFeed.groups}
            activeCode={viewingFeed.activeCode}
          />
        ) : null}
        {session?.user ? (
          <ProfileMenu
            user={{
              name: session.user.name,
              image: session.user.image,
              role: session.user.role,
            }}
            activeCircleCode={viewingFeed?.activeCode}
          />
        ) : (
          <AuthButton isAuthenticated={false} />
        )}
      </div>
    </header>
  );
}
