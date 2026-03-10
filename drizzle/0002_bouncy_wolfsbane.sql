CREATE TABLE "term_acceptances" (
	"id" serial PRIMARY KEY NOT NULL,
	"restaurantId" integer NOT NULL,
	"termId" integer,
	"templateId" integer,
	"termContent" text NOT NULL,
	"termHash" varchar(64) NOT NULL,
	"acceptedAt" timestamp DEFAULT now() NOT NULL,
	"acceptedByName" varchar(255) NOT NULL,
	"acceptedByCpf" varchar(20) NOT NULL,
	"acceptedByEmail" varchar(320) NOT NULL,
	"ipAddress" varchar(45),
	"userAgent" text,
	"inviteToken" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "term_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"requiredFor" text DEFAULT '[]' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "clientId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'anunciante';--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "isBonificada" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "self_registered" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "opportunityType" varchar(20);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "revenueType" varchar(20);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "createdBy" varchar(255);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "client_id" integer;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "leadId" integer;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "isBonificada" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant_terms" ADD COLUMN "inviteToken" varchar(100);--> statement-breakpoint
ALTER TABLE "restaurant_terms" ADD COLUMN "inviteEmail" varchar(320);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "restaurant_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_complete" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "self_registered" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "term_acceptances" ADD CONSTRAINT "term_acceptances_restaurantId_active_restaurants_id_fk" FOREIGN KEY ("restaurantId") REFERENCES "public"."active_restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term_acceptances" ADD CONSTRAINT "term_acceptances_termId_restaurant_terms_id_fk" FOREIGN KEY ("termId") REFERENCES "public"."restaurant_terms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term_acceptances" ADD CONSTRAINT "term_acceptances_templateId_term_templates_id_fk" FOREIGN KEY ("templateId") REFERENCES "public"."term_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_term_acceptances_restaurant" ON "term_acceptances" USING btree ("restaurantId");--> statement-breakpoint
CREATE INDEX "idx_term_acceptances_term" ON "term_acceptances" USING btree ("termId");--> statement-breakpoint
CREATE INDEX "idx_term_acceptances_template" ON "term_acceptances" USING btree ("templateId");