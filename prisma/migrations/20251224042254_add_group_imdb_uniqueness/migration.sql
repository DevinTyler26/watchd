/*
  Warnings:

  - A unique constraint covering the columns `[groupId,imdbId]` on the table `WatchEntry` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "WatchEntry_groupId_imdbId_key" ON "WatchEntry"("groupId", "imdbId");
