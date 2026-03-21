CREATE TABLE "crm_notifications" (
"id" serial PRIMARY KEY NOT NULL,
"eventType" varchar(50) NOT NULL,
"leadId" integer,
"partnerId" integer,
"message" text NOT NULL,
"readAt" timestamp,
"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm_notifications" ADD CONSTRAINT "crm_notifications_leadId_leads_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "crm_notifications" ADD CONSTRAINT "crm_notifications_partnerId_partners_id_fk" FOREIGN KEY ("partnerId") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_crm_notifications_lead_id" ON "crm_notifications" USING btree ("leadId");
--> statement-breakpoint
CREATE INDEX "idx_crm_notifications_read_at" ON "crm_notifications" USING btree ("readAt");
--> statement-breakpoint
CREATE INDEX "idx_crm_notifications_created_at" ON "crm_notifications" USING btree ("createdAt");
