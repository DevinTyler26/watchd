import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { jsonResponse } from "@/lib/api-response";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";

const inviteSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const limiter = await rateLimit(getRateLimitKey(request), {
    keyPrefix: "invite-request",
    max: 6,
    intervalMs: 60_000,
  });
  if (limiter.limited) {
    const retryAfter = Math.ceil((limiter.resetAt - Date.now()) / 1000);
    return jsonResponse(
      { error: "Too many requests. Try again soon." },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: "Enter a valid email." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const allowlisted = await prisma.groupAllowlist.findUnique({
    where: { email },
    select: { id: true },
  });
  if (allowlisted) {
    return jsonResponse(
      { error: "You're already approved. Try signing in." },
      { status: 409 }
    );
  }

  const existing = await prisma.inviteRequest.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return jsonResponse({ alreadyRequested: true });
  }

  await prisma.inviteRequest.create({
    data: { email },
  });

  return jsonResponse({ requested: true });
}
