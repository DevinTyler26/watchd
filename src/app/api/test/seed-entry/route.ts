import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { jsonResponse } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  if (process.env.E2E_AUTH !== "1") {
    return jsonResponse({ error: "Not found." }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return jsonResponse({ error: "Sign in required" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const tmdbId =
    typeof body.tmdbId === "string" && body.tmdbId.trim()
      ? body.tmdbId.trim()
      : `e2e-${Date.now()}`;
  const type = body.type === "series" ? "series" : "movie";
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : "E2E Title";
  const review =
    typeof body.review === "string" && body.review.trim()
      ? body.review.trim()
      : null;

  const media = await prisma.media.upsert({
    where: { tmdbId_type: { tmdbId, type } },
    update: { title },
    create: { tmdbId, type, title },
  });

  const entry = await prisma.watchEntry.create({
    data: {
      userId: session.user.id,
      mediaId: media.id,
      review,
      groupId: null,
    },
    include: {
      media: {
        select: { tmdbId: true, title: true, type: true },
      },
    },
  });

  return jsonResponse({ entry });
}
