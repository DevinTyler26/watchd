import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { heroDismissedAt: new Date() },
    });
  } catch (error) {
    console.error("Failed to dismiss hero", error);
    return NextResponse.json(
      { error: "Unable to update hero preference." },
      { status: 500 },
    );
  }

  return NextResponse.json({ dismissed: true });
}
