CREATE TABLE IF NOT EXISTS "products" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(200) NOT NULL,
  "description" text,
  "unitLabel" varchar(50) DEFAULT 'bolacha' NOT NULL,
  "unitLabelPlural" varchar(50) DEFAULT 'bolachas' NOT NULL,
  "isActive" boolean DEFAULT true NOT NULL,
  "comissaoPercent" numeric(5,2) DEFAULT '0',
  "impostoPercent" numeric(5,2) DEFAULT '0',
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_pricing_tiers" (
  "id" serial PRIMARY KEY NOT NULL,
  "productId" integer NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "volumeMin" integer NOT NULL,
  "volumeMax" integer NOT NULL,
  "custoUnitario" numeric(10,4) NOT NULL,
  "frete" numeric(10,4) DEFAULT '0',
  "margem" numeric(10,4) DEFAULT '0',
  "artes" numeric(10,4) DEFAULT '0',
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_product_pricing_tiers_product_id" ON "product_pricing_tiers" ("productId");
--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "productId" integer REFERENCES "products"("id");
--> statement-breakpoint
UPDATE "quotations" SET "productId" = 1 WHERE "productId" IS NULL;
