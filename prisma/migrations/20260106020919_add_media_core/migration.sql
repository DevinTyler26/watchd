-- DropIndex
DROP INDEX IF EXISTS "WatchEntry_groupId_imdbId_key";

-- DropIndex
DROP INDEX IF EXISTS "WatchEntry_userId_imdbId_groupId_key";

-- AlterTable
ALTER TABLE "WatchEntry"
  ADD COLUMN IF NOT EXISTS "mediaId" TEXT,
  ALTER COLUMN "imdbId" DROP NOT NULL,
  ALTER COLUMN "title" DROP NOT NULL,
  ALTER COLUMN "type" DROP NOT NULL,
  ALTER COLUMN "type" DROP DEFAULT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Media" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "Media_tmdbId_type_key" ON "Media"("tmdbId", "type");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WatchEntry_userId_mediaId_groupId_key" ON "WatchEntry"("userId", "mediaId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WatchEntry_groupId_mediaId_key" ON "WatchEntry"("groupId", "mediaId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WatchEntry_mediaId_fkey'
  ) THEN
    ALTER TABLE "WatchEntry" ADD CONSTRAINT "WatchEntry_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
