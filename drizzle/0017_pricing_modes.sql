-- Task 26: Pricing modes per product (tiers/fixed, cost/price based)

-- Create enums if not exists
DO $$ BEGIN
  CREATE TYPE "pricing_mode" AS ENUM ('cost_based', 'price_based');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "entry_type" AS ENUM ('tiers', 'fixed_quantities');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Add pricingMode column to products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "pricingMode" "pricing_mode" DEFAULT 'cost_based' NOT NULL;

-- Add entryType column to products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "entryType" "entry_type" DEFAULT 'tiers' NOT NULL;

-- Add precoBase column to product_pricing_tiers
ALTER TABLE "product_pricing_tiers" ADD COLUMN IF NOT EXISTS "precoBase" numeric(10, 2);
