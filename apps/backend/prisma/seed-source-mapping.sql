-- Авто-предзаполнение привязки источников к проектам (идемпотентно: только если поле пусто).
-- Правится потом через UI «Настройки → Привязка источников к проектам».
UPDATE "Project" SET "bitrixCategoryIds" = '28,36,38,40,42,44,48,52,56,58,62'
  WHERE slug = 'a-school' AND COALESCE("bitrixCategoryIds",'') = '';
UPDATE "Project" SET "metricaCounterIds" = '105849697'
  WHERE slug = 'a-school' AND COALESCE("metricaCounterIds",'') = '';
