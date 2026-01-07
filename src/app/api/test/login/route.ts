import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  if (process.env.E2E_AUTH !== "1") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const email = (process.env.E2E_USER_EMAIL ?? "e2e@example.com").toLowerCase();
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "E2E User",
    },
  });

  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  await prisma.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires,
    },
  });

  const isSecure =
    process.env.NODE_ENV === "production" ||
    (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
  const cookieName = isSecure
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    expires,
  });
  return response;
}
