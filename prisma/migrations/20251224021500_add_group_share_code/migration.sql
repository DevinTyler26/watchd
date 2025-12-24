ALTER TABLE "Group" ADD COLUMN "shareCode" TEXT;

UPDATE "Group" SET "shareCode" = "slug";

ALTER TABLE "Group" ALTER COLUMN "shareCode" SET NOT NULL;

ALTER TABLE "Group" ADD CONSTRAINT "Group_shareCode_key" UNIQUE ("shareCode");
