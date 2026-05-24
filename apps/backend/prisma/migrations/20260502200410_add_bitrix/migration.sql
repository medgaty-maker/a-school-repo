-- CreateTable
CREATE TABLE "BitrixConfig" (
    "id" TEXT NOT NULL,
    "webhookUrlEnc" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BitrixConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BitrixDeal" (
    "id" TEXT NOT NULL,
    "bitrixId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "stageName" TEXT,
    "categoryId" TEXT,
    "sourceId" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "assignedById" TEXT,
    "opportunity" DECIMAL(20,2),
    "currencyId" TEXT,
    "isWon" BOOLEAN NOT NULL DEFAULT false,
    "isLost" BOOLEAN NOT NULL DEFAULT false,
    "dateCreate" TIMESTAMP(3) NOT NULL,
    "dateModify" TIMESTAMP(3) NOT NULL,
    "closeDate" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BitrixDeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BitrixDeal_bitrixId_key" ON "BitrixDeal"("bitrixId");

-- CreateIndex
CREATE INDEX "BitrixDeal_stageId_idx" ON "BitrixDeal"("stageId");

-- CreateIndex
CREATE INDEX "BitrixDeal_dateCreate_idx" ON "BitrixDeal"("dateCreate");

-- CreateIndex
CREATE INDEX "BitrixDeal_utmSource_utmCampaign_idx" ON "BitrixDeal"("utmSource", "utmCampaign");

-- CreateIndex
CREATE INDEX "BitrixDeal_isWon_isLost_idx" ON "BitrixDeal"("isWon", "isLost");
