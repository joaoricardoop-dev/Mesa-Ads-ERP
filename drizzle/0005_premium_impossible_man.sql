ALTER TABLE "contacts" ALTER COLUMN "clientId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "restaurantId" integer;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "leadId" integer;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_restaurantId_restaurants_id_fk" FOREIGN KEY ("restaurantId") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_leadId_leads_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_contacts_restaurant_id" ON "contacts" USING btree ("restaurantId");--> statement-breakpoint
CREATE INDEX "idx_contacts_lead_id" ON "contacts" USING btree ("leadId");