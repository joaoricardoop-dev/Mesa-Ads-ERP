CREATE TYPE "public"."budget_status" AS ENUM('active', 'expired', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'active', 'paused', 'completed', 'quotation', 'archived', 'producao', 'transito', 'executar', 'veiculacao', 'inativa');--> statement-breakpoint
CREATE TYPE "public"."contact_type" AS ENUM('proprietario', 'gerente', 'marketing', 'outro');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('emitida', 'paga', 'vencida', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."lead_type" AS ENUM('anunciante', 'restaurante');--> statement-breakpoint
CREATE TYPE "public"."quotation_status" AS ENUM('rascunho', 'enviada', 'ativa', 'os_gerada', 'win', 'perdida', 'expirada');--> statement-breakpoint
CREATE TYPE "public"."service_order_status" AS ENUM('rascunho', 'enviada', 'assinada', 'execucao', 'concluida');--> statement-breakpoint
CREATE TYPE "public"."service_order_type" AS ENUM('anunciante', 'producao');--> statement-breakpoint
CREATE TYPE "public"."social_class" AS ENUM('A', 'B', 'C', 'misto_ab', 'misto_bc', 'nao_sei', 'AA', 'D', 'E');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."term_status" AS ENUM('rascunho', 'enviado', 'assinado', 'vigente', 'encerrado');--> statement-breakpoint
CREATE TABLE "active_restaurants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text NOT NULL,
	"neighborhood" varchar(255) NOT NULL,
	"googleMapsLink" text,
	"instagram" varchar(255),
	"contactType" "contact_type" DEFAULT 'gerente' NOT NULL,
	"contactName" varchar(255) NOT NULL,
	"contactRole" varchar(255) NOT NULL,
	"whatsapp" varchar(50) NOT NULL,
	"email" varchar(320),
	"financialEmail" varchar(320),
	"socialClass" text DEFAULT '[]' NOT NULL,
	"tableCount" integer NOT NULL,
	"seatCount" integer NOT NULL,
	"monthlyCustomers" integer NOT NULL,
	"monthlyDrinksSold" integer,
	"busyDays" text,
	"busyHours" varchar(100),
	"excludedCategories" text,
	"excludedOther" text,
	"photoAuthorization" varchar(3) DEFAULT 'sim' NOT NULL,
	"photoUrls" text,
	"pixKey" varchar(255),
	"cnpj" varchar(20),
	"razaoSocial" varchar(255),
	"city" varchar(255),
	"state" varchar(2),
	"cep" varchar(10),
	"porte" varchar(100),
	"natureza_juridica" varchar(255),
	"atividade_principal" text,
	"atividades_secundarias" text,
	"capital_social" varchar(50),
	"data_abertura" varchar(20),
	"situacao_cadastral" varchar(50),
	"socios" text,
	"ticketMedio" numeric(10, 2) DEFAULT '0' NOT NULL,
	"avgStayMinutes" integer DEFAULT 0 NOT NULL,
	"locationRating" integer DEFAULT 1 NOT NULL,
	"venueType" integer DEFAULT 1 NOT NULL,
	"digitalPresence" integer DEFAULT 1 NOT NULL,
	"primaryDrink" varchar(50),
	"ratingScore" numeric(3, 2),
	"ratingTier" varchar(20),
	"ratingMultiplier" numeric(3, 2),
	"ratingUpdatedAt" timestamp,
	"parentRestaurantId" integer,
	"coastersAllocated" integer DEFAULT 500 NOT NULL,
	"commissionPercent" numeric(5, 2) DEFAULT '20.00' NOT NULL,
	"status" "status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"budgetId" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unitPrice" numeric(10, 4) NOT NULL,
	"totalPrice" numeric(12, 2) NOT NULL,
	"numModels" integer DEFAULT 1,
	"qtyPerModel" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplierId" integer NOT NULL,
	"code" varchar(50),
	"description" varchar(500) NOT NULL,
	"productSpec" text,
	"material" varchar(255),
	"format" varchar(100),
	"productSize" varchar(100),
	"printType" varchar(100),
	"colors" varchar(50),
	"layoutType" varchar(50),
	"paymentTerms" varchar(255),
	"productionLeadDays" varchar(100),
	"validUntil" date,
	"status" "budget_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_batch_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignId" integer NOT NULL,
	"batchId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_campaign_batch" UNIQUE("campaignId","batchId")
);
--> statement-breakpoint
CREATE TABLE "campaign_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"batchNumber" integer NOT NULL,
	"label" varchar(100) NOT NULL,
	"startDate" date NOT NULL,
	"endDate" date NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignId" integer NOT NULL,
	"action" varchar(50) NOT NULL,
	"details" text,
	"userId" varchar,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_proofs" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignId" integer NOT NULL,
	"restaurantId" integer NOT NULL,
	"week" integer NOT NULL,
	"photoUrl" text NOT NULL,
	"uploadedBy" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_restaurants" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignId" integer NOT NULL,
	"restaurantId" integer NOT NULL,
	"coastersCount" integer DEFAULT 500 NOT NULL,
	"usagePerDay" integer DEFAULT 5 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_campaign_restaurant" UNIQUE("campaignId","restaurantId")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignNumber" varchar(20),
	"clientId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"startDate" date NOT NULL,
	"endDate" date NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"quotationId" integer,
	"campaignType" varchar(50),
	"artPdfUrl" text,
	"artImageUrls" text,
	"materialReceivedDate" date,
	"veiculacaoStartDate" date,
	"veiculacaoEndDate" date,
	"coastersPerRestaurant" integer DEFAULT 500 NOT NULL,
	"usagePerDay" integer DEFAULT 3 NOT NULL,
	"daysPerMonth" integer DEFAULT 26 NOT NULL,
	"activeRestaurants" integer DEFAULT 10 NOT NULL,
	"pricingType" varchar(20) DEFAULT 'variable' NOT NULL,
	"markupPercent" numeric(10, 2) DEFAULT '30.00' NOT NULL,
	"fixedPrice" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"commissionType" varchar(20) DEFAULT 'variable' NOT NULL,
	"restaurantCommission" numeric(10, 2) DEFAULT '20.00' NOT NULL,
	"fixedCommission" numeric(10, 4) DEFAULT '0.0500' NOT NULL,
	"sellerCommission" numeric(10, 2) DEFAULT '10.00' NOT NULL,
	"taxRate" numeric(10, 2) DEFAULT '15.00' NOT NULL,
	"contractDuration" integer DEFAULT 6 NOT NULL,
	"batchSize" integer DEFAULT 10000 NOT NULL,
	"batchCost" numeric(10, 2) DEFAULT '1200.00' NOT NULL,
	"budgetId" integer,
	"productionCost" numeric(12, 2),
	"freightCost" numeric(12, 2),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_campaignNumber_unique" UNIQUE("campaignNumber")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"company" varchar(255),
	"razaoSocial" varchar(500),
	"cnpj" varchar(20),
	"instagram" varchar(255),
	"contactEmail" varchar(320),
	"contactPhone" varchar(50),
	"address" text,
	"addressNumber" varchar(20),
	"neighborhood" varchar(255),
	"city" varchar(255),
	"state" varchar(2),
	"cep" varchar(10),
	"segment" varchar(255),
	"status" "status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignId" integer NOT NULL,
	"clientId" integer NOT NULL,
	"invoiceNumber" varchar(20) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"issueDate" date NOT NULL,
	"dueDate" date NOT NULL,
	"paymentDate" date,
	"status" "invoice_status" DEFAULT 'emitida' NOT NULL,
	"paymentMethod" varchar(50),
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_interactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"leadId" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"content" text,
	"contactedBy" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "lead_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"company" varchar(255),
	"contactName" varchar(255),
	"contactPhone" varchar(50),
	"contactEmail" varchar(320),
	"contactWhatsApp" varchar(50),
	"origin" varchar(50),
	"stage" varchar(50) DEFAULT 'novo' NOT NULL,
	"assignedTo" varchar(255),
	"nextFollowUp" date,
	"tags" text,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignId" integer,
	"clientId" integer,
	"title" varchar(255),
	"thumbnailUrl" text,
	"artPdfUrl" text,
	"artImageUrls" text,
	"tags" text,
	"status" varchar(20) DEFAULT 'arquivado' NOT NULL,
	"archivedAt" timestamp,
	"metrics" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operational_costs" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignId" integer NOT NULL,
	"productionCost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"freightCost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotation_restaurants" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotationId" integer NOT NULL,
	"restaurantId" integer NOT NULL,
	"coasterQuantity" integer NOT NULL,
	"commissionPercent" numeric(5, 2) DEFAULT '20.00',
	CONSTRAINT "uq_quotation_restaurant" UNIQUE("quotationId","restaurantId")
);
--> statement-breakpoint
CREATE TABLE "quotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotationNumber" varchar(20) NOT NULL,
	"quotationName" varchar(255),
	"clientId" integer NOT NULL,
	"campaignType" varchar(50) DEFAULT 'padrao',
	"coasterVolume" integer NOT NULL,
	"networkProfile" varchar(50),
	"regions" text,
	"cycles" integer DEFAULT 1,
	"unitPrice" numeric(10, 4),
	"totalValue" numeric(12, 2),
	"includesProduction" boolean DEFAULT true,
	"notes" text,
	"validUntil" date,
	"status" "quotation_status" DEFAULT 'rascunho' NOT NULL,
	"lossReason" text,
	"createdBy" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quotations_quotationNumber_unique" UNIQUE("quotationNumber")
);
--> statement-breakpoint
CREATE TABLE "restaurant_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"restaurantId" integer NOT NULL,
	"campaignId" integer,
	"amount" numeric(12, 2) NOT NULL,
	"referenceMonth" varchar(7) NOT NULL,
	"paymentDate" date,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"pixKey" varchar(255),
	"notes" text,
	"periodStart" date,
	"periodEnd" date,
	"proofUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"restaurantId" integer NOT NULL,
	"url" text NOT NULL,
	"caption" varchar(255),
	"photoType" varchar(50) DEFAULT 'veiculacao' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_terms" (
	"id" serial PRIMARY KEY NOT NULL,
	"termNumber" varchar(20) NOT NULL,
	"restaurantId" integer NOT NULL,
	"conditions" text,
	"remunerationRule" text,
	"allowedCategories" text,
	"blockedCategories" text,
	"restaurantObligations" text,
	"mesaObligations" text,
	"validFrom" date,
	"validUntil" date,
	"status" "term_status" DEFAULT 'rascunho' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"razaoSocial" varchar(255),
	"cnpj" varchar(20),
	"address" text,
	"addressNumber" varchar(20),
	"complemento" varchar(255),
	"neighborhood" varchar(255),
	"city" varchar(255),
	"state" varchar(2),
	"cep" varchar(10),
	"email" varchar(255),
	"contactName" varchar(255),
	"contactPhone" varchar(50),
	"whatsapp" varchar(50),
	"instagram" varchar(100),
	"porte" varchar(100),
	"natureza_juridica" varchar(255),
	"atividade_principal" text,
	"atividades_secundarias" text,
	"capital_social" varchar(50),
	"data_abertura" varchar(20),
	"situacao_cadastral" varchar(50),
	"tipo_estabelecimento" varchar(20),
	"socios" text,
	"coastersAllocated" integer DEFAULT 500 NOT NULL,
	"commissionPercent" numeric(5, 2) DEFAULT '20.00' NOT NULL,
	"status" "status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderNumber" varchar(30) NOT NULL,
	"type" "service_order_type" NOT NULL,
	"campaignId" integer,
	"clientId" integer,
	"quotationId" integer,
	"description" text,
	"coasterVolume" integer,
	"networkAllocation" text,
	"periodStart" date,
	"periodEnd" date,
	"totalValue" numeric(12, 2),
	"paymentTerms" text,
	"status" "service_order_status" DEFAULT 'rascunho' NOT NULL,
	"specs" text,
	"supplierName" varchar(255),
	"estimatedDeadline" date,
	"artPdfUrl" text,
	"artImageUrls" text,
	"signatureUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_orders_orderNumber_unique" UNIQUE("orderNumber")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"cnpj" varchar(20),
	"contactName" varchar(255),
	"contactPhone" varchar(50),
	"contactEmail" varchar(320),
	"address" text,
	"city" varchar(255),
	"state" varchar(2),
	"status" "status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" varchar DEFAULT 'user',
	"is_active" boolean DEFAULT true,
	"password_hash" varchar,
	"must_change_password" boolean DEFAULT false,
	"client_id" integer,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "active_restaurants" ADD CONSTRAINT "active_restaurants_parentRestaurantId_active_restaurants_id_fk" FOREIGN KEY ("parentRestaurantId") REFERENCES "public"."active_restaurants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_budgetId_budgets_id_fk" FOREIGN KEY ("budgetId") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_supplierId_suppliers_id_fk" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_batch_assignments" ADD CONSTRAINT "campaign_batch_assignments_campaignId_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_batch_assignments" ADD CONSTRAINT "campaign_batch_assignments_batchId_campaign_batches_id_fk" FOREIGN KEY ("batchId") REFERENCES "public"."campaign_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_history" ADD CONSTRAINT "campaign_history_campaignId_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_proofs" ADD CONSTRAINT "campaign_proofs_campaignId_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_restaurants" ADD CONSTRAINT "campaign_restaurants_campaignId_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_restaurants" ADD CONSTRAINT "campaign_restaurants_restaurantId_restaurants_id_fk" FOREIGN KEY ("restaurantId") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_quotationId_quotations_id_fk" FOREIGN KEY ("quotationId") REFERENCES "public"."quotations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_budgetId_budgets_id_fk" FOREIGN KEY ("budgetId") REFERENCES "public"."budgets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_campaignId_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_interactions" ADD CONSTRAINT "lead_interactions_leadId_leads_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_campaignId_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_costs" ADD CONSTRAINT "operational_costs_campaignId_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_restaurants" ADD CONSTRAINT "quotation_restaurants_quotationId_quotations_id_fk" FOREIGN KEY ("quotationId") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_restaurants" ADD CONSTRAINT "quotation_restaurants_restaurantId_active_restaurants_id_fk" FOREIGN KEY ("restaurantId") REFERENCES "public"."active_restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_payments" ADD CONSTRAINT "restaurant_payments_restaurantId_active_restaurants_id_fk" FOREIGN KEY ("restaurantId") REFERENCES "public"."active_restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_payments" ADD CONSTRAINT "restaurant_payments_campaignId_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_photos" ADD CONSTRAINT "restaurant_photos_restaurantId_active_restaurants_id_fk" FOREIGN KEY ("restaurantId") REFERENCES "public"."active_restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_terms" ADD CONSTRAINT "restaurant_terms_restaurantId_active_restaurants_id_fk" FOREIGN KEY ("restaurantId") REFERENCES "public"."active_restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_campaignId_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_quotationId_quotations_id_fk" FOREIGN KEY ("quotationId") REFERENCES "public"."quotations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_active_restaurants_status" ON "active_restaurants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_active_restaurants_parent_id" ON "active_restaurants" USING btree ("parentRestaurantId");--> statement-breakpoint
CREATE INDEX "idx_active_restaurants_cnpj" ON "active_restaurants" USING btree ("cnpj");--> statement-breakpoint
CREATE INDEX "idx_active_restaurants_rating_tier" ON "active_restaurants" USING btree ("ratingTier");--> statement-breakpoint
CREATE INDEX "idx_budget_items_budget_id" ON "budget_items" USING btree ("budgetId");--> statement-breakpoint
CREATE INDEX "idx_budgets_supplier_id" ON "budgets" USING btree ("supplierId");--> statement-breakpoint
CREATE INDEX "idx_budgets_status" ON "budgets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_batch_assignments_campaign_id" ON "campaign_batch_assignments" USING btree ("campaignId");--> statement-breakpoint
CREATE INDEX "idx_batch_assignments_batch_id" ON "campaign_batch_assignments" USING btree ("batchId");--> statement-breakpoint
CREATE INDEX "idx_campaign_batches_year" ON "campaign_batches" USING btree ("year");--> statement-breakpoint
CREATE INDEX "idx_campaign_batches_is_active" ON "campaign_batches" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "idx_campaign_history_campaign_id" ON "campaign_history" USING btree ("campaignId");--> statement-breakpoint
CREATE INDEX "idx_campaign_proofs_campaign_id" ON "campaign_proofs" USING btree ("campaignId");--> statement-breakpoint
CREATE INDEX "idx_campaign_proofs_restaurant_id" ON "campaign_proofs" USING btree ("restaurantId");--> statement-breakpoint
CREATE INDEX "idx_campaign_restaurants_campaign_id" ON "campaign_restaurants" USING btree ("campaignId");--> statement-breakpoint
CREATE INDEX "idx_campaign_restaurants_restaurant_id" ON "campaign_restaurants" USING btree ("restaurantId");--> statement-breakpoint
CREATE INDEX "idx_campaigns_client_id" ON "campaigns" USING btree ("clientId");--> statement-breakpoint
CREATE INDEX "idx_campaigns_status" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_campaigns_quotation_id" ON "campaigns" USING btree ("quotationId");--> statement-breakpoint
CREATE INDEX "idx_campaigns_budget_id" ON "campaigns" USING btree ("budgetId");--> statement-breakpoint
CREATE INDEX "idx_campaigns_dates" ON "campaigns" USING btree ("startDate","endDate");--> statement-breakpoint
CREATE INDEX "idx_clients_status" ON "clients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_clients_cnpj" ON "clients" USING btree ("cnpj");--> statement-breakpoint
CREATE INDEX "idx_invoices_campaign_id" ON "invoices" USING btree ("campaignId");--> statement-breakpoint
CREATE INDEX "idx_invoices_client_id" ON "invoices" USING btree ("clientId");--> statement-breakpoint
CREATE INDEX "idx_invoices_status" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_invoices_due_date" ON "invoices" USING btree ("dueDate");--> statement-breakpoint
CREATE INDEX "idx_lead_interactions_lead_id" ON "lead_interactions" USING btree ("leadId");--> statement-breakpoint
CREATE INDEX "idx_leads_type" ON "leads" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_leads_stage" ON "leads" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "idx_library_items_campaign_id" ON "library_items" USING btree ("campaignId");--> statement-breakpoint
CREATE INDEX "idx_library_items_client_id" ON "library_items" USING btree ("clientId");--> statement-breakpoint
CREATE INDEX "idx_operational_costs_campaign_id" ON "operational_costs" USING btree ("campaignId");--> statement-breakpoint
CREATE INDEX "idx_quotation_restaurants_quotation_id" ON "quotation_restaurants" USING btree ("quotationId");--> statement-breakpoint
CREATE INDEX "idx_quotation_restaurants_restaurant_id" ON "quotation_restaurants" USING btree ("restaurantId");--> statement-breakpoint
CREATE INDEX "idx_quotations_client_id" ON "quotations" USING btree ("clientId");--> statement-breakpoint
CREATE INDEX "idx_quotations_status" ON "quotations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_restaurant_payments_restaurant_id" ON "restaurant_payments" USING btree ("restaurantId");--> statement-breakpoint
CREATE INDEX "idx_restaurant_payments_campaign_id" ON "restaurant_payments" USING btree ("campaignId");--> statement-breakpoint
CREATE INDEX "idx_restaurant_payments_status" ON "restaurant_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_restaurant_payments_ref_month" ON "restaurant_payments" USING btree ("referenceMonth");--> statement-breakpoint
CREATE INDEX "idx_restaurant_photos_restaurant_id" ON "restaurant_photos" USING btree ("restaurantId");--> statement-breakpoint
CREATE INDEX "idx_restaurant_terms_restaurant_id" ON "restaurant_terms" USING btree ("restaurantId");--> statement-breakpoint
CREATE INDEX "idx_restaurant_terms_status" ON "restaurant_terms" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_restaurants_status" ON "restaurants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_restaurants_cnpj" ON "restaurants" USING btree ("cnpj");--> statement-breakpoint
CREATE INDEX "idx_service_orders_campaign_id" ON "service_orders" USING btree ("campaignId");--> statement-breakpoint
CREATE INDEX "idx_service_orders_client_id" ON "service_orders" USING btree ("clientId");--> statement-breakpoint
CREATE INDEX "idx_service_orders_quotation_id" ON "service_orders" USING btree ("quotationId");--> statement-breakpoint
CREATE INDEX "idx_service_orders_status" ON "service_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_service_orders_type" ON "service_orders" USING btree ("type");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_suppliers_status" ON "suppliers" USING btree ("status");