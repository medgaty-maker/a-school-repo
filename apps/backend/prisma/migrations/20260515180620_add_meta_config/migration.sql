-- CreateTable
CREATE TABLE "MetaConfig" (
    "id" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "appId" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaConfig_pkey" PRIMARY KEY ("id")
);
