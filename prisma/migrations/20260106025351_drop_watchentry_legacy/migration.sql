/*
  Warnings:

  - You are about to drop the column `imdbId` on the `WatchEntry` table. All the data in the column will be lost.
  - You are about to drop the column `liked` on the `WatchEntry` table. All the data in the column will be lost.
  - You are about to drop the column `omdb` on the `WatchEntry` table. All the data in the column will be lost.
  - You are about to drop the column `posterUrl` on the `WatchEntry` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `WatchEntry` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `WatchEntry` table. All the data in the column will be lost.
  - You are about to drop the column `year` on the `WatchEntry` table. All the data in the column will be lost.
  - Made the column `mediaId` on table `WatchEntry` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "WatchEntry" DROP COLUMN "imdbId",
DROP COLUMN "liked",
DROP COLUMN "omdb",
DROP COLUMN "posterUrl",
DROP COLUMN "title",
DROP COLUMN "type",
DROP COLUMN "year",
ALTER COLUMN "mediaId" SET NOT NULL;
