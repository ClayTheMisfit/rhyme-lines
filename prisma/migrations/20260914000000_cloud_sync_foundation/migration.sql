-- CreateEnum
CREATE TYPE "CloudDocumentLifecycle" AS ENUM ('ACTIVE', 'ARCHIVED', 'TRASHED', 'DELETED');

-- CreateTable
CREATE TABLE "CloudDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientDocumentId" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "content" JSONB NOT NULL,
    "clientCreatedAt" TIMESTAMP(3) NOT NULL,
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL,
    "lifecycle" "CloudDocumentLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "lifecycleChangedAt" TIMESTAMP(3),
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "position" DOUBLE PRECISION NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CloudDocument_userId_clientDocumentId_key" ON "CloudDocument"("userId", "clientDocumentId");

-- CreateIndex
CREATE INDEX "CloudDocument_userId_lifecycle_idx" ON "CloudDocument"("userId", "lifecycle");

-- CreateIndex
CREATE INDEX "CloudDocument_userId_updatedAt_idx" ON "CloudDocument"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "CloudDocument" ADD CONSTRAINT "CloudDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
