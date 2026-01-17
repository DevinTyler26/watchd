-- CreateEnum
CREATE TYPE "InviteRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- AlterTable
ALTER TABLE "InviteRequest" ADD COLUMN     "approvedEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decidedById" TEXT,
ADD COLUMN     "status" "InviteRequestStatus" NOT NULL DEFAULT 'PENDING';

-- AddForeignKey
ALTER TABLE "InviteRequest" ADD CONSTRAINT "InviteRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
