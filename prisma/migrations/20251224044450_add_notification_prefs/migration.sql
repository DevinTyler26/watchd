-- CreateTable
CREATE TABLE "GroupNotificationPreference" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instant" BOOLEAN NOT NULL DEFAULT false,
    "weekly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupNotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupNotificationPreference_groupId_userId_key" ON "GroupNotificationPreference"("groupId", "userId");

-- AddForeignKey
ALTER TABLE "GroupNotificationPreference" ADD CONSTRAINT "GroupNotificationPreference_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupNotificationPreference" ADD CONSTRAINT "GroupNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
