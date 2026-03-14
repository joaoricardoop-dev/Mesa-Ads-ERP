ALTER TABLE "active_restaurants" ADD COLUMN "logoUrl" varchar(500);--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "hasPartnerDiscount" boolean DEFAULT false NOT NULL;