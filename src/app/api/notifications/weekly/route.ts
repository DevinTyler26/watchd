import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendWeeklySummaryEmail } from "@/lib/email";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const secret = process.env.NOTIFICATIONS_CRON_SECRET ?? process.env.CRON_SECRET;
  const headerSecret = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!secret || (headerSecret !== secret && bearerSecret !== secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - ONE_WEEK_MS);

  const prefs = await prisma.groupNotificationPreference.findMany({
    where: { weekly: true },
    select: {
      groupId: true,
      user: { select: { email: true } },
      group: { select: { id: true, name: true } },
    },
  });

  const groupIds = Array.from(new Set(prefs.map((p) => p.groupId)));

  const entriesByGroup = new Map<
    string,
    Array<{
      title: string;
      note: string | null;
      createdAt: Date;
      addedBy: string;
      likeCount: number;
    }>
  >();

  await Promise.all(
    groupIds.map(async (groupId) => {
      const entries = await prisma.watchEntry.findMany({
        where: { groupId, createdAt: { gte: since } },
        select: {
          title: true,
          review: true,
          createdAt: true,
          user: { select: { name: true } },
          reactions: { select: { reaction: true } },
        },
      });
      const shaped = entries.map((entry) => {
        const likeCount = entry.reactions.filter((r) => r.reaction === "LIKE").length;
        return {
          title: entry.title,
          note: entry.review,
          createdAt: entry.createdAt,
          addedBy: entry.user?.name ?? "Someone",
          likeCount,
        };
      });
      entriesByGroup.set(groupId, shaped);
    })
  );

  const perUser = new Map<
    string,
    Array<{
      title: string;
      note: string | null;
      createdAt: Date;
      addedBy: string;
      likeCount: number;
      groupName: string;
    }>
  >();

  prefs.forEach((pref) => {
    const email = pref.user?.email;
    if (!email) return;

    const items = entriesByGroup.get(pref.groupId) ?? [];
    if (!items.length) return;

    const mapped = items.map((item) => ({
      ...item,
      groupName: pref.group?.name ?? "Your circle",
    }));

    const existing = perUser.get(email) ?? [];
    perUser.set(email, existing.concat(mapped));
  });

  const sends = Array.from(perUser.entries()).map(([email, items]) => {
    const sorted = items
      .slice()
      .sort((a, b) => b.likeCount - a.likeCount || b.createdAt.getTime() - a.createdAt.getTime());

    return sendWeeklySummaryEmail({
      to: email,
      items: sorted,
    });
  });

  await Promise.all(sends);

  return NextResponse.json({ success: true, processedGroups: groupIds.length });
}
