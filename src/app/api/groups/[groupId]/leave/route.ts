import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { groupId } = await params;
  const membership = await prisma.groupMembership.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId: session.user.id,
      },
    },
  });

  if (!membership || membership.status !== "ACTIVE") {
    return NextResponse.json({ error: "Membership not found." }, { status: 404 });
  }

  if (membership.role === "OWNER") {
    return NextResponse.json(
      { error: "Owners need to transfer ownership before leaving." },
      { status: 403 },
    );
  }

  await prisma.groupMembership.delete({ where: { id: membership.id } });

  return NextResponse.json({ ok: true });
}
