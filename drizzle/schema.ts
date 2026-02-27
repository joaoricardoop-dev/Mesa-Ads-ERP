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
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";

export const statusEnum = pgEnum("status", ["active", "inactive"]);
export const campaignStatusEnum = pgEnum("campaign_status", ["draft", "active", "paused", "completed", "quotation", "archived", "producao", "transito", "executar", "veiculacao", "inativa"]);
export const budgetStatusEnum = pgEnum("budget_status", ["active", "expired", "rejected"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["emitida", "paga", "vencida", "cancelada"]);
export const quotationStatusEnum = pgEnum("quotation_status", ["rascunho", "enviada", "ativa", "os_gerada", "win", "perdida", "expirada"]);
export const leadTypeEnum = pgEnum("lead_type", ["anunciante", "restaurante"]);
export const serviceOrderTypeEnum = pgEnum("service_order_type", ["anunciante", "producao"]);
export const serviceOrderStatusEnum = pgEnum("service_order_status", ["rascunho", "enviada", "assinada", "execucao", "concluida"]);
export const termStatusEnum = pgEnum("term_status", ["rascunho", "enviado", "assinado", "vigente", "encerrado"]);

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
  campaignNumber: varchar("campaignNumber", { length: 20 }),
  clientId: integer("clientId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  startDate: date("startDate").notNull(),
  endDate: date("endDate").notNull(),
  status: campaignStatusEnum("status").default("draft").notNull(),
  notes: text("notes"),
  quotationId: integer("quotationId"),
  campaignType: varchar("campaignType", { length: 50 }),
  artPdfUrl: text("artPdfUrl"),
  artImageUrls: text("artImageUrls"),
  materialReceivedDate: date("materialReceivedDate"),
  veiculacaoStartDate: date("veiculacaoStartDate"),
  veiculacaoEndDate: date("veiculacaoEndDate"),
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
  productionCost: decimal("productionCost", { precision: 12, scale: 2 }),
  freightCost: decimal("freightCost", { precision: 12, scale: 2 }),
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
  userId: varchar("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CampaignHistory = typeof campaignHistory.$inferSelect;
export type InsertCampaignHistory = typeof campaignHistory.$inferInsert;

export const campaignProofs = pgTable("campaign_proofs", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId").notNull(),
  restaurantId: integer("restaurantId").notNull(),
  week: integer("week").notNull(),
  photoUrl: text("photoUrl").notNull(),
  uploadedBy: varchar("uploadedBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CampaignProof = typeof campaignProofs.$inferSelect;
export type InsertCampaignProof = typeof campaignProofs.$inferInsert;

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
  periodStart: date("periodStart"),
  periodEnd: date("periodEnd"),
  proofUrl: text("proofUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RestaurantPayment = typeof restaurantPayments.$inferSelect;
export type InsertRestaurantPayment = typeof restaurantPayments.$inferInsert;

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId").notNull(),
  clientId: integer("clientId").notNull(),
  invoiceNumber: varchar("invoiceNumber", { length: 20 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  issueDate: date("issueDate").notNull(),
  dueDate: date("dueDate").notNull(),
  paymentDate: date("paymentDate"),
  status: invoiceStatusEnum("status").default("emitida").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

export const operationalCosts = pgTable("operational_costs", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId").notNull(),
  productionCost: decimal("productionCost", { precision: 12, scale: 2 }).default("0").notNull(),
  freightCost: decimal("freightCost", { precision: 12, scale: 2 }).default("0").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type OperationalCost = typeof operationalCosts.$inferSelect;
export type InsertOperationalCost = typeof operationalCosts.$inferInsert;

export const quotations = pgTable("quotations", {
  id: serial("id").primaryKey(),
  quotationNumber: varchar("quotationNumber", { length: 20 }).notNull(),
  clientId: integer("clientId").notNull(),
  campaignType: varchar("campaignType", { length: 50 }).default("padrao"),
  coasterVolume: integer("coasterVolume").notNull(),
  networkProfile: varchar("networkProfile", { length: 50 }),
  regions: text("regions"),
  cycles: integer("cycles").default(1),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 4 }),
  totalValue: decimal("totalValue", { precision: 12, scale: 2 }),
  includesProduction: boolean("includesProduction").default(true),
  notes: text("notes"),
  validUntil: date("validUntil"),
  status: quotationStatusEnum("status").default("rascunho").notNull(),
  lossReason: text("lossReason"),
  createdBy: varchar("createdBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = typeof quotations.$inferInsert;

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  type: leadTypeEnum("type").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }),
  contactName: varchar("contactName", { length: 255 }),
  contactPhone: varchar("contactPhone", { length: 50 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactWhatsApp: varchar("contactWhatsApp", { length: 50 }),
  origin: varchar("origin", { length: 50 }),
  stage: varchar("stage", { length: 50 }).default("novo").notNull(),
  assignedTo: varchar("assignedTo", { length: 255 }),
  nextFollowUp: date("nextFollowUp"),
  tags: text("tags"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

export const leadInteractions = pgTable("lead_interactions", {
  id: serial("id").primaryKey(),
  leadId: integer("leadId").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  content: text("content"),
  contactedBy: varchar("contactedBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LeadInteraction = typeof leadInteractions.$inferSelect;
export type InsertLeadInteraction = typeof leadInteractions.$inferInsert;

export const serviceOrders = pgTable("service_orders", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("orderNumber", { length: 30 }).notNull(),
  type: serviceOrderTypeEnum("type").notNull(),
  campaignId: integer("campaignId"),
  clientId: integer("clientId"),
  quotationId: integer("quotationId"),
  description: text("description"),
  coasterVolume: integer("coasterVolume"),
  networkAllocation: text("networkAllocation"),
  periodStart: date("periodStart"),
  periodEnd: date("periodEnd"),
  totalValue: decimal("totalValue", { precision: 12, scale: 2 }),
  paymentTerms: text("paymentTerms"),
  status: serviceOrderStatusEnum("status").default("rascunho").notNull(),
  specs: text("specs"),
  supplierName: varchar("supplierName", { length: 255 }),
  estimatedDeadline: date("estimatedDeadline"),
  artPdfUrl: text("artPdfUrl"),
  artImageUrls: text("artImageUrls"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type ServiceOrder = typeof serviceOrders.$inferSelect;
export type InsertServiceOrder = typeof serviceOrders.$inferInsert;

export const restaurantTerms = pgTable("restaurant_terms", {
  id: serial("id").primaryKey(),
  termNumber: varchar("termNumber", { length: 20 }).notNull(),
  restaurantId: integer("restaurantId").notNull(),
  conditions: text("conditions"),
  remunerationRule: text("remunerationRule"),
  allowedCategories: text("allowedCategories"),
  blockedCategories: text("blockedCategories"),
  restaurantObligations: text("restaurantObligations"),
  mesaObligations: text("mesaObligations"),
  validFrom: date("validFrom"),
  validUntil: date("validUntil"),
  status: termStatusEnum("status").default("rascunho").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type RestaurantTerm = typeof restaurantTerms.$inferSelect;
export type InsertRestaurantTerm = typeof restaurantTerms.$inferInsert;

export const libraryItems = pgTable("library_items", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId"),
  clientId: integer("clientId"),
  title: varchar("title", { length: 255 }),
  thumbnailUrl: text("thumbnailUrl"),
  artPdfUrl: text("artPdfUrl"),
  artImageUrls: text("artImageUrls"),
  tags: text("tags"),
  status: varchar("status", { length: 20 }).default("arquivado").notNull(),
  archivedAt: timestamp("archivedAt"),
  metrics: text("metrics"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LibraryItem = typeof libraryItems.$inferSelect;
export type InsertLibraryItem = typeof libraryItems.$inferInsert;

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
