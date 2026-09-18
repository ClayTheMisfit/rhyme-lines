-- CreateEnum
CREATE TYPE "CloudDocumentVersionReason" AS ENUM ('INITIAL', 'AUTO', 'LIFECYCLE', 'PRE_RESTORE', 'RESTORE');

-- CreateTable
CREATE TABLE "CloudDocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceRevision" INTEGER NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "content" JSONB NOT NULL,
    "lifecycle" "CloudDocumentLifecycle" NOT NULL,
    "lifecycleChangedAt" TIMESTAMP(3),
    "isPinned" BOOLEAN NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "clientCreatedAt" TIMESTAMP(3) NOT NULL,
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL,
    "reason" "CloudDocumentVersionReason" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CloudDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CloudDocumentVersion_documentId_sourceRevision_key" ON "CloudDocumentVersion"("documentId", "sourceRevision");

-- CreateIndex
CREATE INDEX "CloudDocumentVersion_documentId_createdAt_idx" ON "CloudDocumentVersion"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "CloudDocumentVersion_documentId_sourceRevision_idx" ON "CloudDocumentVersion"("documentId", "sourceRevision");

-- CreateIndex
CREATE INDEX "CloudDocumentVersion_userId_idx" ON "CloudDocumentVersion"("userId");

-- AddForeignKey
ALTER TABLE "CloudDocumentVersion" ADD CONSTRAINT "CloudDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CloudDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudDocumentVersion" ADD CONSTRAINT "CloudDocumentVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
