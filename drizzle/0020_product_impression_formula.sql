-- Add impression formula enums and columns to products table
-- Create product_locations junction table for local_especifico products

DO $$ BEGIN
  CREATE TYPE impression_formula_type AS ENUM ('por_coaster', 'por_tela', 'por_visitante', 'por_evento', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE distribution_type AS ENUM ('rede', 'local_especifico');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS "impression_formula_type" impression_formula_type DEFAULT 'por_coaster',
  ADD COLUMN IF NOT EXISTS "attention_factor" numeric(5,2) DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS "frequency_param" numeric(8,2) DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS "distribution_type" distribution_type DEFAULT 'rede';

CREATE TABLE IF NOT EXISTS "product_locations" (
  "id" serial PRIMARY KEY NOT NULL,
  "productId" integer NOT NULL REFERENCES "products"("id") ON DELETE cascade,
  "restaurantId" integer NOT NULL REFERENCES "active_restaurants"("id") ON DELETE cascade,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "uq_product_location" UNIQUE("productId", "restaurantId")
);

CREATE INDEX IF NOT EXISTS "idx_product_locations_product_id" ON "product_locations" ("productId");
CREATE INDEX IF NOT EXISTS "idx_product_locations_restaurant_id" ON "product_locations" ("restaurantId");
