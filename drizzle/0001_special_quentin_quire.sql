ALTER TABLE "leads" ADD COLUMN "cnpj" varchar(20);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "razaoSocial" varchar(500);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "addressNumber" varchar(20);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "neighborhood" varchar(255);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "city" varchar(255);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "state" varchar(2);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "cep" varchar(10);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "instagram" varchar(255);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "convertedToId" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "convertedToType" varchar(50);