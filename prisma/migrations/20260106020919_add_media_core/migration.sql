-- DropIndex
DROP INDEX "WatchEntry_groupId_imdbId_key";

-- DropIndex
DROP INDEX "WatchEntry_userId_imdbId_groupId_key";

-- AlterTable
ALTER TABLE "WatchEntry" ADD COLUMN     "mediaId" TEXT,
ALTER COLUMN "imdbId" DROP NOT NULL,
ALTER COLUMN "title" DROP NOT NULL,
ALTER COLUMN "type" DROP NOT NULL,
ALTER COLUMN "type" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "tmdbId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" TEXT,
    "posterUrl" TEXT,
    "plot" TEXT,
    "genre" TEXT,
    "inProduction" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Media_tmdbId_type_key" ON "Media"("tmdbId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "WatchEntry_userId_mediaId_groupId_key" ON "WatchEntry"("userId", "mediaId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchEntry_groupId_mediaId_key" ON "WatchEntry"("groupId", "mediaId");

-- AddForeignKey
ALTER TABLE "WatchEntry" ADD CONSTRAINT "WatchEntry_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
