import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  userId: z.string().cuid(),
  role: z.enum(["OWNER", "EDITOR", "VIEWER"]),
});

const removeSchema = z.object({
  userId: z.string().cuid(),
});

type ManagerCheck = {
  allowed: boolean;
  role: "OWNER" | "EDITOR" | "VIEWER" | null;
};

async function assertManager(groupId: string, userId: string): Promise<ManagerCheck> {
  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true, status: true },
  });

  if (!membership || membership.status !== "ACTIVE") {
    return { allowed: false, role: null };
  }

  if (membership.role !== "OWNER" && membership.role !== "EDITOR") {
    return { allowed: false, role: membership.role };
  }

  return { allowed: true, role: membership.role };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { groupId } = await params;
  const access = await assertManager(groupId, session.user.id);
  if (!access.allowed) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const members = await prisma.groupMembership.findMany({
    where: { groupId },
    select: {
      userId: true,
      role: true,
      status: true,
      user: { select: { name: true, email: true, image: true } },
    },
    orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
  });

  return NextResponse.json({
    members: members.map((m) => ({
      userId: m.userId,
      role: m.role,
      status: m.status,
      name: m.user?.name ?? "Unknown",
      email: m.user?.email ?? null,
      image: m.user?.image ?? null,
    })),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { groupId } = await params;
  const access = await assertManager(groupId, session.user.id);
  if (!access.allowed) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors.join(", ") },
      { status: 400 },
    );
  }

  const { userId, role } = parsed.data;

  if (role === "OWNER" && access.role !== "OWNER") {
    return NextResponse.json(
      { error: "Only the current owner can promote another owner." },
      { status: 403 },
    );
  }

  const target = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true, status: true },
  });

  if (!target || target.status !== "ACTIVE") {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  if (target.role === "OWNER" && role !== "OWNER") {
    return NextResponse.json(
      { error: "Transfer ownership before changing this role." },
      { status: 400 },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    if (role === "OWNER") {
      const currentOwner = await tx.group.findUnique({
        where: { id: groupId },
        select: { ownerId: true },
      });

      if (currentOwner?.ownerId && currentOwner.ownerId !== userId) {
        await tx.groupMembership.updateMany({
          where: { groupId, userId: currentOwner.ownerId },
          data: { role: "EDITOR" },
        });
      }

      await tx.group.update({ where: { id: groupId }, data: { ownerId: userId } });
    }

    return tx.groupMembership.update({
      where: { groupId_userId: { groupId, userId } },
      data: { role },
      select: {
        userId: true,
        role: true,
        status: true,
        user: { select: { name: true, email: true, image: true } },
      },
    });
  });

  return NextResponse.json({
    member: {
      userId: result.userId,
      role: result.role,
      status: result.status,
      name: result.user?.name ?? "Unknown",
      email: result.user?.email ?? null,
      image: result.user?.image ?? null,
    },
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { groupId } = await params;
  const access = await assertManager(groupId, session.user.id);
  if (!access.allowed) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = removeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors.join(", ") },
      { status: 400 },
    );
  }

  if (parsed.data.userId === session.user.id) {
    return NextResponse.json(
      { error: "Use the leave flow to remove yourself." },
      { status: 400 },
    );
  }

  const target = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId: parsed.data.userId } },
    select: { role: true },
  });

  if (!target) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  if (target.role === "OWNER") {
    return NextResponse.json(
      { error: "Transfer ownership before removing this member." },
      { status: 400 },
    );
  }

  await prisma.groupMembership.delete({
    where: { groupId_userId: { groupId, userId: parsed.data.userId } },
  });

  return NextResponse.json({ success: true });
}
