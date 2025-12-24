-- CreateTable
CREATE TABLE "WatchEntryBoost" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchEntryBoost_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WatchEntryBoost_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WatchEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WatchEntryBoost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WatchEntryBoost_entryId_userId_key" ON "WatchEntryBoost"("entryId", "userId");
