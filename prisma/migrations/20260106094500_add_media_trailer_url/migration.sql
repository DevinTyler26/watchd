-- Add trailer URL to Media
ALTER TABLE "Media"
ADD COLUMN IF NOT EXISTS "trailerUrl" TEXT;
