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
  {
    name: "add_freight_cost_to_campaigns",
    sql: `ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "freightCost" numeric(12, 2) DEFAULT '0' NOT NULL;`,
  },
  {
    name: "add_partner_id_to_clients",
    sql: `ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "partnerId" integer REFERENCES "partners"("id") ON DELETE SET NULL;`,
  },
  {
    name: "add_show_agency_pricing_to_clients",
    sql: `ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "show_agency_pricing" boolean;`,
  },
  {
    name: "add_visible_to_advertisers_to_products",
    sql: `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "visibleToAdvertisers" boolean DEFAULT false NOT NULL;`,
  },
  {
    name: "add_campaign_reports_tables",
    sql: `CREATE TABLE IF NOT EXISTS "campaign_reports" ("id" serial PRIMARY KEY NOT NULL, "campaignId" integer NOT NULL REFERENCES "campaigns"("id") ON DELETE cascade, "title" varchar(255) NOT NULL, "periodStart" date NOT NULL, "periodEnd" date NOT NULL, "reportType" varchar(50) NOT NULL DEFAULT 'coaster', "numRestaurants" integer NOT NULL DEFAULT 0, "coastersDistributed" integer NOT NULL DEFAULT 0, "usagePerDay" integer NOT NULL DEFAULT 3, "daysInPeriod" integer NOT NULL DEFAULT 30, "numScreens" integer NOT NULL DEFAULT 0, "spotsPerDay" integer NOT NULL DEFAULT 0, "spotDurationSeconds" integer NOT NULL DEFAULT 30, "activationEvents" integer NOT NULL DEFAULT 0, "peoplePerEvent" integer NOT NULL DEFAULT 0, "totalImpressions" integer NOT NULL DEFAULT 0, "notes" text, "publishedAt" timestamp, "createdAt" timestamp DEFAULT now() NOT NULL, "updatedAt" timestamp DEFAULT now() NOT NULL); CREATE INDEX IF NOT EXISTS "idx_campaign_reports_campaign_id" ON "campaign_reports" ("campaignId"); CREATE INDEX IF NOT EXISTS "idx_campaign_reports_published_at" ON "campaign_reports" ("publishedAt"); CREATE TABLE IF NOT EXISTS "campaign_report_photos" ("id" serial PRIMARY KEY NOT NULL, "reportId" integer NOT NULL REFERENCES "campaign_reports"("id") ON DELETE cascade, "url" text NOT NULL, "caption" varchar(255), "createdAt" timestamp DEFAULT now() NOT NULL); CREATE INDEX IF NOT EXISTS "idx_campaign_report_photos_report_id" ON "campaign_report_photos" ("reportId");`,
  },
  {
    name: "add_campaign_id_and_client_id_to_crm_notifications",
    sql: `ALTER TABLE "crm_notifications" ADD COLUMN IF NOT EXISTS "campaignId" integer REFERENCES "campaigns"("id") ON DELETE CASCADE; ALTER TABLE "crm_notifications" ADD COLUMN IF NOT EXISTS "clientId" integer REFERENCES "clients"("id") ON DELETE CASCADE; CREATE INDEX IF NOT EXISTS "idx_crm_notifications_campaign_id" ON "crm_notifications" ("campaignId"); CREATE INDEX IF NOT EXISTS "idx_crm_notifications_client_id" ON "crm_notifications" ("clientId");`,
  },
  {
    name: "add_source_to_quotations",
    sql: `ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "source" varchar(50) DEFAULT 'internal';`,
  },
  {
    name: "add_unique_constraint_operational_costs_campaign_id",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "idx_operational_costs_campaign_id_unique" ON "operational_costs" ("campaignId");`,
  },
  {
    name: "create_media_kit_settings",
    sql: `CREATE TABLE IF NOT EXISTS "media_kit_settings" ("id" serial PRIMARY KEY, "tagline" varchar(200), "intro" text, "contactName" varchar(100), "contactEmail" varchar(100), "contactPhone" varchar(50), "website" varchar(200), "footerText" text, "updatedAt" timestamp DEFAULT now() NOT NULL); INSERT INTO "media_kit_settings" ("id", "updatedAt") VALUES (1, now()) ON CONFLICT DO NOTHING;`,
  },
  {
    name: "add_pdf_url_to_media_kit_settings",
    sql: `ALTER TABLE "media_kit_settings" ADD COLUMN IF NOT EXISTS "pdfUrl" text;`,
  },
  {
    name: "add_impression_formula_and_distribution_type_to_products",
    sql: `DO $$ BEGIN CREATE TYPE impression_formula_type AS ENUM ('por_coaster', 'por_tela', 'por_visitante', 'por_evento', 'manual'); EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE TYPE distribution_type AS ENUM ('rede', 'local_especifico'); EXCEPTION WHEN duplicate_object THEN NULL; END $$; ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "impression_formula_type" impression_formula_type DEFAULT 'por_coaster'; ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "attention_factor" numeric(5,2) DEFAULT 1.00; ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "frequency_param" numeric(8,2) DEFAULT 1.00; ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "distribution_type" distribution_type DEFAULT 'rede'; CREATE TABLE IF NOT EXISTS "product_locations" ("id" serial PRIMARY KEY NOT NULL, "productId" integer NOT NULL REFERENCES "products"("id") ON DELETE cascade, "restaurantId" integer NOT NULL REFERENCES "active_restaurants"("id") ON DELETE cascade, "createdAt" timestamp DEFAULT now() NOT NULL, CONSTRAINT "uq_product_location" UNIQUE("productId", "restaurantId")); CREATE INDEX IF NOT EXISTS "idx_product_locations_product_id" ON "product_locations" ("productId"); CREATE INDEX IF NOT EXISTS "idx_product_locations_restaurant_id" ON "product_locations" ("restaurantId");`,
  },
  {
    name: "add_workflow_template_to_products",
    sql: `DO $$ BEGIN CREATE TYPE "workflow_template" AS ENUM ('fisico', 'eletronico_cliente_envia', 'ativacao_evento'); EXCEPTION WHEN duplicate_object THEN NULL; END $$; ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "workflowTemplate" "workflow_template";`,
  },
  {
    name: "add_impression_detail_columns_to_products",
    sql: `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "defaultPessoasPorMesa" numeric(4, 2) DEFAULT 3.00 NOT NULL; ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "loopDurationSeconds" integer DEFAULT 30 NOT NULL; ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "frequenciaAparicoes" numeric(4, 2) DEFAULT 1.00 NOT NULL;`,
  },
  {
    name: "add_camelcase_impression_columns_to_products",
    sql: `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "impressionFormulaType" varchar(50) DEFAULT 'por_coaster' NOT NULL; UPDATE "products" SET "impressionFormulaType" = "impression_formula_type"::text WHERE "impressionFormulaType" = 'por_coaster' AND "impression_formula_type" IS NOT NULL; ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "attentionFactor" numeric(4, 2) DEFAULT 1.00 NOT NULL; UPDATE "products" SET "attentionFactor" = "attention_factor" WHERE "attentionFactor" = 1.00 AND "attention_factor" IS NOT NULL AND "attention_factor" <> 1.00; ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "frequencyParam" numeric(8, 2) DEFAULT 1.00; UPDATE "products" SET "frequencyParam" = "frequency_param" WHERE ("frequencyParam" IS NULL OR "frequencyParam" = 1.00) AND "frequency_param" IS NOT NULL AND "frequency_param" <> 1.00; ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "distributionType" distribution_type DEFAULT 'rede'; UPDATE "products" SET "distributionType" = "distribution_type" WHERE ("distributionType" IS NULL OR "distributionType" = 'rede') AND "distribution_type" IS NOT NULL AND "distribution_type" <> 'rede';`,
  },
  {
    name: "add_assigned_to_campaigns",
    sql: `ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "assignedTo" varchar(255); ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "assignedToName" varchar(255); ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "assignedToAvatar" varchar(500);`,
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
