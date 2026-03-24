CREATE TABLE "product_discount_price_tiers" (
  "id" serial PRIMARY KEY NOT NULL,
  "productId" integer NOT NULL REFERENCES "products"("id") ON DELETE cascade,
  "priceMin" numeric(12, 2) NOT NULL,
  "priceMax" numeric(12, 2) NOT NULL,
  "discountPercent" numeric(5, 2) NOT NULL
);

CREATE INDEX "idx_product_discount_price_tiers_product_id" ON "product_discount_price_tiers" ("productId");
