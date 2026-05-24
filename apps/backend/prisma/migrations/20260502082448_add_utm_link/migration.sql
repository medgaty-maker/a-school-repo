-- CreateTable
CREATE TABLE "UtmLink" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "medium" TEXT NOT NULL,
    "campaign" TEXT NOT NULL,
    "content" TEXT,
    "term" TEXT,
    "generatedUrl" TEXT NOT NULL,
    "projectId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UtmLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UtmLink_source_medium_campaign_idx" ON "UtmLink"("source", "medium", "campaign");

-- CreateIndex
CREATE INDEX "UtmLink_createdAt_idx" ON "UtmLink"("createdAt");

-- AddForeignKey
ALTER TABLE "UtmLink" ADD CONSTRAINT "UtmLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
