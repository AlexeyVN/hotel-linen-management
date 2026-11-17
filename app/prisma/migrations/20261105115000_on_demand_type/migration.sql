-- CHECKOUT удалён из справочника: существующие задачи становятся «По требованию»
UPDATE "CleaningTask" SET "type" = 'ON_DEMAND' WHERE "type" = 'CHECKOUT';
