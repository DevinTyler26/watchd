/*
  Warnings:

  - You are about to drop the column `type` on the `WatchEntry` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "WatchEntry" DROP COLUMN "type",
ADD COLUMN     "omdb" JSONB;
