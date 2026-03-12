CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(320),
	"phone" varchar(50),
	"role" varchar(100),
	"notes" text,
	"isPrimary" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "parentId" integer;--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "batchSelectionJson" text;--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "signedByName" varchar(255);--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "signedByCpf" varchar(20);--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "signedAt" timestamp;--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "signatureHash" varchar(128);--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_contacts_client_id" ON "contacts" USING btree ("clientId");--> statement-breakpoint
CREATE INDEX "idx_clients_parent_id" ON "clients" USING btree ("parentId");