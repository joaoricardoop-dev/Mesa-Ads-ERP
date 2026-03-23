import { getDb } from "./db";
import { sql } from "drizzle-orm";

const MIGRATIONS: Array<{ name: string; sql: string }> = [
  {
    name: "add_quotation_period_start",
    sql: `ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "periodStart" date; ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "batchWeeks" integer DEFAULT 4;`,
  },
  {
    name: "add_billing_mode_to_partners",
    sql: `DO $$ BEGIN CREATE TYPE billing_mode AS ENUM ('bruto', 'liquido'); EXCEPTION WHEN duplicate_object THEN NULL; END $$; ALTER TABLE partners ADD COLUMN IF NOT EXISTS "billingMode" billing_mode NOT NULL DEFAULT 'bruto';`,
  },
  {
    name: "add_custom_product_quotation_columns",
    sql: `ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "isCustomProduct" boolean DEFAULT false NOT NULL; ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "customProductName" varchar(255); ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "customProjectCost" numeric(12, 2); ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "customPricingMode" varchar(20); ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "customMarginPercent" numeric(5, 2); ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "customFinalPrice" numeric(12, 2); ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "customRestaurantCommission" numeric(5, 2); ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "customPartnerCommission" numeric(5, 2); ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "customSellerCommission" numeric(5, 2);`,
  },
  {
    name: "add_agency_commission_to_quotations",
    sql: `ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "agencyCommissionPercent" numeric(5, 2);`,
  },
  {
    name: "add_pricing_modes_to_products",
    sql: `DO $$ BEGIN CREATE TYPE "pricing_mode" AS ENUM ('cost_based', 'price_based'); EXCEPTION WHEN duplicate_object THEN null; END $$; DO $$ BEGIN CREATE TYPE "entry_type" AS ENUM ('tiers', 'fixed_quantities'); EXCEPTION WHEN duplicate_object THEN null; END $$; ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "pricingMode" "pricing_mode" DEFAULT 'cost_based' NOT NULL; ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "entryType" "entry_type" DEFAULT 'tiers' NOT NULL; ALTER TABLE "product_pricing_tiers" ADD COLUMN IF NOT EXISTS "precoBase" numeric(10, 2);`,
  },
  {
    name: "add_visible_to_partners_to_products",
    sql: `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "visibleToPartners" boolean DEFAULT false NOT NULL;`,
  },
  {
    name: "add_new_product_type_enum_values",
    sql: `ALTER TYPE product_type ADD VALUE IF NOT EXISTS 'impressos'; ALTER TYPE product_type ADD VALUE IF NOT EXISTS 'eletronicos'; ALTER TYPE product_type ADD VALUE IF NOT EXISTS 'telas';`,
  },
];

export async function runMigrations() {
  const db = await getDb();
  if (!db) {
    console.warn("[Migrations] Database not available, skipping migrations.");
    return;
  }

  for (const migration of MIGRATIONS) {
    try {
      await db.execute(sql.raw(migration.sql));
      console.log(`[Migrations] Applied: ${migration.name}`);
    } catch (err: any) {
      console.warn(`[Migrations] ${migration.name} skipped or failed:`, err?.message || err);
    }
  }
}
