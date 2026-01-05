/*
  Warnings:

  - You are about to drop the `WatchEntryBoost` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "EntryReactionType" AS ENUM ('LIKE', 'DISLIKE');

-- CreateTable
CREATE TABLE "WatchEntryReaction" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reaction" "EntryReactionType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WatchEntryReaction_pkey" PRIMARY KEY ("id")
);

-- Copy prior boosts into reactions
INSERT INTO "WatchEntryReaction" ("id", "entryId", "userId", "reaction", "createdAt", "updatedAt")
SELECT "id", "entryId", "userId", 'LIKE'::"EntryReactionType", "createdAt", NOW()
FROM "WatchEntryBoost";

-- Drop legacy boost table
DROP TABLE "WatchEntryBoost";

-- CreateIndex
CREATE UNIQUE INDEX "WatchEntryReaction_entryId_userId_key" ON "WatchEntryReaction"("entryId", "userId");

-- AddForeignKey
ALTER TABLE "WatchEntryReaction" ADD CONSTRAINT "WatchEntryReaction_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WatchEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchEntryReaction" ADD CONSTRAINT "WatchEntryReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
