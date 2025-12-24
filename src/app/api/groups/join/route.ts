import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const joinSchema = z.object({
  token: z.string().min(10, "Invite token is required"),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = joinSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors.join(", ") },
      { status: 400 },
    );
  }

  const invite = await prisma.groupInvite.findUnique({
    where: { token: parsed.data.token },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invite expired." }, { status: 410 });
  }

  await prisma.groupInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });

  await prisma.groupMembership.upsert({
    where: {
      groupId_userId: {
        groupId: invite.groupId,
        userId: session.user.id,
      },
    },
    update: { status: "ACTIVE" },
    create: {
      groupId: invite.groupId,
      userId: session.user.id,
      role: "MEMBER",
      status: "ACTIVE",
    },
  });

  const group = await prisma.group.findUnique({
    where: { id: invite.groupId },
    select: { id: true, name: true, slug: true, shareCode: true },
  });

  if (!group) {
    return NextResponse.json({ error: "Group no longer exists." }, { status: 404 });
  }

  return NextResponse.json({ group });
}
