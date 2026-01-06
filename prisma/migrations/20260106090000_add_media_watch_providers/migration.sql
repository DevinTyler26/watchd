-- Add watch providers to Media
ALTER TABLE "Media"
ADD COLUMN IF NOT EXISTS "watchProviders" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
