import {
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  decimal,
  date,
} from "drizzle-orm/pg-core";

export const statusEnum = pgEnum("status", ["active", "inactive"]);
export const campaignStatusEnum = pgEnum("campaign_status", ["draft", "active", "paused", "completed", "quotation", "archived"]);
export const budgetStatusEnum = pgEnum("budget_status", ["active", "expired", "rejected"]);

export { users, sessions } from "@shared/models/auth";
export type { User, UpsertUser } from "@shared/models/auth";

export const restaurants = pgTable("restaurants", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  razaoSocial: varchar("razaoSocial", { length: 255 }),
  cnpj: varchar("cnpj", { length: 20 }),
  address: text("address"),
  addressNumber: varchar("addressNumber", { length: 20 }),
  complemento: varchar("complemento", { length: 255 }),
  neighborhood: varchar("neighborhood", { length: 255 }),
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 2 }),
  cep: varchar("cep", { length: 10 }),
  email: varchar("email", { length: 255 }),
  contactName: varchar("contactName", { length: 255 }),
  contactPhone: varchar("contactPhone", { length: 50 }),
  whatsapp: varchar("whatsapp", { length: 50 }),
  instagram: varchar("instagram", { length: 100 }),
  porte: varchar("porte", { length: 100 }),
  naturezaJuridica: varchar("natureza_juridica", { length: 255 }),
  atividadePrincipal: text("atividade_principal"),
  atividadesSecundarias: text("atividades_secundarias"),
  capitalSocial: varchar("capital_social", { length: 50 }),
  dataAbertura: varchar("data_abertura", { length: 20 }),
  situacaoCadastral: varchar("situacao_cadastral", { length: 50 }),
  tipoEstabelecimento: varchar("tipo_estabelecimento", { length: 20 }),
  socios: text("socios"),
  coastersAllocated: integer("coastersAllocated").default(500).notNull(),
  commissionPercent: decimal("commissionPercent", { precision: 5, scale: 2 }).default("20.00").notNull(),
  status: statusEnum("status").default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Restaurant = typeof restaurants.$inferSelect;
export type InsertRestaurant = typeof restaurants.$inferInsert;

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }),
  razaoSocial: varchar("razaoSocial", { length: 500 }),
  cnpj: varchar("cnpj", { length: 20 }),
  instagram: varchar("instagram", { length: 255 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 50 }),
  address: text("address"),
  addressNumber: varchar("addressNumber", { length: 20 }),
  neighborhood: varchar("neighborhood", { length: 255 }),
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 2 }),
  cep: varchar("cep", { length: 10 }),
  segment: varchar("segment", { length: 255 }),
  status: statusEnum("status").default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  startDate: date("startDate").notNull(),
  endDate: date("endDate").notNull(),
  status: campaignStatusEnum("status").default("draft").notNull(),
  notes: text("notes"),
  coastersPerRestaurant: integer("coastersPerRestaurant").default(500).notNull(),
  usagePerDay: integer("usagePerDay").default(3).notNull(),
  daysPerMonth: integer("daysPerMonth").default(26).notNull(),
  activeRestaurants: integer("activeRestaurants").default(10).notNull(),
  pricingType: varchar("pricingType", { length: 20 }).default("variable").notNull(),
  markupPercent: decimal("markupPercent", { precision: 10, scale: 2 }).default("30.00").notNull(),
  fixedPrice: decimal("fixedPrice", { precision: 10, scale: 2 }).default("0.00").notNull(),
  commissionType: varchar("commissionType", { length: 20 }).default("variable").notNull(),
  restaurantCommission: decimal("restaurantCommission", { precision: 10, scale: 2 }).default("20.00").notNull(),
  fixedCommission: decimal("fixedCommission", { precision: 10, scale: 4 }).default("0.0500").notNull(),
  sellerCommission: decimal("sellerCommission", { precision: 10, scale: 2 }).default("10.00").notNull(),
  taxRate: decimal("taxRate", { precision: 10, scale: 2 }).default("15.00").notNull(),
  contractDuration: integer("contractDuration").default(6).notNull(),
  batchSize: integer("batchSize").default(10000).notNull(),
  batchCost: decimal("batchCost", { precision: 10, scale: 2 }).default("1200.00").notNull(),
  budgetId: integer("budgetId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

export const campaignRestaurants = pgTable("campaign_restaurants", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId").notNull(),
  restaurantId: integer("restaurantId").notNull(),
  coastersCount: integer("coastersCount").default(500).notNull(),
  usagePerDay: integer("usagePerDay").default(5).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CampaignRestaurant = typeof campaignRestaurants.$inferSelect;
export type InsertCampaignRestaurant = typeof campaignRestaurants.$inferInsert;

export const campaignHistory = pgTable("campaign_history", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId").notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CampaignHistory = typeof campaignHistory.$inferSelect;
export type InsertCampaignHistory = typeof campaignHistory.$inferInsert;

export const contactTypeEnum = pgEnum("contact_type", ["proprietario", "gerente", "marketing", "outro"]);
export const socialClassEnum = pgEnum("social_class", ["A", "B", "C", "misto_ab", "misto_bc", "nao_sei", "AA", "D", "E"]);

export const activeRestaurants = pgTable("active_restaurants", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address").notNull(),
  neighborhood: varchar("neighborhood", { length: 255 }).notNull(),
  googleMapsLink: text("googleMapsLink"),
  instagram: varchar("instagram", { length: 255 }),
  contactType: contactTypeEnum("contactType").default("gerente").notNull(),
  contactName: varchar("contactName", { length: 255 }).notNull(),
  contactRole: varchar("contactRole", { length: 255 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 50 }).notNull(),
  email: varchar("email", { length: 320 }),
  financialEmail: varchar("financialEmail", { length: 320 }),
  socialClass: text("socialClass").default("[]").notNull(),
  tableCount: integer("tableCount").notNull(),
  seatCount: integer("seatCount").notNull(),
  monthlyCustomers: integer("monthlyCustomers").notNull(),
  monthlyDrinksSold: integer("monthlyDrinksSold"),
  busyDays: text("busyDays"),
  busyHours: varchar("busyHours", { length: 100 }),
  excludedCategories: text("excludedCategories"),
  excludedOther: text("excludedOther"),
  photoAuthorization: varchar("photoAuthorization", { length: 3 }).default("sim").notNull(),
  photoUrls: text("photoUrls"),
  pixKey: varchar("pixKey", { length: 255 }),
  cnpj: varchar("cnpj", { length: 20 }),
  razaoSocial: varchar("razaoSocial", { length: 255 }),
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 2 }),
  cep: varchar("cep", { length: 10 }),
  porte: varchar("porte", { length: 100 }),
  naturezaJuridica: varchar("natureza_juridica", { length: 255 }),
  atividadePrincipal: text("atividade_principal"),
  atividadesSecundarias: text("atividades_secundarias"),
  capitalSocial: varchar("capital_social", { length: 50 }),
  dataAbertura: varchar("data_abertura", { length: 20 }),
  situacaoCadastral: varchar("situacao_cadastral", { length: 50 }),
  socios: text("socios"),
  ticketMedio: decimal("ticketMedio", { precision: 10, scale: 2 }).default("0").notNull(),
  avgStayMinutes: integer("avgStayMinutes").default(0).notNull(),
  locationRating: integer("locationRating").default(1).notNull(),
  venueType: integer("venueType").default(1).notNull(),
  digitalPresence: integer("digitalPresence").default(1).notNull(),
  primaryDrink: varchar("primaryDrink", { length: 50 }),
  ratingScore: decimal("ratingScore", { precision: 3, scale: 2 }),
  ratingTier: varchar("ratingTier", { length: 20 }),
  ratingMultiplier: decimal("ratingMultiplier", { precision: 3, scale: 2 }),
  ratingUpdatedAt: timestamp("ratingUpdatedAt"),
  parentRestaurantId: integer("parentRestaurantId"),
  coastersAllocated: integer("coastersAllocated").default(500).notNull(),
  commissionPercent: decimal("commissionPercent", { precision: 5, scale: 2 }).default("20.00").notNull(),
  status: statusEnum("status").default("active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type ActiveRestaurant = typeof activeRestaurants.$inferSelect;
export type InsertActiveRestaurant = typeof activeRestaurants.$inferInsert;

export const restaurantPhotos = pgTable("restaurant_photos", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurantId").notNull(),
  url: text("url").notNull(),
  caption: varchar("caption", { length: 255 }),
  photoType: varchar("photoType", { length: 50 }).default("veiculacao").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RestaurantPhoto = typeof restaurantPhotos.$inferSelect;
export type InsertRestaurantPhoto = typeof restaurantPhotos.$inferInsert;

export const restaurantPayments = pgTable("restaurant_payments", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurantId").notNull(),
  campaignId: integer("campaignId"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  referenceMonth: varchar("referenceMonth", { length: 7 }).notNull(),
  paymentDate: date("paymentDate"),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  pixKey: varchar("pixKey", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RestaurantPayment = typeof restaurantPayments.$inferSelect;
export type InsertRestaurantPayment = typeof restaurantPayments.$inferInsert;

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  cnpj: varchar("cnpj", { length: 20 }),
  contactName: varchar("contactName", { length: 255 }),
  contactPhone: varchar("contactPhone", { length: 50 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  address: text("address"),
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 2 }),
  status: statusEnum("status").default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplierId").notNull(),
  code: varchar("code", { length: 50 }),
  description: varchar("description", { length: 500 }).notNull(),
  productSpec: text("productSpec"),
  validUntil: date("validUntil"),
  status: budgetStatusEnum("status").default("active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Budget = typeof budgets.$inferSelect;
export type InsertBudget = typeof budgets.$inferInsert;

export const budgetItems = pgTable("budget_items", {
  id: serial("id").primaryKey(),
  budgetId: integer("budgetId").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 3 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BudgetItem = typeof budgetItems.$inferSelect;
export type InsertBudgetItem = typeof budgetItems.$inferInsert;

export * from "../shared/models/auth";
