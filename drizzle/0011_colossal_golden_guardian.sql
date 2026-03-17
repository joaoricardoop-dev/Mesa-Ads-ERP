CREATE TYPE "public"."product_type" AS ENUM('coaster', 'display', 'cardapio', 'totem', 'adesivo', 'porta_guardanapo', 'outro');--> statement-breakpoint
CREATE TYPE "public"."production_status" AS ENUM('pending', 'producing', 'ready', 'shipped');--> statement-breakpoint
CREATE TABLE "campaign_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignId" integer NOT NULL,
	"productId" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"quantityPerLocation" integer,
	"usagePerDay" numeric(6, 2),
	"unitPrice" numeric(10, 4),
	"totalPrice" numeric(12, 2),
	"customPricingParams" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotation_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotationId" integer NOT NULL,
	"productId" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"quantityPerLocation" integer,
	"unitCost" numeric(10, 4),
	"unitPrice" numeric(10, 4),
	"totalPrice" numeric(12, 2),
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"serviceOrderId" integer NOT NULL,
	"productId" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"productionStatus" "production_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "coasterVolume" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tipo" "product_type" DEFAULT 'coaster';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "temDistribuicaoPorLocal" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "imagemUrl" text;--> statement-breakpoint
ALTER TABLE "campaign_products" ADD CONSTRAINT "campaign_products_campaignId_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_products" ADD CONSTRAINT "campaign_products_productId_products_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotationId_quotations_id_fk" FOREIGN KEY ("quotationId") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_productId_products_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_order_items" ADD CONSTRAINT "service_order_items_serviceOrderId_service_orders_id_fk" FOREIGN KEY ("serviceOrderId") REFERENCES "public"."service_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_order_items" ADD CONSTRAINT "service_order_items_productId_products_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_campaign_products_campaign_id" ON "campaign_products" USING btree ("campaignId");--> statement-breakpoint
CREATE INDEX "idx_campaign_products_product_id" ON "campaign_products" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "idx_quotation_items_quotation_id" ON "quotation_items" USING btree ("quotationId");--> statement-breakpoint
CREATE INDEX "idx_quotation_items_product_id" ON "quotation_items" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "idx_service_order_items_order_id" ON "service_order_items" USING btree ("serviceOrderId");--> statement-breakpoint
CREATE INDEX "idx_service_order_items_product_id" ON "service_order_items" USING btree ("productId");