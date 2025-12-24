import { prisma } from "@/lib/prisma";

export async function getUserGroups(userId: string) {
  return prisma.groupMembership.findMany({
    where: { userId, status: "ACTIVE" },
    include: { group: true },
    orderBy: { group: { name: "asc" } },
  });
}
