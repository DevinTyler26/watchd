import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { fetchTitleById } from "@/lib/imdb";
import { prisma } from "@/lib/prisma";

const payloadSchema = z.object({
  imdbId: z.string().min(2, "IMDb id is required"),
  note: z.string().max(500).optional(),
  liked: z.boolean().optional(),
});

export async function GET() {
  const entries = await prisma.watchEntry.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, name: true, image: true },
      },
    },
    take: 50,
  });

  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().formErrors.join(", ") }, { status: 400 });
  }

  const title = await fetchTitleById(parsed.data.imdbId);

  if (!title) {
    return NextResponse.json({ error: "IMDb title not found" }, { status: 404 });
  }

  const entry = await prisma.watchEntry.upsert({
    where: {
      userId_imdbId: {
        userId: session.user.id,
        imdbId: title.imdbId,
      },
    },
    update: {
      review: parsed.data.note?.trim() || null,
      liked: parsed.data.liked ?? true,
    },
    create: {
      userId: session.user.id,
      imdbId: title.imdbId,
      title: title.title,
      year: title.year,
      type: title.type,
      posterUrl: title.posterUrl,
      review: parsed.data.note?.trim() || null,
      liked: parsed.data.liked ?? true,
    },
    include: {
      user: {
        select: { id: true, name: true, image: true },
      },
    },
  });

  revalidatePath("/");

  return NextResponse.json({ entry });
}
