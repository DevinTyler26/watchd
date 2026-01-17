import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { jsonResponse } from "@/lib/api-response";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";

const nameSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(60),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return jsonResponse({ error: "Sign in required." }, { status: 401 });
  }

  const limiter = await rateLimit(getRateLimitKey(request, session.user.id), {
    keyPrefix: "user:name",
    max: 10,
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
  const parsed = nameSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { name: parsed.data.name },
      select: { name: true },
    });

    return jsonResponse({ name: user.name });
  } catch (error) {
    console.error("Failed to update name", error);
    return jsonResponse({ error: "Unable to update name." }, { status: 500 });
  }
}
