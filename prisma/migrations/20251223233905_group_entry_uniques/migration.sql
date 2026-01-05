/*
  Warnings:

  - A unique constraint covering the columns `[userId,imdbId,groupId]` on the table `WatchEntry` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "WatchEntry_userId_imdbId_key";

-- CreateIndex
CREATE UNIQUE INDEX "WatchEntry_userId_imdbId_groupId_key" ON "WatchEntry"("userId", "imdbId", "groupId");
