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
