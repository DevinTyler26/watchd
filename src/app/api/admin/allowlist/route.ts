import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { jsonResponse } from "@/lib/api-response";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

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
    return jsonResponse({ error: "Admins only." }, { status: 403 });
  }

  const entries = await prisma.groupAllowlist.findMany({
    orderBy: { email: "asc" },
    select: { email: true, createdAt: true, createdById: true },
  });

  return jsonResponse({ allowlist: entries }, { noStore: true });
}

export async function POST(request: Request) {
  const user = await assertAdmin();
  if (!user) {
    return jsonResponse({ error: "Admins only." }, { status: 403 });
  }
  const limiter = rateLimit(getRateLimitKey(request, user.id), {
    keyPrefix: "admin:allowlist:add",
    max: 20,
    intervalMs: 60_000,
  });
  if (limiter.limited) {
    const retryAfter = Math.ceil((limiter.resetAt - Date.now()) / 1000);
    return jsonResponse(
      { error: "Too many requests. Try again soon." },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { error: parsed.error.flatten().formErrors.join(", ") },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase();

  await prisma.groupAllowlist.upsert({
    where: { email },
    update: {},
    create: { email, createdById: user.id },
  });

  return jsonResponse({ success: true });
}

export async function DELETE(request: Request) {
  const user = await assertAdmin();
  if (!user) {
    return jsonResponse({ error: "Admins only." }, { status: 403 });
  }
  const limiter = rateLimit(getRateLimitKey(request, user.id), {
    keyPrefix: "admin:allowlist:delete",
    max: 20,
    intervalMs: 60_000,
  });
  if (limiter.limited) {
    const retryAfter = Math.ceil((limiter.resetAt - Date.now()) / 1000);
    return jsonResponse(
      { error: "Too many requests. Try again soon." },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { error: parsed.error.flatten().formErrors.join(", ") },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase();
  await prisma.groupAllowlist.deleteMany({ where: { email } });

  return jsonResponse({ success: true });
}
