CREATE TABLE "product_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(30) DEFAULT 'gray',
	"description" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "categoryId" integer;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_product_categories_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."product_categories"("id") ON DELETE set null ON UPDATE no action;