ALTER TABLE "crm_notifications" ADD COLUMN "campaignId" integer;
--> statement-breakpoint
ALTER TABLE "crm_notifications" ADD COLUMN "clientId" integer;
--> statement-breakpoint
ALTER TABLE "crm_notifications" ADD CONSTRAINT "crm_notifications_campaignId_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "crm_notifications" ADD CONSTRAINT "crm_notifications_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_crm_notifications_campaign_id" ON "crm_notifications" USING btree ("campaignId");
--> statement-breakpoint
CREATE INDEX "idx_crm_notifications_client_id" ON "crm_notifications" USING btree ("clientId");
