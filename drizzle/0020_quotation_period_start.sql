ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "periodStart" date;
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "batchWeeks" integer DEFAULT 4;
