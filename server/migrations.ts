import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const DRIZZLE_DIR = resolve(process.cwd(), "drizzle");

/**
 * Aplica os SQLs do diretório `drizzle/` (gerados pelo `drizzle-kit
 * generate`) em ordem alfabética. Usado APENAS quando o boot detecta
 * um banco completamente fresh (sem `users` e sem `quotations`).
 *
 * Os arquivos do drizzle-kit já vêm idempotentes: `CREATE TABLE IF NOT
 * EXISTS`, `DO $$ ... EXCEPTION WHEN duplicate_object ... END $$` para
 * tipos, etc. Por isso podemos executar cada arquivo como um único bloco
 * sem split de statements (statements `DO $$ ... $$` quebrariam um split
 * naive em `;`).
 *
 * Marca cada arquivo aplicado no tracker com o prefixo `drizzle:` para
 * não conflitar com o namespace das migrations custom em MIGRATIONS[].
 */
async function applyDrizzleBaseSchema(db: any) {
  let files: string[];
  try {
    files = (await readdir(DRIZZLE_DIR))
      .filter(f => f.endsWith(".sql"))
      .sort();
  } catch (err: any) {
    throw new Error(
      `[Migrations] FATAL: banco fresh detectado, mas diretório drizzle/ não encontrado em ${DRIZZLE_DIR}. ` +
      `O bundle de deploy provavelmente não inclui o diretório drizzle/ — verifique scripts/pre-deploy.sh, ` +
      `o passo de build e se drizzle/ está sendo copiado junto com dist/. ` +
      `Abortando boot para evitar falhas silenciosas em cascata nas migrations custom. ` +
      `Causa raiz: ${err?.message ?? err}`,
    );
  }

  if (files.length === 0) {
    throw new Error(
      `[Migrations] FATAL: banco fresh detectado, mas diretório drizzle/ em ${DRIZZLE_DIR} está vazio (nenhum .sql). ` +
      `O bundle de deploy provavelmente está mispackaged — verifique scripts/pre-deploy.sh e o passo de build. ` +
      `Abortando boot para evitar falhas silenciosas em cascata nas migrations custom.`,
    );
  }

  console.log(
    `[Migrations] Banco fresh detectado — aplicando ${files.length} arquivos do schema base (drizzle/).`,
  );

  for (const file of files) {
    const trackerKey = `drizzle:${file}`;
    const raw = await readFile(resolve(DRIZZLE_DIR, file), "utf-8");
    // drizzle-kit usa `--> statement-breakpoint` como separador opcional;
    // tratamos cada bloco separadamente, mas como os SQLs gerados são
    // idempotentes (CREATE TABLE IF NOT EXISTS etc), executar o arquivo
    // inteiro de uma vez também funcionaria. Splittamos só para isolar
    // falhas pontuais (ex: enum novo num arquivo antigo).
    const blocks = raw
      .split("--> statement-breakpoint")
      .map(s => s.trim())
      .filter(Boolean);

    let ok = 0;
    let failed = 0;
    for (const block of blocks) {
      try {
        await db.execute(sql.raw(block));
        ok++;
      } catch (err: any) {
        failed++;
        const root = err?.cause ?? err;
        console.warn(
          `[Migrations] Drizzle ${file}: bloco ignorado (${root?.code ?? "?"}): ${root?.message?.split("\n")[0]}`,
        );
      }
    }

    await db.execute(sql.raw(
      `INSERT INTO "_applied_migrations" ("name") VALUES ('${trackerKey.replace(/'/g, "''")}') ON CONFLICT ("name") DO NOTHING;`,
    ));
    console.log(
      `[Migrations] Drizzle aplicado: ${file} (${ok} ok, ${failed} ignorado)`,
    );
  }
}

export const MIGRATIONS: Array<{ name: string; sql: string | string[] }> = [
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
  {
    name: "add_billing_type_and_withheld_tax_to_invoices",
    sql: `DO $$ BEGIN CREATE TYPE billing_mode AS ENUM ('bruto', 'liquido'); EXCEPTION WHEN duplicate_object THEN NULL; END $$; ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "billingType" billing_mode NOT NULL DEFAULT 'bruto'; ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "withheldTax" numeric(12, 2);`,
  },
  {
    name: "add_partner_id_to_campaigns",
    sql: `ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "partnerId" integer REFERENCES "partners"("id") ON DELETE SET NULL; CREATE INDEX IF NOT EXISTS "idx_campaigns_partner_id" ON "campaigns" ("partnerId");`,
  },
  {
    name: "add_is_bonificada_to_campaigns",
    sql: `ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "isBonificada" boolean DEFAULT false NOT NULL;`,
  },
  {
    name: "create_accounts_payable_table",
    sql: `
      CREATE TABLE IF NOT EXISTS "accounts_payable" (
        "id" SERIAL PRIMARY KEY,
        "campaignId" INTEGER NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
        "invoiceId" INTEGER REFERENCES "invoices"("id") ON DELETE SET NULL,
        "type" VARCHAR(30) NOT NULL,
        "description" TEXT NOT NULL,
        "amount" NUMERIC(12,2) NOT NULL,
        "dueDate" DATE,
        "paymentDate" DATE,
        "status" VARCHAR(20) NOT NULL DEFAULT 'pendente',
        "recipientName" VARCHAR(255),
        "recipientType" VARCHAR(30),
        "notes" TEXT,
        "proofUrl" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "idx_accounts_payable_campaign_id" ON "accounts_payable" ("campaignId");
      CREATE INDEX IF NOT EXISTS "idx_accounts_payable_status" ON "accounts_payable" ("status");
      CREATE INDEX IF NOT EXISTS "idx_accounts_payable_type" ON "accounts_payable" ("type");
    `,
  },
  {
    name: "add_supplier_id_to_accounts_payable",
    sql: `ALTER TABLE "accounts_payable" ADD COLUMN IF NOT EXISTS "supplierId" INTEGER REFERENCES "suppliers"("id") ON DELETE SET NULL;`,
  },
  {
    name: "enforce_campaign_id_not_null_accounts_payable",
    sql: `
      DELETE FROM "accounts_payable" WHERE "campaignId" IS NULL;
      ALTER TABLE "accounts_payable" ALTER COLUMN "campaignId" SET NOT NULL;
    `,
  },
  {
    name: "drop_recipient_name_from_accounts_payable",
    sql: `ALTER TABLE "accounts_payable" DROP COLUMN IF EXISTS "recipientName";`,
  },
  {
    name: "add_janelas_digitais_to_product_type_enum",
    sql: `ALTER TYPE product_type ADD VALUE IF NOT EXISTS 'janelas_digitais';`,
  },
  {
    name: "create_vip_providers_table",
    sql: `
      CREATE TABLE IF NOT EXISTS "vip_providers" (
        "id" SERIAL PRIMARY KEY NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "company" VARCHAR(255),
        "cnpj" VARCHAR(20),
        "contactName" VARCHAR(255),
        "contactPhone" VARCHAR(50),
        "contactEmail" VARCHAR(320),
        "location" VARCHAR(255),
        "commissionPercent" NUMERIC(5,2) NOT NULL DEFAULT 10.00,
        "billingMode" billing_mode NOT NULL DEFAULT 'bruto',
        "status" status NOT NULL DEFAULT 'active',
        "notes" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "idx_vip_providers_status" ON "vip_providers" ("status");
      CREATE INDEX IF NOT EXISTS "idx_vip_providers_cnpj" ON "vip_providers" ("cnpj");
    `,
  },
  {
    // Task #186 — vincula projeto custom (sob medida) a um provedor VIP
    // para permitir auto-materialização de AP `vip_repasse` da fatia custom
    // em cotações mistas/puro-custom digitais.
    // NOTE (Task #212): movido para DEPOIS de `create_vip_providers_table`
    // porque o FK depende da tabela existir. Em prod isso já estava aplicado
    // (tracker preserva por `name`, não por índice no array), mas em bancos
    // fresh a ordem original quebrava — o ALTER falhava silencioso na 1ª
    // execução e só convergia na 2ª.
    name: "add_custom_vip_provider_to_quotations",
    sql: `ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "customVipProviderId" integer REFERENCES "vip_providers"("id") ON DELETE SET NULL;`,
  },
  {
    name: "add_vip_provider_to_products",
    sql: `
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "vipProviderId" INTEGER REFERENCES "vip_providers"("id") ON DELETE SET NULL;
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "vipProviderCommissionPercent" NUMERIC(5,2);
    `,
  },
  {
    name: "extend_accounts_payable_recipient_for_vip",
    sql: `
      ALTER TABLE "accounts_payable" ADD COLUMN IF NOT EXISTS "vipProviderId" INTEGER REFERENCES "vip_providers"("id") ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS "idx_accounts_payable_vip_provider_id" ON "accounts_payable" ("vipProviderId");
    `,
  },
  {
    name: "add_iss_fields_to_invoices",
    sql: `
      ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "issRate" NUMERIC(5,2) DEFAULT 0.00;
      ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "issRetained" BOOLEAN NOT NULL DEFAULT false;
    `,
  },
  {
    // FASE 1 da refatoração multi-produto + fases:
    // Cria tabelas campaign_phases e campaign_items.
    // Não-destrutivo: mantém campos antigos de campaigns (coastersPerRestaurant,
    // batchCost, etc.) em paralelo. Backfill automático em seguida.
    name: "create_campaign_phases_and_items",
    sql: `
      DO $$ BEGIN
        CREATE TYPE campaign_phase_status AS ENUM ('planejada', 'ativa', 'concluida', 'cancelada');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      CREATE TABLE IF NOT EXISTS "campaign_phases" (
        "id" SERIAL PRIMARY KEY NOT NULL,
        "campaignId" INTEGER NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
        "sequence" INTEGER NOT NULL,
        "label" VARCHAR(100) NOT NULL,
        "periodStart" DATE NOT NULL,
        "periodEnd" DATE NOT NULL,
        "status" campaign_phase_status NOT NULL DEFAULT 'planejada',
        "notes" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL,
        CONSTRAINT "uq_campaign_phase_sequence" UNIQUE("campaignId", "sequence")
      );
      CREATE INDEX IF NOT EXISTS "idx_campaign_phases_campaign_id" ON "campaign_phases" ("campaignId");
      CREATE INDEX IF NOT EXISTS "idx_campaign_phases_status" ON "campaign_phases" ("status");
      CREATE INDEX IF NOT EXISTS "idx_campaign_phases_period" ON "campaign_phases" ("periodStart", "periodEnd");

      CREATE TABLE IF NOT EXISTS "campaign_items" (
        "id" SERIAL PRIMARY KEY NOT NULL,
        "campaignPhaseId" INTEGER NOT NULL REFERENCES "campaign_phases"("id") ON DELETE CASCADE,
        "productId" INTEGER NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
        "quantity" INTEGER NOT NULL DEFAULT 1,
        "unitPrice" NUMERIC(12,4) NOT NULL DEFAULT 0,
        "totalPrice" NUMERIC(14,2),
        "productionCost" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "freightCost" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "notes" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "idx_campaign_items_phase_id" ON "campaign_items" ("campaignPhaseId");
      CREATE INDEX IF NOT EXISTS "idx_campaign_items_product_id" ON "campaign_items" ("productId");
    `,
  },
  {
    // FASE 1: FKs em invoices e accounts_payable pra ligar com fase/item.
    name: "add_phase_item_fks_to_financial_tables",
    sql: `
      ALTER TABLE "invoices"
        ADD COLUMN IF NOT EXISTS "campaignPhaseId" INTEGER
        REFERENCES "campaign_phases"("id") ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS "idx_invoices_campaign_phase_id"
        ON "invoices" ("campaignPhaseId");

      ALTER TABLE "accounts_payable"
        ADD COLUMN IF NOT EXISTS "campaignPhaseId" INTEGER
        REFERENCES "campaign_phases"("id") ON DELETE SET NULL;
      ALTER TABLE "accounts_payable"
        ADD COLUMN IF NOT EXISTS "campaignItemId" INTEGER
        REFERENCES "campaign_items"("id") ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS "idx_accounts_payable_campaign_phase_id"
        ON "accounts_payable" ("campaignPhaseId");
      CREATE INDEX IF NOT EXISTS "idx_accounts_payable_campaign_item_id"
        ON "accounts_payable" ("campaignItemId");
    `,
  },
  {
    // FASE 1 - Backfill: pra cada campanha existente, cria fases mensais
    // baseadas em contractDuration, e 1 item "default" por fase com o produto
    // atual + coastersPerRestaurant como quantity (quando produto for coaster).
    // Idempotente: só cria fases se a campanha não tiver nenhuma.
    name: "backfill_campaign_phases_and_items",
    sql: `
      DO $$
      DECLARE
        c RECORD;
        months INT;
        i INT;
        phase_start DATE;
        phase_end DATE;
        phase_id INT;
        resolved_product_id INT;
        resolved_qty INT;
        resolved_unit_price NUMERIC(12,4);
        resolved_total_price NUMERIC(14,2);
      BEGIN
        FOR c IN
          SELECT cp.*
          FROM "campaigns" cp
          WHERE NOT EXISTS (
            SELECT 1 FROM "campaign_phases" ph WHERE ph."campaignId" = cp."id"
          )
        LOOP
          months := GREATEST(COALESCE(c."contractDuration", 1), 1);
          resolved_product_id := c."productId";

          -- Se campanha não tem productId, pega o primeiro produto disponível
          -- (fallback pra dados realmente antigos)
          IF resolved_product_id IS NULL THEN
            SELECT id INTO resolved_product_id FROM "products" ORDER BY id LIMIT 1;
          END IF;

          resolved_qty := COALESCE(c."coastersPerRestaurant", 0) * COALESCE(c."activeRestaurants", 0);
          IF resolved_qty <= 0 THEN resolved_qty := 1; END IF;

          resolved_unit_price := COALESCE(c."fixedPrice"::numeric, 0);
          IF resolved_unit_price = 0 AND resolved_qty > 0 THEN
            resolved_unit_price := 0;
          END IF;
          resolved_total_price := resolved_unit_price * resolved_qty;

          FOR i IN 1..months LOOP
            phase_start := (c."startDate"::date) + ((i - 1) * INTERVAL '1 month');
            phase_end := phase_start + INTERVAL '1 month' - INTERVAL '1 day';

            INSERT INTO "campaign_phases" (
              "campaignId", "sequence", "label", "periodStart", "periodEnd",
              "status", "notes", "createdAt", "updatedAt"
            ) VALUES (
              c.id, i,
              'Mês ' || i,
              phase_start,
              phase_end,
              CASE
                WHEN c."status" IN ('completed', 'archived', 'inativa') THEN 'concluida'::campaign_phase_status
                WHEN c."status" IN ('cancelada') THEN 'cancelada'::campaign_phase_status
                WHEN c."status" IN ('veiculacao', 'executar') THEN 'ativa'::campaign_phase_status
                ELSE 'planejada'::campaign_phase_status
              END,
              'Fase gerada automaticamente no backfill',
              NOW(), NOW()
            )
            RETURNING id INTO phase_id;

            -- Cria 1 item default por fase (se tiver produto resolvido)
            IF resolved_product_id IS NOT NULL THEN
              INSERT INTO "campaign_items" (
                "campaignPhaseId", "productId", "quantity",
                "unitPrice", "totalPrice",
                "productionCost", "freightCost",
                "notes", "createdAt", "updatedAt"
              ) VALUES (
                phase_id, resolved_product_id,
                COALESCE(c."coastersPerRestaurant", 1),
                resolved_unit_price,
                resolved_unit_price * COALESCE(c."coastersPerRestaurant", 1),
                COALESCE(c."batchCost"::numeric, 0),
                COALESCE(c."freightCost"::numeric, 0),
                'Item gerado automaticamente no backfill',
                NOW(), NOW()
              );
            END IF;
          END LOOP;
        END LOOP;
      END $$;
    `,
  },
  {
    // Refaz o backfill de fases — a versão original quebrava porque comparava
    // c.status com 'cancelada' (que não existe em campaign_status). Idempotente.
    name: "backfill_campaign_phases_v2",
    sql: `
      DO $$
      DECLARE
        c RECORD;
        months INT;
        i INT;
        phase_start DATE;
        phase_end DATE;
        phase_id INT;
        resolved_product_id INT;
      BEGIN
        FOR c IN
          SELECT cp.*
          FROM "campaigns" cp
          WHERE NOT EXISTS (
            SELECT 1 FROM "campaign_phases" ph WHERE ph."campaignId" = cp."id"
          )
        LOOP
          months := GREATEST(COALESCE(c."contractDuration", 1), 1);
          resolved_product_id := c."productId";
          IF resolved_product_id IS NULL THEN
            SELECT id INTO resolved_product_id FROM "products" ORDER BY id LIMIT 1;
          END IF;

          FOR i IN 1..months LOOP
            phase_start := (c."startDate"::date) + ((i - 1) * INTERVAL '1 month');
            phase_end := phase_start + INTERVAL '1 month' - INTERVAL '1 day';

            INSERT INTO "campaign_phases" (
              "campaignId", "sequence", "label", "periodStart", "periodEnd",
              "status", "notes", "createdAt", "updatedAt"
            ) VALUES (
              c.id, i,
              'Mês ' || i,
              phase_start,
              phase_end,
              CASE
                WHEN c."status"::text IN ('completed','archived','inativa') THEN 'concluida'::campaign_phase_status
                WHEN c."status"::text IN ('veiculacao','executar','distribuicao') THEN 'ativa'::campaign_phase_status
                ELSE 'planejada'::campaign_phase_status
              END,
              'Fase gerada automaticamente no backfill',
              NOW(), NOW()
            )
            RETURNING id INTO phase_id;

            IF resolved_product_id IS NOT NULL THEN
              INSERT INTO "campaign_items" (
                "campaignPhaseId", "productId", "quantity",
                "unitPrice", "totalPrice",
                "productionCost", "freightCost",
                "notes", "createdAt", "updatedAt"
              ) VALUES (
                phase_id, resolved_product_id,
                COALESCE(c."coastersPerRestaurant", 1),
                COALESCE(c."fixedPrice"::numeric, 0),
                COALESCE(c."fixedPrice"::numeric, 0) * COALESCE(c."coastersPerRestaurant", 1),
                COALESCE(c."batchCost"::numeric, 0),
                COALESCE(c."freightCost"::numeric, 0),
                'Item gerado automaticamente no backfill',
                NOW(), NOW()
              );
            END IF;
          END LOOP;
        END LOOP;
      END $$;
    `,
  },
  {
    // Recria campaign_items a partir de quotation_items quando a soma do
    // totalPrice das fases está zerada — as versões anteriores do backfill
    // copiavam c.fixedPrice (NULL/0 em quase todas as campanhas), o que
    // resultava em receita prevista R$ 0,00 no overview.
    // Idempotente: só toca em campanhas (com cotação válida) cujos itens
    // ainda somam zero.
    name: "backfill_campaign_items_from_quotation_v3",
    sql: `
      DO $$
      DECLARE
        c RECORD;
        r_qi RECORD;
        r_ph RECORD;
        num_phases INT;
      BEGIN
        FOR c IN
          SELECT cp.id AS campaign_id, cp."quotationId"
          FROM campaigns cp
          WHERE cp."quotationId" IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM quotation_items qit
              WHERE qit."quotationId" = cp."quotationId"
                AND COALESCE(qit."totalPrice"::numeric, 0) > 0
            )
            AND COALESCE((
              SELECT SUM(COALESCE(ci."totalPrice"::numeric, 0))
              FROM campaign_items ci
              JOIN campaign_phases php ON php.id = ci."campaignPhaseId"
              WHERE php."campaignId" = cp.id
            ), 0) = 0
        LOOP
          SELECT COUNT(*)::int INTO num_phases
          FROM campaign_phases WHERE "campaignId" = c.campaign_id;

          IF num_phases <= 0 THEN CONTINUE; END IF;

          DELETE FROM campaign_items
          WHERE "campaignPhaseId" IN (
            SELECT id FROM campaign_phases WHERE "campaignId" = c.campaign_id
          );

          FOR r_ph IN
            SELECT id FROM campaign_phases
            WHERE "campaignId" = c.campaign_id
            ORDER BY sequence
          LOOP
            FOR r_qi IN
              SELECT * FROM quotation_items
              WHERE "quotationId" = c."quotationId"
              ORDER BY id
            LOOP
              INSERT INTO campaign_items (
                "campaignPhaseId", "productId", quantity,
                "unitPrice", "totalPrice",
                "productionCost", "freightCost",
                notes, "createdAt", "updatedAt"
              ) VALUES (
                r_ph.id,
                r_qi."productId",
                COALESCE(r_qi.quantity, 1),
                COALESCE(r_qi."unitPrice"::numeric, 0),
                ROUND(COALESCE(r_qi."totalPrice"::numeric, 0) / num_phases, 2),
                0, 0,
                'Recriado a partir da cotação (rateio por fase)',
                NOW(), NOW()
              );
            END LOOP;
          END LOOP;
        END LOOP;
      END $$;
    `,
  },
  {
    // Renomeia todas as campanhas existentes para o padrão
    // "<Cliente> — Lote <Mês>/<Ano>" (ex: "Brahma — Lote Jan/2026").
    // Idempotente: só atualiza nomes que ainda não estão no formato novo.
    // Adiciona timestamps de timeline própria por batch (mesmas etapas
    // do pipeline da campanha) em campaign_phases. Idempotente.
    name: "add_campaign_phase_id_to_service_orders",
    sql: `
      ALTER TABLE "service_orders"
        ADD COLUMN IF NOT EXISTS "campaignPhaseId" integer
        REFERENCES "campaign_phases"(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS "idx_service_orders_campaign_phase_id"
        ON "service_orders" ("campaignPhaseId");
    `,
  },
  {
    name: "add_batch_timeline_columns",
    sql: `
      ALTER TABLE "campaign_phases"
        ADD COLUMN IF NOT EXISTS "briefingEnteredAt" timestamp,
        ADD COLUMN IF NOT EXISTS "designEnteredAt" timestamp,
        ADD COLUMN IF NOT EXISTS "aprovacaoEnteredAt" timestamp,
        ADD COLUMN IF NOT EXISTS "producaoEnteredAt" timestamp,
        ADD COLUMN IF NOT EXISTS "distribuicaoEnteredAt" timestamp,
        ADD COLUMN IF NOT EXISTS "veiculacaoEnteredAt" timestamp,
        ADD COLUMN IF NOT EXISTS "concluidaAt" timestamp;
    `,
  },
  {
    // Troca o termo "Lote" por "Batch" no nome de todas as campanhas
    // (ex: "UNIPAR — Lote Abr/2026" → "UNIPAR — Batch Abr/2026").
    // Idempotente: só toca em quem ainda usa "— Lote ".
    name: "rename_campaigns_lote_to_batch",
    sql: `
      UPDATE "campaigns"
      SET "name" = REPLACE("name", ' — Lote ', ' — Batch '),
          "updatedAt" = NOW()
      WHERE "name" LIKE '% — Lote %';
    `,
  },
  {
    name: "rename_campaigns_to_lote_format",
    sql: `
      UPDATE "campaigns" c
      SET "name" = cli."name" || ' — Batch ' ||
        (CASE EXTRACT(MONTH FROM c."startDate"::date)::int
          WHEN 1 THEN 'Jan' WHEN 2 THEN 'Fev' WHEN 3 THEN 'Mar' WHEN 4 THEN 'Abr'
          WHEN 5 THEN 'Mai' WHEN 6 THEN 'Jun' WHEN 7 THEN 'Jul' WHEN 8 THEN 'Ago'
          WHEN 9 THEN 'Set' WHEN 10 THEN 'Out' WHEN 11 THEN 'Nov' WHEN 12 THEN 'Dez'
        END) || '/' || EXTRACT(YEAR FROM c."startDate"::date)::int::text,
        "updatedAt" = NOW()
      FROM "clients" cli
      WHERE cli.id = c."clientId"
        AND c."name" !~ ' — (Batch|Lote) (Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)/[0-9]{4}\\b';
    `,
  },
  {
    name: "add_agency_bv_to_campaigns",
    sql: `
      ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "hasAgencyBv" boolean DEFAULT true NOT NULL;
      ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "agencyBvPercent" numeric(5, 2) DEFAULT '20.00' NOT NULL;
    `,
  },
  {
    name: "add_utm_tracking_to_clients",
    sql: `
      ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "utm_source" varchar(255);
      ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "utm_medium" varchar(255);
      ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "utm_campaign" varchar(255);
      ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "utm_content" varchar(255);
      ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "utm_term" varchar(255);
      ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "referrer" varchar(500);
      ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "landing_path" varchar(255);
      CREATE INDEX IF NOT EXISTS "idx_clients_utm_source" ON "clients" ("utm_source");
      CREATE INDEX IF NOT EXISTS "idx_clients_utm_campaign" ON "clients" ("utm_campaign");
    `,
  },
  {
    // Marketplace v2 — schema base:
    //  • product_locations.maxShares / cycleWeeks (capacidade de shares por local)
    //  • campaign_items.restaurantId / shareIndex (rastreio de share por item)
    //  • invoices.documentUrl / documentLabel (documentos financeiros)
    //  • seasonal_multipliers (multiplicadores sazonais de preço)
    //  • campaign_drafts (persistência de carrinho do /montar-campanha)
    name: "marketplace_v2_schema_base",
    sql: `
      ALTER TABLE "product_locations"
        ADD COLUMN IF NOT EXISTS "maxShares" integer NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS "cycleWeeks" integer NOT NULL DEFAULT 4;

      ALTER TABLE "campaign_items"
        ADD COLUMN IF NOT EXISTS "restaurantId" integer
          REFERENCES "active_restaurants"("id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "shareIndex" integer;
      CREATE INDEX IF NOT EXISTS "idx_campaign_items_restaurant_id"
        ON "campaign_items" ("restaurantId");

      ALTER TABLE "invoices"
        ADD COLUMN IF NOT EXISTS "documentUrl" text,
        ADD COLUMN IF NOT EXISTS "documentLabel" varchar(255);

      CREATE TABLE IF NOT EXISTS "seasonal_multipliers" (
        "id" serial PRIMARY KEY NOT NULL,
        "productId" integer NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
        "restaurantId" integer REFERENCES "active_restaurants"("id") ON DELETE CASCADE,
        "seasonLabel" varchar(100) NOT NULL,
        "startDate" date NOT NULL,
        "endDate" date NOT NULL,
        "multiplier" numeric(5, 2) NOT NULL DEFAULT 1.00,
        "createdAt" timestamp DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "idx_seasonal_multipliers_product_id"
        ON "seasonal_multipliers" ("productId");
      CREATE INDEX IF NOT EXISTS "idx_seasonal_multipliers_restaurant_id"
        ON "seasonal_multipliers" ("restaurantId");
      CREATE INDEX IF NOT EXISTS "idx_seasonal_multipliers_period"
        ON "seasonal_multipliers" ("startDate", "endDate");

      CREATE TABLE IF NOT EXISTS "campaign_drafts" (
        "id" serial PRIMARY KEY NOT NULL,
        "clientId" integer NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
        "cartJson" jsonb NOT NULL,
        "expiresAt" timestamp,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "idx_campaign_drafts_client_id"
        ON "campaign_drafts" ("clientId");
      CREATE INDEX IF NOT EXISTS "idx_campaign_drafts_expires_at"
        ON "campaign_drafts" ("expiresAt");
    `,
  },
  {
    // Marketplace v2 — ajustes de contrato de schema:
    //  • campaign_drafts.expiresAt: NOT NULL (semântica de expiração obrigatória).
    //  • invoices.documentLabel: varchar(100) (label curta).
    // Tabelas/colunas recém-criadas estão vazias, então aplicar com segurança.
    name: "marketplace_v2_schema_adjustments",
    sql: `
      ALTER TABLE "invoices"
        ALTER COLUMN "documentLabel" TYPE varchar(100);

      UPDATE "campaign_drafts"
        SET "expiresAt" = NOW() + INTERVAL '7 days'
        WHERE "expiresAt" IS NULL;
      ALTER TABLE "campaign_drafts"
        ALTER COLUMN "expiresAt" SET NOT NULL;
    `,
  },
  {
    // Refatoração financeira fase 1 — Glossário.
    // Mapeia cada coluna ao termo de negócio definido em
    // docs/financeiro-glossario.md. Idempotente (COMMENT é sempre seguro).
    name: "finrefac_01_glossary_comments",
    sql: `
      COMMENT ON TABLE "invoices" IS 'Fatura emitida ao anunciante (recebível). Glossário: docs/financeiro-glossario.md §5';
      COMMENT ON COLUMN "invoices"."amount" IS 'Receita Bruta — valor total da fatura antes de deduções.';
      COMMENT ON COLUMN "invoices"."billingType" IS 'Modo de faturamento: bruto (valor cheio) | liquido (já descontado o repasse).';
      COMMENT ON COLUMN "invoices"."withheldTax" IS 'Imposto Retido (cash) — valor em R$ retido pelo cliente.';
      COMMENT ON COLUMN "invoices"."issRate" IS 'Alíquota ISS (% sobre o serviço).';
      COMMENT ON COLUMN "invoices"."issRetained" IS 'true: ISS retido pelo tomador (sai do líquido); false: empresa recolhe depois.';
      COMMENT ON COLUMN "invoices"."issueDate" IS 'Data de emissão da fatura (base para DRE Competência).';
      COMMENT ON COLUMN "invoices"."dueDate" IS 'Vencimento da fatura.';
      COMMENT ON COLUMN "invoices"."paymentDate" IS 'Recebimento — data em que o cliente efetivamente pagou (base para DRE Caixa).';
      COMMENT ON COLUMN "invoices"."status" IS 'emitida | enviada | paga | vencida | cancelada. Apenas emitida é editável.';

      COMMENT ON TABLE "restaurant_payments" IS 'Repasse Restaurante — gerado quando há Comissão Restaurante (produtos físicos).';
      COMMENT ON COLUMN "restaurant_payments"."amount" IS 'Repasse Restaurante — valor em R$ devido ao restaurante.';
      COMMENT ON COLUMN "restaurant_payments"."paymentDate" IS 'Data do pagamento efetivo ao restaurante.';
      COMMENT ON COLUMN "restaurant_payments"."status" IS 'pending | paid.';

      COMMENT ON TABLE "operational_costs" IS 'Custo Operacional — agregado por campanha (produção + frete).';
      COMMENT ON COLUMN "operational_costs"."productionCost" IS 'Custo de Produção — fabricação do material físico (bolachas). Não se aplica a produtos digitais.';
      COMMENT ON COLUMN "operational_costs"."freightCost" IS 'Custo de Frete — gráfica → restaurantes. Não se aplica a produtos digitais.';

      COMMENT ON TABLE "partners" IS 'Parceiros indicadores/agências que recebem Comissão Parceiro.';
      COMMENT ON COLUMN "partners"."commissionPercent" IS 'Comissão Parceiro — % sobre a base definida em billingMode.';
      COMMENT ON COLUMN "partners"."billingMode" IS 'Base de cálculo da comissão: bruto (sobre receita bruta) | liquido (após impostos).';

      COMMENT ON TABLE "vip_providers" IS 'Provedores de Sala VIP — recebem Repasse Sala VIP (produtos digitais em tela/janela).';
      COMMENT ON COLUMN "vip_providers"."billingMode" IS 'Base do repasse: bruto | liquido.';

      COMMENT ON TABLE "accounts_payable" IS 'Ledger único de Contas a Pagar (produção, frete, comissões, repasses VIP). Glossário §4.';
      COMMENT ON COLUMN "accounts_payable"."type" IS 'producao | frete | comissao | repasse_vip | outro.';
      COMMENT ON COLUMN "accounts_payable"."amount" IS 'Valor em R$ a pagar.';
      COMMENT ON COLUMN "accounts_payable"."dueDate" IS 'Vencimento do título.';
      COMMENT ON COLUMN "accounts_payable"."paymentDate" IS 'Data do pagamento efetivo.';
      COMMENT ON COLUMN "accounts_payable"."status" IS 'pendente | pago | cancelado.';
      COMMENT ON COLUMN "accounts_payable"."recipientType" IS 'fornecedor | parceiro | vip_provider | restaurante.';

      COMMENT ON COLUMN "campaigns"."restaurantCommission" IS 'Comissão Restaurante (%) — pulada para produtos digitais.';
      COMMENT ON COLUMN "campaigns"."sellerCommission" IS 'Comissão Vendedor (%).';
      COMMENT ON COLUMN "campaigns"."taxRate" IS 'Imposto sobre Receita (%) — alíquota geral da campanha.';
      COMMENT ON COLUMN "campaigns"."productionCost" IS 'Snapshot do Custo de Produção (R$) na criação da campanha.';
      COMMENT ON COLUMN "campaigns"."freightCost" IS 'Snapshot do Custo de Frete (R$) na criação da campanha.';
    `,
  },
  {
    // Refatoração financeira fase 1 — Rename físico de coluna.
    // vip_providers.commissionPercent → repassePercent (termo correto do
    // glossário: "Repasse Sala VIP", não "comissão"). Idempotente: só
    // renomeia se a coluna antiga existir e a nova ainda não existir.
    // Reversível: trocar os nomes no DO block para reverter.
    name: "finrefac_01_rename_vip_provider_commission_to_repasse",
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'vip_providers' AND column_name = 'commissionPercent'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'vip_providers' AND column_name = 'repassePercent'
        ) THEN
          ALTER TABLE "vip_providers" RENAME COLUMN "commissionPercent" TO "repassePercent";
        END IF;
      END $$;
      COMMENT ON COLUMN "vip_providers"."repassePercent" IS 'Repasse Sala VIP — % devido ao provedor sobre a base definida em billingMode. (renomeado de commissionPercent na fase 1)';
    `,
  },
  {
    // Refatoração financeira fase 2 — Consolidar accounts_payable como
    // ledger único de obrigações futuras (contas a pagar). Adiciona:
    //   • sourceType (enum):  origem semântica do título.
    //   • sourceRef (jsonb):  identificadores da entidade-origem
    //                         (ex.: { restaurantPaymentId, invoiceId, campaignItemId }).
    //   • competenceMonth (varchar 7 = "YYYY-MM"): mês de competência DRE.
    //   • createdBySystem (bool): true quando título foi gerado por
    //                             trigger/sync (não por operador humano).
    // Backfilla as colunas a partir do `type` legado e dos dados existentes.
    // Idempotente: usa IF NOT EXISTS em colunas/índices e DO blocks em
    // constraints. Não destrutivo — `type` permanece para compat.
    name: "finrefac_02_accounts_payable_ledger_columns",
    sql: [
      // Chunk 1: criar/normalizar o enum. Precisa rodar em transação
      // separada do uso (PG não permite ADD VALUE + uso na mesma tx,
      // erro 55P04 unsafe use of new value). Lida com DBs onde o enum
      // já existe com valores legados (ex.: 'bv_campanha').
      `
      DO $$ BEGIN
        CREATE TYPE accounts_payable_source_type AS ENUM (
          'restaurant_commission',
          'vip_repasse',
          'supplier_cost',
          'freight_cost',
          'partner_commission',
          'seller_commission',
          'tax',
          'manual'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      `,
      `ALTER TYPE accounts_payable_source_type ADD VALUE IF NOT EXISTS 'restaurant_commission';`,
      `ALTER TYPE accounts_payable_source_type ADD VALUE IF NOT EXISTS 'vip_repasse';`,
      `ALTER TYPE accounts_payable_source_type ADD VALUE IF NOT EXISTS 'supplier_cost';`,
      `ALTER TYPE accounts_payable_source_type ADD VALUE IF NOT EXISTS 'freight_cost';`,
      `ALTER TYPE accounts_payable_source_type ADD VALUE IF NOT EXISTS 'partner_commission';`,
      `ALTER TYPE accounts_payable_source_type ADD VALUE IF NOT EXISTS 'seller_commission';`,
      `ALTER TYPE accounts_payable_source_type ADD VALUE IF NOT EXISTS 'tax';`,
      `ALTER TYPE accounts_payable_source_type ADD VALUE IF NOT EXISTS 'manual';`,
      // Chunk 2: colunas, backfills, índices e constraints. Já pode
      // referenciar livremente todos os labels canônicos.
      `
      ALTER TABLE "accounts_payable"
        ADD COLUMN IF NOT EXISTS "sourceType" accounts_payable_source_type;
      ALTER TABLE "accounts_payable"
        ADD COLUMN IF NOT EXISTS "sourceRef" jsonb;
      ALTER TABLE "accounts_payable"
        ADD COLUMN IF NOT EXISTS "competenceMonth" varchar(7);
      ALTER TABLE "accounts_payable"
        ADD COLUMN IF NOT EXISTS "createdBySystem" boolean NOT NULL DEFAULT false;

      -- Backfill sourceType a partir do type legado.
      UPDATE "accounts_payable" SET "sourceType" = CASE
        WHEN "type" = 'producao'      THEN 'supplier_cost'::accounts_payable_source_type
        WHEN "type" = 'frete'         THEN 'freight_cost'::accounts_payable_source_type
        WHEN "type" = 'comissao'      THEN 'partner_commission'::accounts_payable_source_type
        WHEN "type" = 'repasse_vip'   THEN 'vip_repasse'::accounts_payable_source_type
        WHEN "type" = 'comissao_vendedor' THEN 'seller_commission'::accounts_payable_source_type
        WHEN "type" = 'imposto'       THEN 'tax'::accounts_payable_source_type
        ELSE 'manual'::accounts_payable_source_type
      END
      WHERE "sourceType" IS NULL;

      -- Backfill competenceMonth: prefere dueDate, cai em createdAt.
      UPDATE "accounts_payable"
      SET "competenceMonth" = TO_CHAR(COALESCE("dueDate", "createdAt"::date), 'YYYY-MM')
      WHERE "competenceMonth" IS NULL;

      -- Linhas geradas em loops automáticos de sync (producao/frete) marcam
      -- createdBySystem=true. Lançamentos manuais ficam em false.
      UPDATE "accounts_payable" SET "createdBySystem" = true
      WHERE "createdBySystem" = false
        AND "sourceType" IN ('supplier_cost','freight_cost','vip_repasse','partner_commission','restaurant_commission');

      -- Backfill sourceRef mínimo para títulos de invoice (quando linkados).
      UPDATE "accounts_payable"
      SET "sourceRef" = jsonb_build_object('invoiceId', "invoiceId")
      WHERE "sourceRef" IS NULL AND "invoiceId" IS NOT NULL;

      -- Após backfill, sourceType vira NOT NULL.
      ALTER TABLE "accounts_payable"
        ALTER COLUMN "sourceType" SET NOT NULL;

      CREATE INDEX IF NOT EXISTS "idx_accounts_payable_status_due"
        ON "accounts_payable" ("status", "dueDate");
      CREATE INDEX IF NOT EXISTS "idx_accounts_payable_source_type_competence"
        ON "accounts_payable" ("sourceType", "competenceMonth");
      CREATE INDEX IF NOT EXISTS "idx_accounts_payable_source_ref_invoice"
        ON "accounts_payable" ((("sourceRef"->>'invoiceId')));

      DO $$ BEGIN
        ALTER TABLE "accounts_payable"
          ADD CONSTRAINT "chk_accounts_payable_amount_positive"
          CHECK ("amount"::numeric > 0);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      -- Sanity: corrige rows legadas com dueDate < createdAt antes de criar
      -- a constraint, para o backfill não bloqueá-la.
      UPDATE "accounts_payable"
      SET "dueDate" = "createdAt"::date
      WHERE "createdBySystem" = true
        AND "dueDate" IS NOT NULL
        AND "dueDate" < "createdAt"::date;

      DO $$ BEGIN
        ALTER TABLE "accounts_payable"
          ADD CONSTRAINT "chk_accounts_payable_due_after_created"
          CHECK (
            "createdBySystem" = false
            OR "dueDate" IS NULL
            OR "dueDate" >= "createdAt"::date
          );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      COMMENT ON COLUMN "accounts_payable"."sourceType" IS 'Origem semântica: restaurant_commission | vip_repasse | supplier_cost | freight_cost | partner_commission | seller_commission | tax | manual. Glossário §4.';
      COMMENT ON COLUMN "accounts_payable"."sourceRef" IS 'JSON com ids da entidade-origem (ex.: invoiceId, restaurantPaymentId, campaignItemId).';
      COMMENT ON COLUMN "accounts_payable"."competenceMonth" IS 'Mês de competência (YYYY-MM) para DRE/relatórios.';
      COMMENT ON COLUMN "accounts_payable"."createdBySystem" IS 'true = gerado por trigger/sync; false = lançamento manual.';
    `,
    ],
  },
  {
    // Refatoração financeira fase 2 — Backfill ledger a partir de
    // restaurant_payments. Para cada pagamento de restaurante existente,
    // garante uma linha equivalente em accounts_payable como ledger único.
    // Idempotente via UNIQUE (sourceType, sourceRef->>'restaurantPaymentId').
    name: "finrefac_02_accounts_payable_backfill_from_restaurant_payments",
    sql: `
      -- Índice único auxiliar pra evitar duplicatas no backfill.
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_ap_restaurant_payment_source"
        ON "accounts_payable" ((("sourceRef"->>'restaurantPaymentId')))
        WHERE "sourceType" = 'restaurant_commission'
          AND "sourceRef" ? 'restaurantPaymentId';

      INSERT INTO "accounts_payable" (
        "campaignId", "type", "description", "amount",
        "dueDate", "paymentDate", "status",
        "recipientType", "notes", "proofUrl",
        "sourceType", "sourceRef", "competenceMonth", "createdBySystem",
        "createdAt", "updatedAt"
      )
      SELECT
        COALESCE(rp."campaignId", (SELECT id FROM campaigns ORDER BY id LIMIT 1)),
        'comissao_restaurante',
        'Comissão Restaurante — ref ' || rp."referenceMonth",
        rp."amount",
        COALESCE(rp."paymentDate", rp."createdAt"::date),
        rp."paymentDate",
        CASE rp."status"
          WHEN 'paid'    THEN 'pago'
          WHEN 'pending' THEN 'pendente'
          ELSE 'pendente'
        END,
        'restaurante',
        rp."notes",
        rp."proofUrl",
        'restaurant_commission'::accounts_payable_source_type,
        jsonb_build_object(
          'restaurantPaymentId', rp."id",
          'restaurantId', rp."restaurantId",
          'campaignId', rp."campaignId"
        ),
        rp."referenceMonth",
        true,
        rp."createdAt",
        rp."createdAt"
      FROM "restaurant_payments" rp
      WHERE rp."campaignId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "accounts_payable" ap
          WHERE ap."sourceType" = 'restaurant_commission'
            AND (ap."sourceRef"->>'restaurantPaymentId')::int = rp."id"
        );
    `,
  },
  {
    // Refatoração financeira fase 2 — View de compat para clientes que
    // querem ler restaurant_payments via ledger sem mudar a query.
    // Não substitui a tabela física `restaurant_payments` (mantida para
    // o RestaurantePortal). Use restaurant_payments_v quando quiser ler
    // SOMENTE a projeção do ledger.
    name: "finrefac_02_create_restaurant_payments_view",
    sql: `
      CREATE OR REPLACE VIEW "restaurant_payments_v" AS
      SELECT
        ap."id",
        ((ap."sourceRef"->>'restaurantId'))::int            AS "restaurantId",
        ap."campaignId",
        ap."amount",
        ap."competenceMonth"                                AS "referenceMonth",
        ap."paymentDate",
        CASE ap."status"
          WHEN 'pago'      THEN 'paid'
          WHEN 'pendente'  THEN 'pending'
          ELSE ap."status"
        END                                                  AS "status",
        NULL::varchar(255)                                   AS "pixKey",
        ap."notes",
        NULL::date                                           AS "periodStart",
        NULL::date                                           AS "periodEnd",
        ap."proofUrl",
        ap."createdAt"
      FROM "accounts_payable" ap
      WHERE ap."sourceType" = 'restaurant_commission';
    `,
  },
  {
    // Refatoração financeira fase 2 — corrige perda de dados / regressões:
    //   (a) accounts_payable.campaignId vira NULLABLE para permitir
    //       espelhar restaurant_payments órfãs (sem campaignId), mas
    //       um CHECK garante que toda outra origem (supplier_cost,
    //       freight_cost, etc.) continua exigindo campaignId.
    //   (b) backfill agora cobre TAMBÉM rp.campaignId IS NULL — sem perda.
    //   (c) competenceMonth fica alinhado a referenceMonth para todas as
    //       linhas de origem 'restaurant_commission' já mirroreadas.
    name: "finrefac_02_accounts_payable_lossless_fixes",
    sql: `
      ALTER TABLE "accounts_payable" ALTER COLUMN "campaignId" DROP NOT NULL;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'chk_accounts_payable_campaign_required'
        ) THEN
          ALTER TABLE "accounts_payable"
          ADD CONSTRAINT "chk_accounts_payable_campaign_required"
          CHECK (
            "campaignId" IS NOT NULL
            OR "sourceType" = 'restaurant_commission'
          );
        END IF;
      END$$;

      INSERT INTO "accounts_payable" (
        "campaignId", "type", "description", "amount",
        "dueDate", "paymentDate", "status",
        "recipientType", "notes", "proofUrl",
        "sourceType", "sourceRef", "competenceMonth", "createdBySystem",
        "createdAt", "updatedAt"
      )
      SELECT
        rp."campaignId",
        'comissao_restaurante',
        'Comissão Restaurante — ref ' || rp."referenceMonth",
        rp."amount"::numeric,
        -- dueDate sempre >= createdAt para satisfazer a invariante
        -- chk_accounts_payable_due_after_created. O período real do
        -- período vive em competenceMonth, não em dueDate.
        GREATEST(
          (rp."referenceMonth" || '-01')::date,
          rp."createdAt"::date
        ),
        rp."paymentDate"::date,
        CASE WHEN rp."status" = 'paid' THEN 'pago' ELSE 'pendente' END,
        'restaurante',
        rp."notes",
        rp."proofUrl",
        'restaurant_commission'::accounts_payable_source_type,
        jsonb_build_object(
          'restaurantPaymentId', rp."id",
          'restaurantId',       rp."restaurantId",
          'campaignId',         rp."campaignId"
        ),
        rp."referenceMonth",
        true,
        rp."createdAt",
        rp."createdAt"
      FROM "restaurant_payments" rp
      WHERE rp."campaignId" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM "accounts_payable" ap
          WHERE ap."sourceType" = 'restaurant_commission'
            AND (ap."sourceRef"->>'restaurantPaymentId')::int = rp."id"
        );

      -- Garante competenceMonth alinhado a referenceMonth para todas as
      -- linhas espelhadas (idempotente).
      UPDATE "accounts_payable" ap
         SET "competenceMonth" = rp."referenceMonth"
        FROM "restaurant_payments" rp
       WHERE ap."sourceType" = 'restaurant_commission'
         AND (ap."sourceRef"->>'restaurantPaymentId')::int = rp."id"
         AND COALESCE(ap."competenceMonth", '') <> rp."referenceMonth";

      -- Sanity: corrige espelhos de restaurant_commission cuja dueDate
      -- ficou < createdAt (caso o referenceMonth seja anterior ao
      -- createdAt do espelho). Período real vive em competenceMonth;
      -- aqui ajustamos só pra satisfazer o invariante.
      UPDATE "accounts_payable"
         SET "dueDate" = "createdAt"::date
       WHERE "createdBySystem" = true
         AND "dueDate" IS NOT NULL
         AND "dueDate" < "createdAt"::date;

      -- Restaura a invariante estrita: dueDate >= createdAt para toda
      -- linha createdBySystem=true, INCLUSIVE restaurant_commission.
      -- Substitui qualquer versão relaxada anterior.
      ALTER TABLE "accounts_payable"
        DROP CONSTRAINT IF EXISTS "chk_accounts_payable_due_after_created";

      DO $$ BEGIN
        ALTER TABLE "accounts_payable"
          ADD CONSTRAINT "chk_accounts_payable_due_after_created"
          CHECK (
            "createdBySystem" = false
            OR "dueDate" IS NULL
            OR "dueDate" >= "createdAt"::date
          );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `,
  },
  {
    // Finrefac fase 3: idempotência ao nível do BD para o ledger de
    // accounts_payable. Cada tipo de obrigação derivada tem uma chave
    // natural única que impede duplicatas sob concorrência.
    //   * tax            -> (sourceRef.invoiceId, sourceRef.kind)
    //   * vip_repasse    -> sourceRef.invoiceId
    //   * partner_commission -> (sourceRef.partnerId, competenceMonth)
    //     [excluindo linhas suplementares — sourceRef.supplementOf IS NOT NULL]
    // Restaurant_commission é gerada via outro caminho (espelho de
    // restaurant_payments) e mantém sua própria unicidade por
    // (sourceRef.restaurantPaymentId).
    name: "finrefac_03_accounts_payable_natural_key_indexes",
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_ap_tax_invoice_kind"
        ON "accounts_payable" (
          ("sourceRef"->>'invoiceId'),
          ("sourceRef"->>'kind')
        )
        WHERE "sourceType" = 'tax'
          AND "status" <> 'cancelada';

      CREATE UNIQUE INDEX IF NOT EXISTS "uq_ap_vip_repasse_invoice"
        ON "accounts_payable" (
          ("sourceRef"->>'invoiceId')
        )
        WHERE "sourceType" = 'vip_repasse'
          AND "status" <> 'cancelada';

      CREATE UNIQUE INDEX IF NOT EXISTS "uq_ap_partner_commission_partner_month"
        ON "accounts_payable" (
          ("sourceRef"->>'partnerId'),
          "competenceMonth"
        )
        WHERE "sourceType" = 'partner_commission'
          AND "status" <> 'cancelada'
          AND ("sourceRef" ? 'supplementOf') = false;

      CREATE UNIQUE INDEX IF NOT EXISTS "uq_ap_restaurant_commission_payment"
        ON "accounts_payable" (
          ("sourceRef"->>'restaurantPaymentId')
        )
        WHERE "sourceType" = 'restaurant_commission'
          AND "status" <> 'cancelada'
          AND ("sourceRef" ? 'restaurantPaymentId');

      -- Quando comissão de restaurante vem da invoice (fluxo trigger),
      -- a chave natural é a invoice. Garante unicidade entre múltiplas
      -- chamadas concorrentes de markInvoicePaid para a mesma invoice.
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_ap_restaurant_commission_invoice"
        ON "accounts_payable" (
          ("sourceRef"->>'invoiceId')
        )
        WHERE "sourceType" = 'restaurant_commission'
          AND "status" <> 'cancelada'
          AND ("sourceRef" ? 'invoiceId');

      CREATE INDEX IF NOT EXISTS "idx_ap_invoice_ids_gin"
        ON "accounts_payable" USING gin (("sourceRef"->'invoiceIds'));
    `,
  },
  {
    name: "marketplace_v2_quotation_items_share_columns",
    sql: `
      ALTER TABLE "quotation_items" ADD COLUMN IF NOT EXISTS "restaurantId" integer REFERENCES "active_restaurants"("id") ON DELETE SET NULL;
      ALTER TABLE "quotation_items" ADD COLUMN IF NOT EXISTS "shareIndex" integer;
      ALTER TABLE "quotation_items" ADD COLUMN IF NOT EXISTS "cycleWeeks" integer DEFAULT 4;
      ALTER TABLE "quotation_items" ADD COLUMN IF NOT EXISTS "cycles" integer DEFAULT 1;
      CREATE INDEX IF NOT EXISTS "idx_quotation_items_restaurant_id" ON "quotation_items" ("restaurantId");
    `,
  },
  {
    name: "finrefac_05_financial_audit_log",
    sql: `
      CREATE TABLE IF NOT EXISTS "financial_audit_log" (
        "id" serial PRIMARY KEY,
        "entityType" varchar(64) NOT NULL,
        "entityId" integer,
        "action" varchar(64) NOT NULL,
        "actorUserId" varchar,
        "actorRole" varchar(32),
        "before" jsonb,
        "after" jsonb,
        "metadata" jsonb,
        "createdAt" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "idx_fin_audit_entity"
        ON "financial_audit_log" ("entityType", "entityId");
      CREATE INDEX IF NOT EXISTS "idx_fin_audit_actor"
        ON "financial_audit_log" ("actorUserId");
      CREATE INDEX IF NOT EXISTS "idx_fin_audit_created_at"
        ON "financial_audit_log" ("createdAt");
      CREATE INDEX IF NOT EXISTS "idx_fin_audit_action"
        ON "financial_audit_log" ("action");
    `,
  },
  {
    name: "add_users_preferences_jsonb",
    sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferences" jsonb DEFAULT '{}'::jsonb;`,
  },
  {
    name: "add_restaurant_id_to_crm_notifications",
    sql: `ALTER TABLE "crm_notifications" ADD COLUMN IF NOT EXISTS "restaurantId" integer; CREATE INDEX IF NOT EXISTS "idx_crm_notifications_restaurant_id" ON "crm_notifications" ("restaurantId");`,
  },
  {
    // Finrefac #4 — coluna "Recebido em" separada de paymentDate.
    // paymentDate = quando a fatura foi marcada como paga (registro contábil).
    // receivedDate = quando o dinheiro efetivamente entrou em conta (conciliação).
    name: "add_received_date_to_invoices",
    sql: `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "receivedDate" date;`,
  },
  {
    // Finrefac #6 — Conciliação bancária OFX/CSV.
    name: "finrefac_06_bank_reconciliation",
    sql: `
      CREATE TABLE IF NOT EXISTS "bank_accounts" (
        "id" serial PRIMARY KEY,
        "name" varchar(100) NOT NULL,
        "bank" varchar(50) NOT NULL,
        "agency" varchar(20),
        "account" varchar(30),
        "initialBalance" decimal(14,2) NOT NULL DEFAULT '0',
        "currency" varchar(8) NOT NULL DEFAULT 'BRL',
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "bank_transactions" (
        "id" serial PRIMARY KEY,
        "bankAccountId" integer NOT NULL REFERENCES "bank_accounts"("id") ON DELETE CASCADE,
        "date" date NOT NULL,
        "amount" decimal(14,2) NOT NULL,
        "type" varchar(10) NOT NULL,
        "description" text NOT NULL,
        "externalId" varchar(100),
        "importBatchId" varchar(64),
        "reconciled" boolean NOT NULL DEFAULT false,
        "reconciledAt" timestamp,
        "reconciledBy" varchar,
        "matchedEntityType" varchar(32),
        "matchedEntityId" integer,
        "matches" jsonb,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "idx_bank_tx_account" ON "bank_transactions" ("bankAccountId");
      CREATE INDEX IF NOT EXISTS "idx_bank_tx_date" ON "bank_transactions" ("date");
      CREATE INDEX IF NOT EXISTS "idx_bank_tx_reconciled" ON "bank_transactions" ("reconciled");
      CREATE INDEX IF NOT EXISTS "idx_bank_tx_match" ON "bank_transactions" ("matchedEntityType","matchedEntityId");
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_bank_tx_account_external'
        ) THEN
          ALTER TABLE "bank_transactions"
            ADD CONSTRAINT "uq_bank_tx_account_external"
            UNIQUE ("bankAccountId","externalId");
        END IF;
      END $$;
    `,
  },
  {
    // Task #148 — Aba Financeiro do Batch v2.
    //  • Rename atômico do enum value 'partner_commission' → 'bv_campanha'
    //    (BV da Campanha é o termo canônico; "comissão parceiro" deprecado).
    //  • Override columns por batch em campaign_phases (todos nullable;
    //    null = herda da campanha).
    //  • partners.grossUpRate (nullable) e finance_settings KV global.
    //  • Atualiza coluna legada accounts_payable.type='comissao_parceiro'
    //    → 'bv_campanha' (varchar livre, batch update).
    name: "task_148_batch_financial_overrides_and_bv_rename",
    sql: `
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'accounts_payable_source_type'
            AND e.enumlabel = 'partner_commission'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'accounts_payable_source_type'
            AND e.enumlabel = 'bv_campanha'
        ) THEN
          ALTER TYPE accounts_payable_source_type RENAME VALUE 'partner_commission' TO 'bv_campanha';
        END IF;
      END $$;

      ALTER TABLE "campaign_phases"
        ADD COLUMN IF NOT EXISTS "unit_price_override" decimal(12,4),
        ADD COLUMN IF NOT EXISTS "markup_override" decimal(8,2),
        ADD COLUMN IF NOT EXISTS "tax_rate_override" decimal(5,2),
        ADD COLUMN IF NOT EXISTS "restaurant_commission_override" decimal(5,2),
        ADD COLUMN IF NOT EXISTS "vip_repasse_override" decimal(5,2),
        ADD COLUMN IF NOT EXISTS "bv_percent_override" decimal(5,2),
        ADD COLUMN IF NOT EXISTS "gross_up_rate_override" decimal(5,2),
        ADD COLUMN IF NOT EXISTS "batch_cost_override" decimal(14,2),
        ADD COLUMN IF NOT EXISTS "freight_cost_override" decimal(12,2),
        ADD COLUMN IF NOT EXISTS "override_notes" text,
        ADD COLUMN IF NOT EXISTS "override_updated_at" timestamp,
        ADD COLUMN IF NOT EXISTS "override_updated_by" varchar(255);

      ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "grossUpRate" decimal(5,2);

      CREATE TABLE IF NOT EXISTS "finance_settings" (
        "key" varchar(100) PRIMARY KEY,
        "value" text NOT NULL,
        "updatedAt" timestamp NOT NULL DEFAULT now()
      );
      INSERT INTO "finance_settings" ("key", "value")
        VALUES ('bv_gross_up_rate', '14.17')
        ON CONFLICT ("key") DO NOTHING;

      UPDATE "accounts_payable" SET "type" = 'bv_campanha' WHERE "type" = 'comissao_parceiro';

      COMMENT ON COLUMN "accounts_payable"."sourceType" IS 'Origem semântica: restaurant_commission | vip_repasse | supplier_cost | freight_cost | bv_campanha | seller_commission | tax | manual. Glossário §4.';
    `,
  },
  {
    // Task #165 — Backfill productLocations para produtos "rede" visíveis a
    // anunciantes. Sem essas linhas, o builder de campanha mostra "Nenhum
    // local encontrado" porque o join (productLocations × products × active
    // restaurants) zera. Para produtos com distributionType='rede' a regra
    // de negócio é "disponível em todos os locais ativos"; criamos uma linha
    // por par (produto rede visível, restaurante ativo) com defaults
    // (maxShares=1, cycleWeeks=4) — admin pode ajustar depois na aba "Locais".
    // Idempotente: ON CONFLICT DO NOTHING usa o índice uq_product_location.
    name: "task_165_backfill_product_locations_for_rede_products",
    sql: `
      INSERT INTO "product_locations" ("productId", "restaurantId", "maxShares", "cycleWeeks")
      SELECT p.id, r.id, 1, 4
      FROM "products" p
      CROSS JOIN "active_restaurants" r
      WHERE p."isActive" = true
        AND p."visibleToAdvertisers" = true
        AND p."distributionType" = 'rede'
        AND r.status = 'active'
      ON CONFLICT ON CONSTRAINT "uq_product_location" DO NOTHING;
    `,
  },
  {
    // Task #170 — ROLLBACK da vitrine pública /vitrine.
    // Reverte o seed do Manauara + colunas commercialLine/monthlyPrice
    // adicionados originalmente. Idempotente: usa DELETE por nome canônico
    // e DROP COLUMN IF EXISTS, então pode rodar em DBs já limpos sem erro.
    // Ordem: deleta produtos seedados → deleta o provider Manauara (que só
    // existe se foi seedado) → dropa o índice e as duas colunas adicionadas.
    // Em DBs novos onde a coluna nunca existiu, a cláusula WHERE com
    // information_schema evita erro ao referenciar coluna inexistente.
    name: "task_170_rollback_vitrine_catalog",
    sql: `
      DO $$
      BEGIN
        -- 1. Remover os 10 produtos seedados pelo nome canônico (idempotente).
        --    productLocations e demais FKs em cascata (ON DELETE CASCADE/SET NULL).
        DELETE FROM "products" WHERE "name" IN (
          'Manauara — Painel LED Praça Central',
          'Manauara — Totens Digitais 55"',
          'Manauara — Janelas Digitais Sala VIP',
          'Manauara — Elevadores Digitais',
          'Manauara — Adesivos de Chão',
          'Manauara — Backlights Praça de Alimentação',
          'Manauara — Bolachas Publicitárias Praça',
          'Manauara — Stand de Mídia Praça Central',
          'Manauara — Sampling com Promotor',
          'Manauara — Pop-up Store Sazonal'
        );

        -- 2. Remover o VIP Provider Manauara — só apaga se não tiver mais
        --    nenhum produto referenciando (segurança extra contra deletar
        --    em DBs onde admin já tinha cadastrado outros produtos depois).
        DELETE FROM "vip_providers"
        WHERE "name" = 'Manauara Shopping'
          AND NOT EXISTS (
            SELECT 1 FROM "products" p
            WHERE p."vipProviderId" = "vip_providers".id
          );
      END $$;

      -- 3. Dropar índice e colunas adicionadas. IF EXISTS torna idempotente
      --    em DBs novos onde a coluna nunca existiu.
      DROP INDEX IF EXISTS "idx_products_commercial_line";
      ALTER TABLE "products" DROP COLUMN IF EXISTS "commercialLine";
      ALTER TABLE "products" DROP COLUMN IF EXISTS "monthlyPrice";
    `,
  },
  {
    // Task #173 — Numeração atômica via tabela contadora.
    //
    // Substitui o padrão MAX("xNumber") + INSERT (que era racy e dependia de
    // retry on-23505 pra corretude sob concorrência) por
    // INSERT ... ON CONFLICT DO UPDATE ... RETURNING — atômico no row-lock
    // do Postgres. Cada (scope, year) tem uma linha única; concorrentes
    // pegam o lock em sequência e cada uma recebe um valor distinto.
    //
    // Backfill: semeamos last_value com o MAX atual extraído de campaigns,
    // quotations, invoices e service_orders (3 prefixos OS), pra que o
    // próximo número gerado continue a partir de onde a numeração estava.
    // ON CONFLICT DO NOTHING torna o backfill idempotente — se a tabela
    // já existir com dados (re-run), nada é sobrescrito.
    //
    // O wrapper withUniqueRetry continua nos call-sites como cinto-de-
    // segurança contra qualquer linha pré-existente que ainda colida, mas
    // o caminho feliz não depende mais dele.
    name: "task_173_number_counters_table_and_backfill",
    sql: `
      CREATE TABLE IF NOT EXISTS "number_counters" (
        "scope"      varchar(40) NOT NULL,
        "year"       integer     NOT NULL,
        "last_value" bigint      NOT NULL DEFAULT 0,
        "createdAt"  timestamp   NOT NULL DEFAULT now(),
        "updatedAt"  timestamp   NOT NULL DEFAULT now(),
        PRIMARY KEY ("scope", "year")
      );

      -- Backfill: campaigns (CMP-YYYY-NNNN). SUBSTRING extrai o YYYY do
      -- prefixo e MAX(NNNN) garante continuidade. Idempotente via ON CONFLICT.
      INSERT INTO "number_counters" ("scope", "year", "last_value")
      SELECT
        'campaign'::varchar AS scope,
        CAST(SUBSTRING("campaignNumber" FROM 5 FOR 4) AS integer) AS year,
        MAX(CAST(SUBSTRING("campaignNumber" FROM 10) AS integer)) AS last_value
      FROM "campaigns"
      WHERE "campaignNumber" ~ '^CMP-[0-9]{4}-[0-9]+$'
      GROUP BY CAST(SUBSTRING("campaignNumber" FROM 5 FOR 4) AS integer)
      ON CONFLICT ("scope", "year") DO NOTHING;

      -- Backfill: quotations (QOT-YYYY-NNNN).
      INSERT INTO "number_counters" ("scope", "year", "last_value")
      SELECT
        'quotation'::varchar AS scope,
        CAST(SUBSTRING("quotationNumber" FROM 5 FOR 4) AS integer) AS year,
        MAX(CAST(SUBSTRING("quotationNumber" FROM 10) AS integer)) AS last_value
      FROM "quotations"
      WHERE "quotationNumber" ~ '^QOT-[0-9]{4}-[0-9]+$'
      GROUP BY CAST(SUBSTRING("quotationNumber" FROM 5 FOR 4) AS integer)
      ON CONFLICT ("scope", "year") DO NOTHING;

      -- Backfill: invoices (FAT-YYYY-NNNN).
      INSERT INTO "number_counters" ("scope", "year", "last_value")
      SELECT
        'invoice'::varchar AS scope,
        CAST(SUBSTRING("invoiceNumber" FROM 5 FOR 4) AS integer) AS year,
        MAX(CAST(SUBSTRING("invoiceNumber" FROM 10) AS integer)) AS last_value
      FROM "invoices"
      WHERE "invoiceNumber" ~ '^FAT-[0-9]{4}-[0-9]+$'
      GROUP BY CAST(SUBSTRING("invoiceNumber" FROM 5 FOR 4) AS integer)
      ON CONFLICT ("scope", "year") DO NOTHING;

      -- Backfill: service_orders, três prefixos distintos por type.
      -- OS-ANT-YYYY-NNNN
      INSERT INTO "number_counters" ("scope", "year", "last_value")
      SELECT
        'os_anunciante'::varchar AS scope,
        CAST(SPLIT_PART("orderNumber", '-', 3) AS integer) AS year,
        MAX(CAST(SPLIT_PART("orderNumber", '-', 4) AS integer)) AS last_value
      FROM "service_orders"
      WHERE "orderNumber" ~ '^OS-ANT-[0-9]{4}-[0-9]+$'
      GROUP BY CAST(SPLIT_PART("orderNumber", '-', 3) AS integer)
      ON CONFLICT ("scope", "year") DO NOTHING;

      -- OS-PROD-YYYY-NNNN
      INSERT INTO "number_counters" ("scope", "year", "last_value")
      SELECT
        'os_producao'::varchar AS scope,
        CAST(SPLIT_PART("orderNumber", '-', 3) AS integer) AS year,
        MAX(CAST(SPLIT_PART("orderNumber", '-', 4) AS integer)) AS last_value
      FROM "service_orders"
      WHERE "orderNumber" ~ '^OS-PROD-[0-9]{4}-[0-9]+$'
      GROUP BY CAST(SPLIT_PART("orderNumber", '-', 3) AS integer)
      ON CONFLICT ("scope", "year") DO NOTHING;

      -- OS-DIST-YYYY-NNNN
      INSERT INTO "number_counters" ("scope", "year", "last_value")
      SELECT
        'os_distribuicao'::varchar AS scope,
        CAST(SPLIT_PART("orderNumber", '-', 3) AS integer) AS year,
        MAX(CAST(SPLIT_PART("orderNumber", '-', 4) AS integer)) AS last_value
      FROM "service_orders"
      WHERE "orderNumber" ~ '^OS-DIST-[0-9]{4}-[0-9]+$'
      GROUP BY CAST(SPLIT_PART("orderNumber", '-', 3) AS integer)
      ON CONFLICT ("scope", "year") DO NOTHING;
    `,
  },
  {
    // Task #202 — Sentinel do banco de teste e2e. A tabela existe em TODOS
    // os bancos (idempotente), mas a LINHA `(true)` só é inserida pelo
    // módulo `server/_dev/devEndpoints.ts` quando ele é carregado (i.e.
    // DEV_FIXTURES=1) E o host da DATABASE_URL atual não bate com nenhum
    // padrão de produção conhecido. Cada endpoint /api/dev-* faz SELECT
    // nessa linha antes de qualquer INSERT — se vier vazio (caso típico
    // do banco de produção, que ninguém marcou) o endpoint responde 503.
    // Última camada de defesa: mesmo que o bundle, NODE_ENV e DEV_FIXTURES
    // vazem todos juntos, sem o sentinel o INSERT não acontece.
    name: "create_e2e_test_db_sentinel_task_202",
    sql: `CREATE TABLE IF NOT EXISTS "e2e_test_db_sentinel" ("allowed" boolean PRIMARY KEY);`,
  },
  {
    // Task #202 — Segunda passada de limpeza retroativa. A migration
    // `inactivate_leaked_e2e_records_task_189` rodou uma vez e marcou os
    // registros existentes naquele momento como `inactive`. Depois disso,
    // até esta task fechar o vazamento por construção, mais alguns ciclos
    // de deploy injetaram novos parceiros/clientes/restaurantes "E2E ..."
    // em produção. Inativamos esses novos da mesma forma (sem DELETE,
    // p/ preservar trilha financeira de invoices reais já amarradas).
    // Idempotente: só toca quem ainda está 'active'.
    name: "inactivate_leaked_e2e_records_task_202",
    sql: `
      UPDATE "partners"
         SET "status" = 'inactive', "updatedAt" = NOW()
       WHERE "name" LIKE 'E2E Parceiro %'
         AND "status" = 'active';
      UPDATE "clients"
         SET "status" = 'inactive', "updatedAt" = NOW()
       WHERE ("name" LIKE 'E2E Client e2e-%' OR "name" LIKE 'E2E Client %')
         AND "status" = 'active';
      UPDATE "active_restaurants"
         SET "status" = 'inactive', "updatedAt" = NOW()
       WHERE "name" LIKE 'E2E Restaurante %'
         AND "status" = 'active';
    `,
  },
  {
    // Task #189 — Limpeza retroativa de registros E2E que vazaram para o
    // banco de produção via pre-deploy.sh (o script subia dev server com
    // DATABASE_URL=prod, então os endpoints /api/dev-ensure-parceiro e
    // /api/dev-seed-campaign-for-partner inseriam parceiros/clientes
    // "E2E Parceiro %"/"E2E Client e2e-%" direto na prod a cada deploy).
    // Inativamos (status='inactive') em vez de DELETE porque 4 desses
    // clientes têm invoices reais associadas — preservar trilha financeira
    // é mais importante que apagar a row. Os registros somem das listas
    // ativas. Idempotente: só toca quem ainda está active.
    name: "inactivate_leaked_e2e_records_task_189",
    sql: `
      UPDATE "partners"
         SET "status" = 'inactive', "updatedAt" = NOW()
       WHERE "name" LIKE 'E2E Parceiro %'
         AND "status" = 'active';
      UPDATE "clients"
         SET "status" = 'inactive', "updatedAt" = NOW()
       WHERE "name" LIKE 'E2E Client e2e-%'
         AND "status" = 'active';
      UPDATE "active_restaurants"
         SET "status" = 'inactive', "updatedAt" = NOW()
       WHERE "name" LIKE 'E2E Restaurante %'
         AND "status" = 'active';
    `,
  },
  {
    // Sprint 1 / Task #189 follow-up:
    // (a) adiciona coluna lossReasonNotes (texto livre auxiliar; o motivo
    //     em si vira enum aplicado no Zod/UI — schema continua flexível).
    // (b) backfilla createdBy nas cotações órfãs a partir do lead vinculado
    //     (leads.createdBy). Cotações sem leadId ficam com NULL — não há
    //     fonte confiável de autoria. Idempotente: só atualiza linhas
    //     onde createdBy ainda está NULL.
    name: "sprint1_loss_reason_notes_and_createdby_backfill",
    sql: `
      ALTER TABLE "quotations"
        ADD COLUMN IF NOT EXISTS "lossReasonNotes" text;

      UPDATE "quotations" q
         SET "createdBy" = l."createdBy",
             "updatedAt" = NOW()
        FROM "leads" l
       WHERE q."leadId" = l.id
         AND q."createdBy" IS NULL
         AND l."createdBy" IS NOT NULL;
    `,
  },
  {
    // Sprint 2 / Task #191:
    // Adiciona userId em crm_notifications para alertas direcionados (ex: aviso
    // 5d antes da auto-expiração da cotação vai pro createdBy). NULL = visível
    // a todos os admins (broadcast clássico). Index para filtrar rápido por
    // dono na listagem.
    name: "sprint2_crm_notifications_user_id",
    sql: `
      ALTER TABLE "crm_notifications"
        ADD COLUMN IF NOT EXISTS "userId" varchar(255) REFERENCES "users"(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS "idx_crm_notifications_user_id"
        ON "crm_notifications" ("userId");
    `,
  },
  {
    // Task #197 — Cronograma de pagamento configurável (cotação → campanha).
    // Substitui a regra fixa "1 parcela por fase, vencimento = início+15d".
    name: "task_197_billing_schedule_items",
    sql: `
      CREATE TABLE IF NOT EXISTS "billing_schedule_items" (
        "id" serial PRIMARY KEY,
        "ownerType" varchar(16) NOT NULL,
        "ownerId" integer NOT NULL,
        "sequence" integer NOT NULL,
        "amount" decimal(12,2) NOT NULL,
        "dueDate" date NOT NULL,
        "notes" text,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_billing_schedule_owner_seq'
        ) THEN
          ALTER TABLE "billing_schedule_items"
            ADD CONSTRAINT "uq_billing_schedule_owner_seq"
            UNIQUE ("ownerType", "ownerId", "sequence");
        END IF;
      END $$;
      CREATE INDEX IF NOT EXISTS "idx_billing_schedule_owner"
        ON "billing_schedule_items" ("ownerType", "ownerId");
    `,
  },
  {
    // Task #197 — backfill retroativo: cotações abertas (rascunho/enviada/ativa)
    // e campanhas ativas sem schedule recebem a sugestão default (1 parcela,
    // vencimento = periodStart+15d). Não toca em invoices já emitidas.
    name: "task_197_billing_schedule_backfill",
    sql: `
      INSERT INTO "billing_schedule_items" ("ownerType","ownerId","sequence","amount","dueDate","notes")
      SELECT 'quotation', q.id, 1,
             COALESCE(q."totalValue", 0)::numeric(12,2),
             COALESCE(q."periodStart", CURRENT_DATE) + INTERVAL '15 days',
             'Parcela única (backfill)'
        FROM "quotations" q
       WHERE q.status IN ('rascunho','enviada','ativa')
         AND COALESCE(q."isBonificada", false) = false
         AND COALESCE(q."totalValue", 0)::numeric > 0
         AND NOT EXISTS (
           SELECT 1 FROM "billing_schedule_items" b
            WHERE b."ownerType" = 'quotation' AND b."ownerId" = q.id
         );

      INSERT INTO "billing_schedule_items" ("ownerType","ownerId","sequence","amount","dueDate","notes")
      SELECT 'campaign', c.id, ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY p.sequence),
             COALESCE(
               (SELECT SUM(COALESCE(ci."totalPrice", (ci.quantity * COALESCE(ci."unitPrice",0))::numeric))::numeric(12,2)
                  FROM "campaign_items" ci WHERE ci."campaignPhaseId" = p.id),
               0
             )::numeric(12,2),
             p."periodStart" + INTERVAL '15 days',
             'Batch ' || p.sequence || ' (backfill)'
        FROM "campaigns" c
        JOIN "campaign_phases" p ON p."campaignId" = c.id
       WHERE c.status IN ('active','producao','distribuicao','veiculacao')
         AND COALESCE(c."isBonificada", false) = false
         AND NOT EXISTS (
           SELECT 1 FROM "billing_schedule_items" b
            WHERE b."ownerType" = 'campaign' AND b."ownerId" = c.id
         );
    `,
  },
  {
    // Reconcilia a tabela `products` com o schema atual em
    // `drizzle/schema.ts`. Em DBs que vieram do drizzle/0008 (que cria
    // products com colunas mínimas), o drizzle/0010 (que recria com
    // todas as colunas) foi pulado por "relation already exists", e
    // colunas como `defaultQtyPerLocation`, `unitLabel`, `irpj`,
    // `comRestaurante`, `loopDurationSeconds`, etc. nunca chegaram a
    // existir — quebrando qualquer INSERT vindo do drizzle ORM (que
    // sempre lista todas as colunas do schema). Tudo `IF NOT EXISTS`
    // pra ser no-op em DBs que já estão corretos.
    name: "task_213_reconcile_products_table_with_schema",
    sql: `
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "description" text;
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "unitLabel" varchar(50) DEFAULT 'unidade' NOT NULL;
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "unitLabelPlural" varchar(50) DEFAULT 'unidades' NOT NULL;
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "temDistribuicaoPorLocal" boolean DEFAULT true NOT NULL;
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "defaultQtyPerLocation" integer DEFAULT 500;
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "defaultSemanas" integer DEFAULT 12;
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "imagemUrl" text;
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "irpj" numeric(5, 2) DEFAULT '6.00';
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "comRestaurante" numeric(5, 2) DEFAULT '15.00';
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "comComercial" numeric(5, 2) DEFAULT '10.00';
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "attentionFactor" numeric(4, 2) DEFAULT '1.00' NOT NULL;
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "frequencyParam" numeric(8, 2) DEFAULT '1.00';
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "defaultPessoasPorMesa" numeric(4, 2) DEFAULT '3.00' NOT NULL;
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "loopDurationSeconds" integer DEFAULT 30 NOT NULL;
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "frequenciaAparicoes" numeric(4, 2) DEFAULT '1.00' NOT NULL;
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isActive" boolean DEFAULT true NOT NULL;
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "createdAt" timestamp DEFAULT now() NOT NULL;
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp DEFAULT now() NOT NULL;
    `,
  },
  {
    // Reconcilia `quotations` com o schema atual em `drizzle/schema.ts`.
    // A coluna `manualDiscountPercent` foi adicionada ao schema.ts mas nunca
    // ganhou um arquivo base do drizzle nem uma migration custom — então
    // qualquer banco construído só por `runMigrations()` (ex.: o banco de
    // teste E2E isolado) ficava sem ela. Como o drizzle ORM SEMPRE lista
    // todas as colunas do schema no INSERT, isso quebrava com 500 qualquer
    // insert em `quotations` vindo do ORM (ex.: o seed assinável dos testes).
    // `IF NOT EXISTS` torna isto um no-op em DBs que já têm a coluna.
    name: "task_221_reconcile_quotations_table_with_schema",
    sql: `
      ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "manualDiscountPercent" numeric(5, 2) DEFAULT '0';
    `,
  },
  {
    // Task #226 — fundação CRM: tabela `opportunities` (funil de negócios do
    // anunciante, vários por cliente). `stage` é varchar livre (sem enum).
    name: "task_226_create_opportunities_table",
    sql: `
      CREATE TABLE IF NOT EXISTS "opportunities" (
        "id" SERIAL PRIMARY KEY NOT NULL,
        "title" VARCHAR(255) NOT NULL,
        "clientId" INTEGER REFERENCES "clients"("id") ON DELETE SET NULL,
        "leadId" INTEGER REFERENCES "leads"("id") ON DELETE SET NULL,
        "stage" VARCHAR(50) NOT NULL DEFAULT 'qualificada',
        "estimatedValue" NUMERIC(12,2),
        "expectedCloseDate" DATE,
        "ownerId" VARCHAR(255),
        "opportunityType" VARCHAR(20),
        "revenueType" VARCHAR(20),
        "praca" VARCHAR(20),
        "lossReason" TEXT,
        "source" VARCHAR(50),
        "farmingStatus" VARCHAR(20),
        "farmingTags" TEXT,
        "partnerId" INTEGER REFERENCES "partners"("id") ON DELETE SET NULL,
        "createdBy" VARCHAR(255),
        "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "idx_opportunities_stage" ON "opportunities" ("stage");
      CREATE INDEX IF NOT EXISTS "idx_opportunities_client_id" ON "opportunities" ("clientId");
      CREATE INDEX IF NOT EXISTS "idx_opportunities_owner_id" ON "opportunities" ("ownerId");
    `,
  },
  {
    // Task #226 — liga a cotação à oportunidade de origem.
    name: "task_226_add_opportunity_id_to_quotations",
    sql: `ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "opportunityId" INTEGER REFERENCES "opportunities"("id") ON DELETE SET NULL;`,
  },
  {
    // Task #226 — campos BANT + agendamento + farming em `leads` (usados
    // pelas próximas tarefas da série; adicionados já na fundação).
    name: "task_226_add_bant_farming_fields_to_leads",
    sql: `
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "cargo" VARCHAR(120);
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "decisionRole" VARCHAR(30);
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "produtoInteresse" VARCHAR(120);
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "praca" VARCHAR(20);
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "budgetEstimado" NUMERIC(12,2);
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "timing" VARCHAR(60);
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "objecoes" TEXT;
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "meetingScheduledAt" TIMESTAMP;
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "meetingLink" VARCHAR(500);
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "disqualifyReason" VARCHAR(40);
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "farmingStatus" VARCHAR(20);
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "farmingTags" TEXT;
    `,
  },
  {
    // Task #228 — funil de Locais (restaurantes). Mapeia os estágios genéricos
    // legados dos leads type=restaurante para o novo conjunto de estágios de
    // ponto de venda, sem perder registros. Estágios já compartilhados
    // (negociacao/perdido) ficam intactos. Idempotente: após rodar, os estágios
    // de origem não existem mais para restaurantes.
    name: "task_228_map_restaurante_leads_to_venue_stages",
    sql: `
      UPDATE "leads" SET "stage" = 'novo_mapeado' WHERE "type" = 'restaurante' AND "stage" = 'novo';
      UPDATE "leads" SET "stage" = 'contato_inicial' WHERE "type" = 'restaurante' AND "stage" IN ('contato', 'qualificado');
      UPDATE "leads" SET "stage" = 'negociacao' WHERE "type" = 'restaurante' AND "stage" = 'proposta';
      UPDATE "leads" SET "stage" = 'ativo_rede' WHERE "type" = 'restaurante' AND "stage" = 'ganho';
    `,
  },
  {
    // Task #229 — Contatos unificados: backfill idempotente de `contacts` a
    // partir dos campos inline de contato em `leads`. Cria 1 contato (primário)
    // por lead que tenha qualquer dado de contato (contactName/Email/Phone/
    // WhatsApp). Dedupe pelo MESMO contato (e-mail/telefone, ou nome quando não
    // há nenhum dos dois) dentro do vínculo do lead — não por "qualquer contato
    // do lead" — para que um lead com outros contatos (ex.: via oportunidade)
    // ainda receba seu contato inline. Idempotente em re-execuções. Inativação
    // não se aplica — é só INSERT condicional.
    name: "task_229_backfill_lead_contacts",
    sql: `
      INSERT INTO contacts ("leadId", "name", "email", "phone", "role", "isPrimary", "createdAt", "updatedAt")
      SELECT l."id",
             COALESCE(NULLIF(TRIM(l."contactName"), ''), l."name", 'Sem nome'),
             NULLIF(TRIM(l."contactEmail"), ''),
             COALESCE(NULLIF(TRIM(l."contactPhone"), ''), NULLIF(TRIM(l."contactWhatsApp"), '')),
             NULLIF(TRIM(l."cargo"), ''),
             -- primário só quando o lead ainda não tem nenhum contato vinculado
             NOT EXISTS (SELECT 1 FROM contacts cp WHERE cp."leadId" = l."id"),
             NOW(), NOW()
      FROM leads l
      WHERE (
              NULLIF(TRIM(l."contactName"), '') IS NOT NULL
              OR NULLIF(TRIM(l."contactEmail"), '') IS NOT NULL
              OR NULLIF(TRIM(l."contactPhone"), '') IS NOT NULL
              OR NULLIF(TRIM(l."contactWhatsApp"), '') IS NOT NULL
            )
        -- dedupe pelo MESMO contato (e-mail/telefone) dentro do vínculo do lead,
        -- não por "qualquer contato do lead": um lead pode ter outros contatos
        -- (ex.: via oportunidade) e ainda assim faltar o seu contato inline.
        -- E-mail comparado em lower/trim; telefone normalizado para dígitos
        -- (últimos 10) para casar variações de formatação (+55, espaços, hífen)
        -- e evitar duplicatas. Sem e-mail nem telefone para casar, cai no nome
        -- como chave de idempotência. Idempotente em re-execuções.
        AND NOT EXISTS (
          SELECT 1 FROM contacts c
          WHERE c."leadId" = l."id"
            AND (
              (
                NULLIF(TRIM(LOWER(l."contactEmail")), '') IS NOT NULL
                AND LOWER(TRIM(c."email")) = NULLIF(TRIM(LOWER(l."contactEmail")), '')
              )
              OR (
                NULLIF(RIGHT(regexp_replace(COALESCE(NULLIF(TRIM(l."contactPhone"), ''), NULLIF(TRIM(l."contactWhatsApp"), ''), ''), '[^0-9]', '', 'g'), 10), '') IS NOT NULL
                AND RIGHT(regexp_replace(COALESCE(c."phone", ''), '[^0-9]', '', 'g'), 10)
                    = NULLIF(RIGHT(regexp_replace(COALESCE(NULLIF(TRIM(l."contactPhone"), ''), NULLIF(TRIM(l."contactWhatsApp"), ''), ''), '[^0-9]', '', 'g'), 10), '')
              )
              OR (
                NULLIF(TRIM(l."contactEmail"), '') IS NULL
                AND COALESCE(NULLIF(TRIM(l."contactPhone"), ''), NULLIF(TRIM(l."contactWhatsApp"), '')) IS NULL
                AND c."name" = COALESCE(NULLIF(TRIM(l."contactName"), ''), l."name", 'Sem nome')
              )
            )
        );
    `,
  },
  {
    // Task #240 — Reabrir oportunidades órfãs da migração CRM.
    // A série CRM (1–5) só remapeou leads de RESTAURANTE para o novo funil de
    // venue. Os leads de ANUNCIANTE ficaram nos estágios do funil genérico
    // legado (`contato`, `qualificado`, `proposta`, `negociacao`, `ganho`), que
    // não existem como coluna no funil SDR atual — então sumiram do quadro.
    // Este backfill cria, para cada um desses leads, UMA oportunidade no
    // primeiro estágio do funil de oportunidades (`qualificada`), preservando o
    // vínculo com o lead de origem (`leadId`) e, quando o lead já havia sido
    // convertido em cliente, também com esse cliente (`clientId`).
    //
    // - `title` vem do nome do lead.
    // - `clientId` resolve para o cliente convertido SOMENTE quando ele existe
    //   de fato na tabela `clients` (subquery retorna NULL caso contrário — ex.:
    //   lead "Solar Neo Energia", convertido sem cliente correspondente). Não
    //   consideramos `convertedToId` quando o lead aponta para uma oportunidade
    //   (`convertedToType = 'opportunity'`) para não confundir ids.
    // - `praca` é copiada do lead quando é um valor conhecido do funil.
    // - `source = 'crm_reopen_migracao'` marca este backfill e serve de chave de
    //   idempotência: re-execuções (boot/deploy repetidos) não criam duplicatas.
    //
    // NÃO alteramos o lead de origem (estágio, convertedToId/Type permanecem),
    // só criamos a oportunidade. O remapeamento do estágio do lead para o funil
    // SDR é problema separado (out of scope).
    name: "task_240_reopen_orphan_advertiser_opportunities",
    sql: `
      INSERT INTO opportunities ("title", "leadId", "clientId", "stage", "praca", "source", "createdAt", "updatedAt")
      SELECT
        l."name",
        l."id",
        (
          SELECT c."id" FROM clients c
          WHERE c."id" = COALESCE(
            l."client_id",
            CASE WHEN l."convertedToType" IS DISTINCT FROM 'opportunity' THEN l."convertedToId" END
          )
        ),
        'qualificada',
        CASE WHEN l."praca" IN ('manaus', 'rio', 'ambas') THEN l."praca" ELSE NULL END,
        'crm_reopen_migracao',
        NOW(), NOW()
      FROM leads l
      WHERE l."type" = 'anunciante'
        AND l."stage" IN ('contato', 'qualificado', 'proposta', 'negociacao', 'ganho')
        AND NOT EXISTS (
          SELECT 1 FROM opportunities o
          WHERE o."leadId" = l."id" AND o."source" = 'crm_reopen_migracao'
        );
    `,
  },
];

export async function runMigrations() {
  const db = await getDb();
  if (!db) {
    console.warn("[Migrations] Database not available, skipping migrations.");
    return;
  }

  // Tracking table — sem isso o boot reaplica TODAS as ~80 migrations a cada
  // start do container (mesmo as idempotentes pagam roundtrip + scan), o que
  // empurra o startup acima do health-check de 60s do autoscale e mata o
  // deploy antes do `server.listen()`. Com o tracking, só a PRIMEIRA boot
  // após adicionar uma nova migration paga o custo dela.
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS "_applied_migrations" (
      "name" varchar(255) PRIMARY KEY,
      "appliedAt" timestamp DEFAULT now() NOT NULL
    );
  `));

  // Advisory lock — evita que dois containers do autoscale subam simultânea-
  // mente e tentem aplicar a mesma migration em paralelo (race que o tracker
  // por si só não previne, já que ambos lêem snapshot vazio antes de inserir).
  // O lock é liberado automaticamente ao final da sessão (connection close).
  await db.execute(sql.raw(`SELECT pg_advisory_lock(72319811);`));

  // Fresh DB detection — sinal CONSERVADOR: zero tabelas de negócio chave.
  // Tanto `users` quanto `quotations` precisam estar ausentes. Prod tem
  // dezenas dessas tabelas; esse predicado nunca casa por engano em prod.
  // Quando casa (banco realmente vazio, ex: novo Neon de teste), aplicamos
  // o schema base do `drizzle/` ANTES das migrations custom — porque as
  // customs assumem que `users`, `quotations`, `campaigns`, `partners` etc
  // já existem (foram criadas historicamente via `drizzle-kit migrate`
  // antes do runner custom existir).
  const freshCheck = await db.execute(sql.raw(`
    SELECT
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users') AS has_users,
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='quotations') AS has_quotations;
  `));
  const freshRows: any[] = Array.isArray(freshCheck)
    ? (freshCheck as any[])
    : ((freshCheck as any)?.rows ?? []);
  const isFreshDb = !freshRows[0]?.has_users && !freshRows[0]?.has_quotations;

  let justBootstrappedFresh = false;
  if (isFreshDb) {
    await applyDrizzleBaseSchema(db);
    justBootstrappedFresh = true;
  }

  // Bootstrap retroativo — ambientes que já rodavam antes desse commit têm
  // todas as migrations efetivamente aplicadas (DDL idempotente acumulada ao
  // longo de meses), mas o tracker chega vazio. Sem esse bootstrap, o PRIMEIRO
  // boot após esse commit re-rodaria tudo de novo — exatamente o cenário que
  // estamos tentando evitar. Usamos a presença da tabela `quotations` (criada
  // pelas migrations mais antigas) como sinal "DB já existia antes do tracker".
  //
  // CRÍTICO: NÃO disparar esse bootstrap quando acabamos de aplicar o schema
  // base fresh acima. Nesse caso, `quotations` AGORA existe, mas as customs
  // PRECISAM rodar (adicionam colunas/índices posteriores ao 0000). Pulamos
  // via `justBootstrappedFresh`.
  const trackerEmpty = await db.execute(sql.raw(
    `SELECT COUNT(*)::int AS n FROM "_applied_migrations" WHERE "name" NOT LIKE 'drizzle:%';`,
  ));
  const trackerRows: any[] = Array.isArray(trackerEmpty)
    ? (trackerEmpty as any[])
    : ((trackerEmpty as any)?.rows ?? []);
  const trackerCount = Number(trackerRows[0]?.n ?? 0);

  if (trackerCount === 0 && !justBootstrappedFresh) {
    const legacyCheck = await db.execute(sql.raw(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'quotations'
      ) AS exists;
    `));
    const legacyRows: any[] = Array.isArray(legacyCheck)
      ? (legacyCheck as any[])
      : ((legacyCheck as any)?.rows ?? []);
    const isLegacyDb = legacyRows[0]?.exists === true;
    if (isLegacyDb) {
      console.log(
        `[Migrations] Bootstrap: DB pré-existente detectado, marcando ${MIGRATIONS.length} migrations como aplicadas sem re-executar.`,
      );
      // Single statement — VALUES (...),(...) — é uma roundtrip só.
      const values = MIGRATIONS
        .map(m => `('${m.name.replace(/'/g, "''")}')`)
        .join(",");
      await db.execute(sql.raw(
        `INSERT INTO "_applied_migrations" ("name") VALUES ${values} ON CONFLICT ("name") DO NOTHING;`,
      ));
    }
  }

  const appliedRows = await db.execute(sql.raw(
    `SELECT "name" FROM "_applied_migrations";`,
  ));
  // drizzle .execute() retorna { rows: [...] } no neon-serverless e [...]
  // direto em outros drivers; normalizamos.
  const rowsArr: any[] = Array.isArray(appliedRows)
    ? (appliedRows as any[])
    : ((appliedRows as any)?.rows ?? []);
  const applied = new Set<string>(rowsArr.map((r: any) => r.name));

  let appliedCount = 0;
  let skippedCount = 0;
  const t0 = Date.now();

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) {
      skippedCount++;
      continue;
    }
    try {
      const chunks = Array.isArray(migration.sql)
        ? migration.sql
        : [migration.sql];
      for (const chunk of chunks) {
        await db.execute(sql.raw(chunk));
      }
      await db.execute(sql.raw(
        `INSERT INTO "_applied_migrations" ("name") VALUES ('${migration.name.replace(/'/g, "''")}') ON CONFLICT ("name") DO NOTHING;`,
      ));
      appliedCount++;
      console.log(`[Migrations] Applied: ${migration.name}`);
    } catch (err: any) {
      const root = err?.cause ?? err;
      const detail = {
        code: root?.code,
        message: root?.message?.split("\n")[0],
        detail: root?.detail,
        hint: root?.hint,
        position: root?.position,
        where: root?.where,
        schema: root?.schema,
        table: root?.table,
        column: root?.column,
        constraint: root?.constraint,
        wrappedMessage: err?.message?.split("\n")[0],
      };
      console.warn(
        `[Migrations] ${migration.name} skipped or failed:`,
        JSON.stringify(detail, null, 2),
      );
    }
  }

  console.log(
    `[Migrations] done in ${Date.now() - t0}ms (applied=${appliedCount}, skipped=${skippedCount}, total=${MIGRATIONS.length})`,
  );
}
