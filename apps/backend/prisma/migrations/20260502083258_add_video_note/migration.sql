-- CreateTable
CREATE TABLE "VideoNote" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "projectPlatformId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoNote_videoId_idx" ON "VideoNote"("videoId");

-- CreateIndex
CREATE INDEX "VideoNote_projectPlatformId_createdAt_idx" ON "VideoNote"("projectPlatformId", "createdAt");

-- AddForeignKey
ALTER TABLE "VideoNote" ADD CONSTRAINT "VideoNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
