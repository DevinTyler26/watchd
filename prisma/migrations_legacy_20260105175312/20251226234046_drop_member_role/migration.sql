/*
  Warnings:

  - The values [MEMBER] on the enum `GroupRole` will be removed. If these variants are still used in the database, this will fail.

*/

-- AlterEnum with inline mapping of MEMBER -> EDITOR during cast
BEGIN;
CREATE TYPE "GroupRole_new" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');
ALTER TABLE "public"."GroupMembership" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "GroupMembership"
  ALTER COLUMN "role" TYPE "GroupRole_new"
  USING (CASE WHEN "role"::text = 'MEMBER' THEN 'EDITOR' ELSE "role"::text END::"GroupRole_new");
ALTER TYPE "GroupRole" RENAME TO "GroupRole_old";
ALTER TYPE "GroupRole_new" RENAME TO "GroupRole";
DROP TYPE "public"."GroupRole_old";
ALTER TABLE "GroupMembership" ALTER COLUMN "role" SET DEFAULT 'EDITOR';
COMMIT;

-- Ensure default is set
ALTER TABLE "GroupMembership" ALTER COLUMN "role" SET DEFAULT 'EDITOR';
