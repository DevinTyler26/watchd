-- Add runtime and season count to Media
ALTER TABLE "Media"
ADD COLUMN IF NOT EXISTS "runtimeMinutes" INTEGER,
ADD COLUMN IF NOT EXISTS "seasonCount" INTEGER;
