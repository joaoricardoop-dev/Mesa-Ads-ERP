ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "productId" integer REFERENCES "products"("id") ON DELETE SET NULL;
--> statement-breakpoint
UPDATE "campaigns" SET "productId" = 1 WHERE "productId" IS NULL;
--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "productId" integer REFERENCES "products"("id") ON DELETE SET NULL;
--> statement-breakpoint
UPDATE "service_orders" SET "productId" = 1 WHERE "productId" IS NULL;
