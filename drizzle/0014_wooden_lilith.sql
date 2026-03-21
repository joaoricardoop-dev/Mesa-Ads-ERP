CREATE TABLE "user_restaurants" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"restaurant_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_user_restaurant" UNIQUE("user_id","restaurant_id")
);
--> statement-breakpoint
ALTER TABLE "user_restaurants" ADD CONSTRAINT "user_restaurants_restaurant_id_active_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."active_restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_restaurants_user_id" ON "user_restaurants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_restaurants_restaurant_id" ON "user_restaurants" USING btree ("restaurant_id");