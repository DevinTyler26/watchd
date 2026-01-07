import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { jsonResponse } from "@/lib/api-response";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return jsonResponse({ error: "Sign in required." }, { status: 401 });
  }
  const limiter = rateLimit(getRateLimitKey(request, session.user.id), {
    keyPrefix: "user:hero-dismiss",
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

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { heroDismissedAt: new Date() },
    });
  } catch (error) {
    console.error("Failed to dismiss hero", error);
    return jsonResponse(
      { error: "Unable to update hero preference." },
      { status: 500 }
    );
  }

  return jsonResponse({ dismissed: true });
}
