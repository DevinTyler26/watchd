import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { jsonResponse } from "@/lib/api-response";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return jsonResponse({ error: "Sign in required." }, { status: 401 });
  }
  const limiter = rateLimit(getRateLimitKey(request, session.user.id), {
    keyPrefix: "groups:leave",
    max: 8,
    intervalMs: 60_000,
  });
  if (limiter.limited) {
    const retryAfter = Math.ceil((limiter.resetAt - Date.now()) / 1000);
    return jsonResponse(
      { error: "Too many requests. Try again soon." },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
    );
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
    return jsonResponse(
      { error: "Membership not found." },
      { status: 404 }
    );
  }

  if (membership.role === "OWNER") {
    return jsonResponse(
      { error: "Owners need to transfer ownership before leaving." },
      { status: 403 }
    );
  }

  await prisma.groupMembership.delete({ where: { id: membership.id } });

  return jsonResponse({ ok: true });
}
