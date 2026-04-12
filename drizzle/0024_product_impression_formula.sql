ALTER TABLE "products" ADD COLUMN "impressionFormulaType" varchar(50) DEFAULT 'por_coaster' NOT NULL;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "attentionFactor" numeric(4,2) DEFAULT '1.00' NOT NULL;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "defaultPessoasPorMesa" numeric(4,2) DEFAULT '3.00' NOT NULL;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "loopDurationSeconds" integer DEFAULT 30 NOT NULL;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "frequenciaAparicoes" numeric(4,2) DEFAULT '1.00' NOT NULL;
