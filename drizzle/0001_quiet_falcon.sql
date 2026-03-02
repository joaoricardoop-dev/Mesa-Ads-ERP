ALTER TABLE "quotations" ADD COLUMN "publicToken" varchar(64);--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "signedAt" timestamp;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "signedBy" varchar(255);--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "signatureData" text;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_publicToken_unique" UNIQUE("publicToken");