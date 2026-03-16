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
  index,
  unique,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const statusEnum = pgEnum("status", ["active", "inactive"]);
export const campaignStatusEnum = pgEnum("campaign_status", ["draft", "active", "paused", "completed", "quotation", "archived", "producao", "transito", "executar", "veiculacao", "inativa"]);
export const budgetStatusEnum = pgEnum("budget_status", ["active", "expired", "rejected"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["emitida", "paga", "vencida", "cancelada"]);
export const quotationStatusEnum = pgEnum("quotation_status", ["rascunho", "enviada", "ativa", "os_gerada", "win", "perdida", "expirada"]);
export const leadTypeEnum = pgEnum("lead_type", ["anunciante", "restaurante"]);
export const serviceOrderTypeEnum = pgEnum("service_order_type", ["anunciante", "producao"]);
export const serviceOrderStatusEnum = pgEnum("service_order_status", ["rascunho", "enviada", "assinada", "execucao", "concluida"]);
export const termStatusEnum = pgEnum("term_status", ["rascunho", "enviado", "assinado", "vigente", "encerrado"]);

// ─── Auth ────────────────────────────────────────────────────────────────────

export { users, sessions } from "@shared/models/auth";
export type { User, UpsertUser } from "@shared/models/auth";

// ─── Restaurants (cadastro geral) ────────────────────────────────────────────

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
}, (t) => [
  index("idx_restaurants_status").on(t.status),
  index("idx_restaurants_cnpj").on(t.cnpj),
]);

export type Restaurant = typeof restaurants.$inferSelect;
export type InsertRestaurant = typeof restaurants.$inferInsert;

// ─── Clients (anunciantes) ───────────────────────────────────────────────────

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
  selfRegistered: boolean("self_registered").default(false),
  parentId: integer("parentId").references(() => clients.id, { onDelete: "set null" }),
  status: statusEnum("status").default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_clients_status").on(t.status),
  index("idx_clients_cnpj").on(t.cnpj),
  index("idx_clients_parent_id").on(t.parentId),
]);

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ─── Campaigns ───────────────────────────────────────────────────────────────

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  campaignNumber: varchar("campaignNumber", { length: 20 }).unique(),
  clientId: integer("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  startDate: date("startDate").notNull(),
  endDate: date("endDate").notNull(),
  status: campaignStatusEnum("status").default("draft").notNull(),
  notes: text("notes"),
  quotationId: integer("quotationId").references(() => quotations.id, { onDelete: "set null" }),
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
  budgetId: integer("budgetId").references(() => budgets.id, { onDelete: "set null" }),
  productionCost: decimal("productionCost", { precision: 12, scale: 2 }),
  freightCost: decimal("freightCost", { precision: 12, scale: 2 }),
  isBonificada: boolean("isBonificada").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_campaigns_client_id").on(t.clientId),
  index("idx_campaigns_status").on(t.status),
  index("idx_campaigns_quotation_id").on(t.quotationId),
  index("idx_campaigns_budget_id").on(t.budgetId),
  index("idx_campaigns_dates").on(t.startDate, t.endDate),
]);

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

// ─── Campaign ↔ Restaurant (junction) ────────────────────────────────────────

export const campaignRestaurants = pgTable("campaign_restaurants", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  restaurantId: integer("restaurantId").notNull().references(() => restaurants.id, { onDelete: "cascade" }),
  coastersCount: integer("coastersCount").default(500).notNull(),
  usagePerDay: integer("usagePerDay").default(5).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_campaign_restaurants_campaign_id").on(t.campaignId),
  index("idx_campaign_restaurants_restaurant_id").on(t.restaurantId),
  unique("uq_campaign_restaurant").on(t.campaignId, t.restaurantId),
]);

export type CampaignRestaurant = typeof campaignRestaurants.$inferSelect;
export type InsertCampaignRestaurant = typeof campaignRestaurants.$inferInsert;

// ─── Campaign History ────────────────────────────────────────────────────────

export const campaignHistory = pgTable("campaign_history", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 50 }).notNull(),
  details: text("details"),
  userId: varchar("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_campaign_history_campaign_id").on(t.campaignId),
]);

export type CampaignHistory = typeof campaignHistory.$inferSelect;
export type InsertCampaignHistory = typeof campaignHistory.$inferInsert;

// ─── Campaign Proofs ─────────────────────────────────────────────────────────

export const campaignProofs = pgTable("campaign_proofs", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  restaurantId: integer("restaurantId").notNull(),
  week: integer("week").notNull(),
  photoUrl: text("photoUrl").notNull(),
  uploadedBy: varchar("uploadedBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_campaign_proofs_campaign_id").on(t.campaignId),
  index("idx_campaign_proofs_restaurant_id").on(t.restaurantId),
]);

export type CampaignProof = typeof campaignProofs.$inferSelect;
export type InsertCampaignProof = typeof campaignProofs.$inferInsert;

// ─── Enums (restaurant-specific) ─────────────────────────────────────────────

export const contactTypeEnum = pgEnum("contact_type", ["proprietario", "gerente", "marketing", "outro"]);
export const socialClassEnum = pgEnum("social_class", ["A", "B", "C", "misto_ab", "misto_bc", "nao_sei", "AA", "D", "E"]);

// ─── Active Restaurants (rede ativa com rating) ──────────────────────────────

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
  parentRestaurantId: integer("parentRestaurantId").references((): any => activeRestaurants.id, { onDelete: "set null" }),
  coastersAllocated: integer("coastersAllocated").default(500).notNull(),
  commissionPercent: decimal("commissionPercent", { precision: 5, scale: 2 }).default("20.00").notNull(),
  status: statusEnum("status").default("active").notNull(),
  logoUrl: varchar("logoUrl", { length: 500 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_active_restaurants_status").on(t.status),
  index("idx_active_restaurants_parent_id").on(t.parentRestaurantId),
  index("idx_active_restaurants_cnpj").on(t.cnpj),
  index("idx_active_restaurants_rating_tier").on(t.ratingTier),
]);

export type ActiveRestaurant = typeof activeRestaurants.$inferSelect;
export type InsertActiveRestaurant = typeof activeRestaurants.$inferInsert;

// ─── Restaurant Photos ───────────────────────────────────────────────────────

export const restaurantPhotos = pgTable("restaurant_photos", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurantId").notNull().references(() => activeRestaurants.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  caption: varchar("caption", { length: 255 }),
  photoType: varchar("photoType", { length: 50 }).default("veiculacao").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_restaurant_photos_restaurant_id").on(t.restaurantId),
]);

export type RestaurantPhoto = typeof restaurantPhotos.$inferSelect;
export type InsertRestaurantPhoto = typeof restaurantPhotos.$inferInsert;

// ─── Restaurant Payments ─────────────────────────────────────────────────────

export const restaurantPayments = pgTable("restaurant_payments", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurantId").notNull().references(() => activeRestaurants.id, { onDelete: "cascade" }),
  campaignId: integer("campaignId").references(() => campaigns.id, { onDelete: "set null" }),
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
}, (t) => [
  index("idx_restaurant_payments_restaurant_id").on(t.restaurantId),
  index("idx_restaurant_payments_campaign_id").on(t.campaignId),
  index("idx_restaurant_payments_status").on(t.status),
  index("idx_restaurant_payments_ref_month").on(t.referenceMonth),
]);

export type RestaurantPayment = typeof restaurantPayments.$inferSelect;
export type InsertRestaurantPayment = typeof restaurantPayments.$inferInsert;

// ─── Invoices (faturamento) ──────────────────────────────────────────────────

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  clientId: integer("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
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
}, (t) => [
  index("idx_invoices_campaign_id").on(t.campaignId),
  index("idx_invoices_client_id").on(t.clientId),
  index("idx_invoices_status").on(t.status),
  index("idx_invoices_due_date").on(t.dueDate),
]);

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// ─── Operational Costs ───────────────────────────────────────────────────────

export const operationalCosts = pgTable("operational_costs", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  productionCost: decimal("productionCost", { precision: 12, scale: 2 }).default("0").notNull(),
  freightCost: decimal("freightCost", { precision: 12, scale: 2 }).default("0").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_operational_costs_campaign_id").on(t.campaignId),
]);

export type OperationalCost = typeof operationalCosts.$inferSelect;
export type InsertOperationalCost = typeof operationalCosts.$inferInsert;

// ─── Quotations (cotações) ───────────────────────────────────────────────────

export const quotations = pgTable("quotations", {
  id: serial("id").primaryKey(),
  quotationNumber: varchar("quotationNumber", { length: 20 }).notNull().unique(),
  quotationName: varchar("quotationName", { length: 255 }),
  clientId: integer("clientId").references(() => clients.id, { onDelete: "cascade" }),
  leadId: integer("leadId"),
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
  publicToken: varchar("publicToken", { length: 64 }).unique(),
  signedAt: timestamp("signedAt"),
  signedBy: varchar("signedBy", { length: 255 }),
  signatureData: text("signatureData"),
  isBonificada: boolean("isBonificada").default(false).notNull(),
  hasPartnerDiscount: boolean("hasPartnerDiscount").default(false).notNull(),
  createdBy: varchar("createdBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_quotations_client_id").on(t.clientId),
  index("idx_quotations_status").on(t.status),
]);

export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = typeof quotations.$inferInsert;

// ─── Leads ───────────────────────────────────────────────────────────────────

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  type: leadTypeEnum("type").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }),
  cnpj: varchar("cnpj", { length: 20 }),
  razaoSocial: varchar("razaoSocial", { length: 500 }),
  address: text("address"),
  addressNumber: varchar("addressNumber", { length: 20 }),
  neighborhood: varchar("neighborhood", { length: 255 }),
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 2 }),
  cep: varchar("cep", { length: 10 }),
  contactName: varchar("contactName", { length: 255 }),
  contactPhone: varchar("contactPhone", { length: 50 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactWhatsApp: varchar("contactWhatsApp", { length: 50 }),
  instagram: varchar("instagram", { length: 255 }),
  origin: varchar("origin", { length: 50 }),
  stage: varchar("stage", { length: 50 }).default("novo").notNull(),
  assignedTo: varchar("assignedTo", { length: 255 }),
  nextFollowUp: date("nextFollowUp"),
  tags: text("tags"),
  notes: text("notes"),
  opportunityType: varchar("opportunityType", { length: 20 }),
  revenueType: varchar("revenueType", { length: 20 }),
  createdBy: varchar("createdBy", { length: 255 }),
  clientId: integer("client_id"),
  convertedToId: integer("convertedToId"),
  convertedToType: varchar("convertedToType", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_leads_type").on(t.type),
  index("idx_leads_stage").on(t.stage),
]);

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

// ─── Lead Interactions ───────────────────────────────────────────────────────

export const leadInteractions = pgTable("lead_interactions", {
  id: serial("id").primaryKey(),
  leadId: integer("leadId").notNull().references(() => leads.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(),
  content: text("content"),
  contactedBy: varchar("contactedBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_lead_interactions_lead_id").on(t.leadId),
]);

export type LeadInteraction = typeof leadInteractions.$inferSelect;
export type InsertLeadInteraction = typeof leadInteractions.$inferInsert;

// ─── Service Orders (OS) ─────────────────────────────────────────────────────

export const serviceOrders = pgTable("service_orders", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("orderNumber", { length: 30 }).notNull().unique(),
  type: serviceOrderTypeEnum("type").notNull(),
  campaignId: integer("campaignId").references(() => campaigns.id, { onDelete: "set null" }),
  clientId: integer("clientId").references(() => clients.id, { onDelete: "set null" }),
  quotationId: integer("quotationId").references(() => quotations.id, { onDelete: "set null" }),
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
  signatureUrl: text("signatureUrl"),
  batchSelectionJson: text("batchSelectionJson"),
  signedByName: varchar("signedByName", { length: 255 }),
  signedByCpf: varchar("signedByCpf", { length: 20 }),
  signedAt: timestamp("signedAt"),
  signatureHash: varchar("signatureHash", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_service_orders_campaign_id").on(t.campaignId),
  index("idx_service_orders_client_id").on(t.clientId),
  index("idx_service_orders_quotation_id").on(t.quotationId),
  index("idx_service_orders_status").on(t.status),
  index("idx_service_orders_type").on(t.type),
]);

export type ServiceOrder = typeof serviceOrders.$inferSelect;
export type InsertServiceOrder = typeof serviceOrders.$inferInsert;

// ─── Quotation ↔ Restaurant (junction) ───────────────────────────────────────

export const quotationRestaurants = pgTable("quotation_restaurants", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotationId").notNull().references(() => quotations.id, { onDelete: "cascade" }),
  restaurantId: integer("restaurantId").notNull().references(() => activeRestaurants.id, { onDelete: "cascade" }),
  coasterQuantity: integer("coasterQuantity").notNull(),
  commissionPercent: decimal("commissionPercent", { precision: 5, scale: 2 }).default("20.00"),
}, (t) => [
  index("idx_quotation_restaurants_quotation_id").on(t.quotationId),
  index("idx_quotation_restaurants_restaurant_id").on(t.restaurantId),
  unique("uq_quotation_restaurant").on(t.quotationId, t.restaurantId),
]);

export type QuotationRestaurant = typeof quotationRestaurants.$inferSelect;
export type InsertQuotationRestaurant = typeof quotationRestaurants.$inferInsert;

// ─── Restaurant Terms (termos de adesão) ─────────────────────────────────────

export const restaurantTerms = pgTable("restaurant_terms", {
  id: serial("id").primaryKey(),
  termNumber: varchar("termNumber", { length: 20 }).notNull(),
  restaurantId: integer("restaurantId").notNull().references(() => activeRestaurants.id, { onDelete: "cascade" }),
  conditions: text("conditions"),
  remunerationRule: text("remunerationRule"),
  allowedCategories: text("allowedCategories"),
  blockedCategories: text("blockedCategories"),
  restaurantObligations: text("restaurantObligations"),
  mesaObligations: text("mesaObligations"),
  validFrom: date("validFrom"),
  validUntil: date("validUntil"),
  status: termStatusEnum("status").default("rascunho").notNull(),
  inviteToken: varchar("inviteToken", { length: 100 }),
  inviteEmail: varchar("inviteEmail", { length: 320 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_restaurant_terms_restaurant_id").on(t.restaurantId),
  index("idx_restaurant_terms_status").on(t.status),
]);

export type RestaurantTerm = typeof restaurantTerms.$inferSelect;
export type InsertRestaurantTerm = typeof restaurantTerms.$inferInsert;

// ─── Term Acceptances (assinatura eletrônica) ───────────────────────────────

export const termAcceptances = pgTable("term_acceptances", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurantId").notNull().references(() => activeRestaurants.id, { onDelete: "cascade" }),
  termId: integer("termId").references(() => restaurantTerms.id, { onDelete: "set null" }),
  templateId: integer("templateId").references(() => termTemplates.id, { onDelete: "set null" }),
  termContent: text("termContent").notNull(),
  termHash: varchar("termHash", { length: 64 }).notNull(),
  acceptedAt: timestamp("acceptedAt").defaultNow().notNull(),
  acceptedByName: varchar("acceptedByName", { length: 255 }).notNull(),
  acceptedByCpf: varchar("acceptedByCpf", { length: 20 }).notNull(),
  acceptedByEmail: varchar("acceptedByEmail", { length: 320 }).notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  inviteToken: varchar("inviteToken", { length: 100 }),
}, (t) => [
  index("idx_term_acceptances_restaurant").on(t.restaurantId),
  index("idx_term_acceptances_term").on(t.termId),
  index("idx_term_acceptances_template").on(t.templateId),
]);

export type TermAcceptance = typeof termAcceptances.$inferSelect;
export type InsertTermAcceptance = typeof termAcceptances.$inferInsert;

// ─── Term Templates (templates de termos) ────────────────────────────────────

export const termTemplates = pgTable("term_templates", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  requiredFor: text("requiredFor").notNull().default("[]"),
  isActive: boolean("isActive").default(true).notNull(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type TermTemplate = typeof termTemplates.$inferSelect;
export type InsertTermTemplate = typeof termTemplates.$inferInsert;

// ─── Library Items (acervo de artes) ─────────────────────────────────────────

export const libraryItems = pgTable("library_items", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId").references(() => campaigns.id, { onDelete: "set null" }),
  clientId: integer("clientId").references(() => clients.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }),
  thumbnailUrl: text("thumbnailUrl"),
  artPdfUrl: text("artPdfUrl"),
  artImageUrls: text("artImageUrls"),
  tags: text("tags"),
  status: varchar("status", { length: 20 }).default("arquivado").notNull(),
  archivedAt: timestamp("archivedAt"),
  metrics: text("metrics"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_library_items_campaign_id").on(t.campaignId),
  index("idx_library_items_client_id").on(t.clientId),
]);

export type LibraryItem = typeof libraryItems.$inferSelect;
export type InsertLibraryItem = typeof libraryItems.$inferInsert;

// ─── Suppliers (fornecedores) ────────────────────────────────────────────────

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
}, (t) => [
  index("idx_suppliers_status").on(t.status),
]);

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

// ─── Budgets (orçamentos de produção) ────────────────────────────────────────

export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplierId").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 50 }),
  description: varchar("description", { length: 500 }).notNull(),
  productSpec: text("productSpec"),
  material: varchar("material", { length: 255 }),
  format: varchar("format", { length: 100 }),
  productSize: varchar("productSize", { length: 100 }),
  printType: varchar("printType", { length: 100 }),
  colors: varchar("colors", { length: 50 }),
  layoutType: varchar("layoutType", { length: 50 }),
  paymentTerms: varchar("paymentTerms", { length: 255 }),
  productionLeadDays: varchar("productionLeadDays", { length: 100 }),
  validUntil: date("validUntil"),
  status: budgetStatusEnum("status").default("active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_budgets_supplier_id").on(t.supplierId),
  index("idx_budgets_status").on(t.status),
]);

export type Budget = typeof budgets.$inferSelect;
export type InsertBudget = typeof budgets.$inferInsert;

// ─── Budget Items (faixas de preço) ──────────────────────────────────────────

export const budgetItems = pgTable("budget_items", {
  id: serial("id").primaryKey(),
  budgetId: integer("budgetId").notNull().references(() => budgets.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 4 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 12, scale: 2 }).notNull(),
  numModels: integer("numModels").default(1),
  qtyPerModel: integer("qtyPerModel"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_budget_items_budget_id").on(t.budgetId),
]);

export type BudgetItem = typeof budgetItems.$inferSelect;
export type InsertBudgetItem = typeof budgetItems.$inferInsert;

// ─── Campaign Batches (lotes de produção) ────────────────────────────────────

export const campaignBatches = pgTable("campaign_batches", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  batchNumber: integer("batchNumber").notNull(),
  label: varchar("label", { length: 100 }).notNull(),
  startDate: date("startDate").notNull(),
  endDate: date("endDate").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_campaign_batches_year").on(t.year),
  index("idx_campaign_batches_is_active").on(t.isActive),
]);

export type CampaignBatch = typeof campaignBatches.$inferSelect;
export type InsertCampaignBatch = typeof campaignBatches.$inferInsert;

// ─── Campaign ↔ Batch (junction) ─────────────────────────────────────────────

export const campaignBatchAssignments = pgTable("campaign_batch_assignments", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  batchId: integer("batchId").notNull().references(() => campaignBatches.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_batch_assignments_campaign_id").on(t.campaignId),
  index("idx_batch_assignments_batch_id").on(t.batchId),
  unique("uq_campaign_batch").on(t.campaignId, t.batchId),
]);

export type CampaignBatchAssignment = typeof campaignBatchAssignments.$inferSelect;

// ─── Contacts (contatos CRM) ─────────────────────────────────────────────────

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").references(() => clients.id, { onDelete: "cascade" }),
  restaurantId: integer("restaurantId").references(() => activeRestaurants.id, { onDelete: "cascade" }),
  leadId: integer("leadId").references(() => leads.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  role: varchar("role", { length: 100 }),
  notes: text("notes"),
  isPrimary: boolean("isPrimary").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_contacts_client_id").on(t.clientId),
  index("idx_contacts_restaurant_id").on(t.restaurantId),
  index("idx_contacts_lead_id").on(t.leadId),
]);

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

// ─── Products (biblioteca de produtos) ────────────────────────────────────────

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  unitLabel: varchar("unitLabel", { length: 50 }).notNull().default("unidade"),
  unitLabelPlural: varchar("unitLabelPlural", { length: 50 }).notNull().default("unidades"),
  defaultQtyPerLocation: integer("defaultQtyPerLocation").default(500),
  irpj: decimal("irpj", { precision: 5, scale: 2 }).default("6.00"),
  comRestaurante: decimal("comRestaurante", { precision: 5, scale: 2 }).default("15.00"),
  comComercial: decimal("comComercial", { precision: 5, scale: 2 }).default("10.00"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

export const productPricingTiers = pgTable("product_pricing_tiers", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  volumeMin: integer("volumeMin").notNull(),
  volumeMax: integer("volumeMax"),
  custoUnitario: decimal("custoUnitario", { precision: 10, scale: 4 }).notNull(),
  frete: decimal("frete", { precision: 10, scale: 2 }).notNull(),
  margem: decimal("margem", { precision: 5, scale: 2 }).notNull().default("50.00"),
  artes: integer("artes").default(1),
}, (t) => [
  index("idx_product_pricing_tiers_product_id").on(t.productId),
]);

export type ProductPricingTier = typeof productPricingTiers.$inferSelect;
export type InsertProductPricingTier = typeof productPricingTiers.$inferInsert;

export * from "../shared/models/auth";
