import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendInviteEmail } from "@/lib/email";

const inviteSchema = z.object({
  email: z.string().email(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { groupId } = await params;
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

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { name: true },
  });

  if (!group) {
    return NextResponse.json(
      { error: "Group not found." },
      { status: 404 },
    );
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  const normalizedEmail = parsed.data.email.toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingUser) {
    const existingMembership = await prisma.groupMembership.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: existingUser.id,
        },
      },
      select: { status: true },
    });

    if (existingMembership && existingMembership.status === "ACTIVE") {
      return NextResponse.json(
        { error: "That email already belongs to the circle." },
        { status: 400 },
      );
    }
  }

  const invite = await prisma.groupInvite.create({
    data: {
      groupId,
      email: normalizedEmail,
      token,
      expiresAt,
      createdById: session.user.id,
    },
  });

  const emailResult = await sendInviteEmail({
    to: normalizedEmail,
    groupName: group.name,
    token,
    inviterName: session.user.name,
  });

  return NextResponse.json({
    token: invite.token,
    expiresAt: invite.expiresAt,
    emailSent: emailResult.sent,
  });
}
