-- CreateTable
CREATE TABLE "WatchEntryComment" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchEntryComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WatchEntryComment_entryId_idx" ON "WatchEntryComment"("entryId");

-- AddForeignKey
ALTER TABLE "WatchEntryComment" ADD CONSTRAINT "WatchEntryComment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WatchEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchEntryComment" ADD CONSTRAINT "WatchEntryComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
