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
  {
    name: "add_pipeline_campaign_statuses",
    sql: `ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'briefing'; ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'design'; ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'aprovacao'; ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'distribuicao'; ALTER TYPE service_order_type ADD VALUE IF NOT EXISTS 'distribuicao'; ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "proposalSignedAt" timestamp; ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "producaoEnteredAt" timestamp;`,
  },
  {
    name: "add_sla_stage_timestamps_and_freight_tracking",
    sql: `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "briefingEnteredAt" timestamp; ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "designEnteredAt" timestamp; ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "aprovacaoEnteredAt" timestamp; ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "distribuicaoEnteredAt" timestamp; ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS "trackingCode" varchar(100); ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS "freightProvider" varchar(150); ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS "freightExpectedDate" date;`,
  },
  {
    name: "add_product_discount_price_tiers",
    sql: `CREATE TABLE IF NOT EXISTS "product_discount_price_tiers" ("id" serial PRIMARY KEY NOT NULL, "productId" integer NOT NULL REFERENCES "products"("id") ON DELETE cascade, "priceMin" numeric(12, 2) NOT NULL, "priceMax" numeric(12, 2) NOT NULL, "discountPercent" numeric(5, 2) NOT NULL); CREATE INDEX IF NOT EXISTS "idx_product_discount_price_tiers_product_id" ON "product_discount_price_tiers" ("productId");`,
  },
  {
    name: "add_service_order_trackings_table",
    sql: `CREATE TABLE IF NOT EXISTS "service_order_trackings" ("id" serial PRIMARY KEY NOT NULL, "serviceOrderId" integer NOT NULL REFERENCES "service_orders"("id") ON DELETE cascade, "trackingCode" varchar(100) NOT NULL, "freightProvider" varchar(150), "expectedDate" date, "label" varchar(100), "createdAt" timestamp DEFAULT now() NOT NULL); CREATE INDEX IF NOT EXISTS "idx_so_trackings_so_id" ON "service_order_trackings" ("serviceOrderId");`,
  },
  {
    name: "add_integration_tokens_table",
    sql: `CREATE TABLE IF NOT EXISTS "integration_tokens" ("id" serial PRIMARY KEY NOT NULL, "provider" varchar(50) NOT NULL UNIQUE, "accessToken" text, "refreshToken" text, "tokenType" varchar(50), "expiresAt" timestamp, "scopes" text, "metadata" jsonb, "updatedAt" timestamp DEFAULT now() NOT NULL);`,
  },
  {
    name: "add_user_name_to_campaign_history",
    sql: `ALTER TABLE "campaign_history" ADD COLUMN IF NOT EXISTS "userName" varchar(255);`,
  },
  {
    name: "add_lat_lng_to_active_restaurants",
    sql: `ALTER TABLE "active_restaurants" ADD COLUMN IF NOT EXISTS "lat" numeric(10, 7); ALTER TABLE "active_restaurants" ADD COLUMN IF NOT EXISTS "lng" numeric(10, 7);`,
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
