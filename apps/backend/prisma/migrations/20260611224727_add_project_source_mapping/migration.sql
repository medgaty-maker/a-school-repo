-- Привязка источников данных (Bitrix воронки / Метрика счётчики / Meta кампании) к проекту
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "bitrixCategoryIds" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "metricaCounterIds" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "metaCampaignIds" TEXT;
