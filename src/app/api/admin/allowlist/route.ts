import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const addSchema = z.object({ email: z.string().email() });
const deleteSchema = z.object({ email: z.string().email() });

async function assertAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return null;
  }
  return session.user;
}

export async function GET() {
  const user = await assertAdmin();
  if (!user) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const entries = await prisma.groupAllowlist.findMany({
    orderBy: { email: "asc" },
    select: { email: true, createdAt: true, createdById: true },
  });

  return NextResponse.json({ allowlist: entries });
}

export async function POST(request: Request) {
  const user = await assertAdmin();
  if (!user) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors.join(", ") },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();

  await prisma.groupAllowlist.upsert({
    where: { email },
    update: {},
    create: { email, createdById: user.id },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const user = await assertAdmin();
  if (!user) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors.join(", ") },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  await prisma.groupAllowlist.deleteMany({ where: { email } });

  return NextResponse.json({ success: true });
}
