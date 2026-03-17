CREATE TYPE "public"."partner_type" AS ENUM('agencia', 'indicador', 'consultor');--> statement-breakpoint
CREATE TABLE "partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"company" varchar(255),
	"cnpj" varchar(20),
	"contactName" varchar(255),
	"contactPhone" varchar(50),
	"contactEmail" varchar(320),
	"type" "partner_type" DEFAULT 'indicador' NOT NULL,
	"commissionPercent" numeric(5, 2) DEFAULT '10.00' NOT NULL,
	"status" "status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_pricing_tiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"productId" integer NOT NULL,
	"volumeMin" integer NOT NULL,
	"volumeMax" integer,
	"custoUnitario" numeric(10, 4) NOT NULL,
	"frete" numeric(10, 2) NOT NULL,
	"margem" numeric(5, 2) DEFAULT '50.00' NOT NULL,
	"artes" integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"unitLabel" varchar(50) DEFAULT 'unidade' NOT NULL,
	"unitLabelPlural" varchar(50) DEFAULT 'unidades' NOT NULL,
	"defaultQtyPerLocation" integer DEFAULT 500,
	"irpj" numeric(5, 2) DEFAULT '6.00',
	"comRestaurante" numeric(5, 2) DEFAULT '15.00',
	"comComercial" numeric(5, 2) DEFAULT '10.00',
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "productId" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "partnerId" integer;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "productId" integer;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "partnerId" integer;--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "productId" integer;--> statement-breakpoint
ALTER TABLE "product_pricing_tiers" ADD CONSTRAINT "product_pricing_tiers_productId_products_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_partners_status" ON "partners" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_partners_type" ON "partners" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_partners_cnpj" ON "partners" USING btree ("cnpj");--> statement-breakpoint
CREATE INDEX "idx_product_pricing_tiers_product_id" ON "product_pricing_tiers" USING btree ("productId");--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_productId_products_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_partnerId_partners_id_fk" FOREIGN KEY ("partnerId") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_productId_products_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_partnerId_partners_id_fk" FOREIGN KEY ("partnerId") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_productId_products_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_leads_partner_id" ON "leads" USING btree ("partnerId");--> statement-breakpoint
CREATE INDEX "idx_quotations_partner_id" ON "quotations" USING btree ("partnerId");