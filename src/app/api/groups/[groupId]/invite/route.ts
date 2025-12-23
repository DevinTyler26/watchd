import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const inviteSchema = z.object({
  email: z.string().email(),
});

export async function POST(
  request: Request,
  { params }: { params: { groupId: string } },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const groupId = params.groupId;
  const body = await request.json().catch(() => ({}));
  const parsed = inviteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors.join(", ") },
      { status: 400 },
    );
  }

  const membership = await prisma.groupMembership.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId: session.user.id,
      },
    },
  });

  if (!membership || membership.role !== "OWNER" || membership.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Only owners can invite members." },
      { status: 403 },
    );
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  const invite = await prisma.groupInvite.create({
    data: {
      groupId,
      email: parsed.data.email.toLowerCase(),
      token,
      expiresAt,
      createdById: session.user.id,
    },
  });

  return NextResponse.json({
    token: invite.token,
    expiresAt: invite.expiresAt,
  });
}
