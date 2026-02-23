ALTER TABLE "clients" ADD COLUMN "razaoSocial" varchar(500);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "cnpj" varchar(20);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "instagram" varchar(255);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "addressNumber" varchar(20);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "neighborhood" varchar(255);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "city" varchar(255);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "state" varchar(2);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "cep" varchar(10);--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "razaoSocial" varchar(255);--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "cnpj" varchar(20);--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "addressNumber" varchar(20);--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "state" varchar(2);--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "cep" varchar(10);--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "whatsapp" varchar(50);--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "instagram" varchar(100);