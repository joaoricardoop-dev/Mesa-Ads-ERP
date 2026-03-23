ALTER TABLE "quotations" ADD COLUMN "isCustomProduct" boolean DEFAULT false NOT NULL;
ALTER TABLE "quotations" ADD COLUMN "customProductName" varchar(255);
ALTER TABLE "quotations" ADD COLUMN "customProjectCost" numeric(12, 2);
ALTER TABLE "quotations" ADD COLUMN "customPricingMode" varchar(20);
ALTER TABLE "quotations" ADD COLUMN "customMarginPercent" numeric(5, 2);
ALTER TABLE "quotations" ADD COLUMN "customFinalPrice" numeric(12, 2);
ALTER TABLE "quotations" ADD COLUMN "customRestaurantCommission" numeric(5, 2);
ALTER TABLE "quotations" ADD COLUMN "customPartnerCommission" numeric(5, 2);
ALTER TABLE "quotations" ADD COLUMN "customSellerCommission" numeric(5, 2);
