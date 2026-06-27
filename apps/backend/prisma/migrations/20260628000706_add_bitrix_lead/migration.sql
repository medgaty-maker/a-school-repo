-- Лиды Bitrix (crm.lead) для блока «Лиды»
CREATE TABLE IF NOT EXISTS "BitrixLead" (
  "id" TEXT NOT NULL,
  "bitrixId" INTEGER NOT NULL,
  "title" TEXT,
  "statusId" TEXT,
  "statusName" TEXT,
  "sourceId" TEXT,
  "dateCreate" TIMESTAMP(3) NOT NULL,
  "dateModify" TIMESTAMP(3),
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BitrixLead_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BitrixLead_bitrixId_key" ON "BitrixLead"("bitrixId");
CREATE INDEX IF NOT EXISTS "BitrixLead_dateCreate_idx" ON "BitrixLead"("dateCreate");
