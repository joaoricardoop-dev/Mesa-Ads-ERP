-- Add billing_mode enum and column to partners table
DO $$ BEGIN
  CREATE TYPE billing_mode AS ENUM ('bruto', 'liquido');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE partners ADD COLUMN IF NOT EXISTS "billingMode" billing_mode NOT NULL DEFAULT 'bruto';

