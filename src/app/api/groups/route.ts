import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const createGroupSchema = z.object({
  name: z.string().min(2, "Name is required").max(60),
});

function generateSlug() {
  return randomUUID().replace(/-/g, "").slice(0, 10);
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ groups: [] });
  }

  const memberships = await prisma.groupMembership.findMany({
    where: { userId: session.user.id, status: "ACTIVE" },
    include: { group: true },
    orderBy: { group: { name: "asc" } },
  });

  const groups = memberships.map((membership) => ({
    id: membership.group.id,
    name: membership.group.name,
    slug: membership.group.slug,
    shareCode: membership.group.shareCode,
    role: membership.role,
  }));

  return NextResponse.json({ groups });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createGroupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors.join(", ") },
      { status: 400 },
    );
  }

  let shareCode = generateSlug();
  while (await prisma.group.findUnique({ where: { shareCode } })) {
    shareCode = generateSlug();
  }

  const group = await prisma.group.create({
    data: {
      name: parsed.data.name.trim(),
      slug: shareCode,
      shareCode,
      ownerId: session.user.id,
      memberships: {
        create: {
          userId: session.user.id,
          role: "OWNER",
          status: "ACTIVE",
        },
      },
    },
    include: {
      memberships: {
        where: { userId: session.user.id },
        select: { role: true },
      },
    },
  });

  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      slug: group.slug,
      shareCode: group.shareCode,
      role: "OWNER",
    },
  });
}
