-- Дата первого перехода сделки в «продажную» стадию (crm.stagehistory)
ALTER TABLE "BitrixDeal" ADD COLUMN IF NOT EXISTS "saleAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "BitrixDeal_saleAt_idx" ON "BitrixDeal"("saleAt");
