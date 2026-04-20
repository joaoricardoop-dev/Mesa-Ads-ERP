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
export const campaignStatusEnum = pgEnum("campaign_status", ["draft", "active", "paused", "completed", "quotation", "archived", "producao", "transito", "executar", "veiculacao", "inativa", "briefing", "design", "aprovacao", "distribuicao"]);
export const budgetStatusEnum = pgEnum("budget_status", ["active", "expired", "rejected"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["emitida", "paga", "vencida", "cancelada"]);
export const billingModeEnum = pgEnum("billing_mode", ["bruto", "liquido"]);
export const quotationStatusEnum = pgEnum("quotation_status", ["rascunho", "enviada", "ativa", "os_gerada", "win", "perdida", "expirada"]);
export const leadTypeEnum = pgEnum("lead_type", ["anunciante", "restaurante"]);
export const serviceOrderTypeEnum = pgEnum("service_order_type", ["anunciante", "producao", "distribuicao"]);
export const serviceOrderStatusEnum = pgEnum("service_order_status", ["rascunho", "enviada", "assinada", "execucao", "concluida"]);
export const termStatusEnum = pgEnum("term_status", ["rascunho", "enviado", "assinado", "vigente", "encerrado"]);
export const productTypeEnum = pgEnum("product_type", ["coaster", "display", "cardapio", "totem", "adesivo", "porta_guardanapo", "outro", "impressos", "eletronicos", "telas", "janelas_digitais"]);
export const productionStatusEnum = pgEnum("production_status", ["pending", "producing", "ready", "shipped"]);
export const pricingModeEnum = pgEnum("pricing_mode", ["cost_based", "price_based"]);
export const entryTypeEnum = pgEnum("entry_type", ["tiers", "fixed_quantities"]);
export const impressionFormulaTypeEnum = pgEnum("impression_formula_type", ["por_coaster", "por_tela", "por_visitante", "por_evento", "manual"]);
export const distributionTypeEnum = pgEnum("distribution_type", ["rede", "local_especifico"]);
export const workflowTemplateEnum = pgEnum("workflow_template", ["fisico", "eletronico_cliente_envia", "ativacao_evento"]);

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
  utmSource: varchar("utm_source", { length: 255 }),
  utmMedium: varchar("utm_medium", { length: 255 }),
  utmCampaign: varchar("utm_campaign", { length: 255 }),
  utmContent: varchar("utm_content", { length: 255 }),
  utmTerm: varchar("utm_term", { length: 255 }),
  referrer: varchar("referrer", { length: 500 }),
  landingPath: varchar("landing_path", { length: 255 }),
  parentId: integer("parentId").references((): any => clients.id, { onDelete: "set null" }),
  partnerId: integer("partnerId").references(() => partners.id, { onDelete: "set null" }),
  showAgencyPricing: boolean("show_agency_pricing"),
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
  productId: integer("productId").references(() => products.id, { onDelete: "set null" }),
  proposalSignedAt: timestamp("proposalSignedAt"),
  briefingEnteredAt: timestamp("briefingEnteredAt"),
  designEnteredAt: timestamp("designEnteredAt"),
  aprovacaoEnteredAt: timestamp("aprovacaoEnteredAt"),
  producaoEnteredAt: timestamp("producaoEnteredAt"),
  distribuicaoEnteredAt: timestamp("distribuicaoEnteredAt"),
  partnerId: integer("partnerId").references(() => partners.id, { onDelete: "set null" }),
  hasAgencyBv: boolean("hasAgencyBv").default(true).notNull(),
  agencyBvPercent: decimal("agencyBvPercent", { precision: 5, scale: 2 }).default("20.00").notNull(),
  assignedTo: varchar("assignedTo", { length: 255 }),
  assignedToName: varchar("assignedToName", { length: 255 }),
  assignedToAvatar: varchar("assignedToAvatar", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_campaigns_client_id").on(t.clientId),
  index("idx_campaigns_status").on(t.status),
  index("idx_campaigns_quotation_id").on(t.quotationId),
  index("idx_campaigns_budget_id").on(t.budgetId),
  index("idx_campaigns_dates").on(t.startDate, t.endDate),
  index("idx_campaigns_partner_id").on(t.partnerId),
]);

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

// ─── Campaign Phases (fases/períodos de uma campanha) ────────────────────────
// Ex: campanha Unipar de 3 meses → 3 fases (Jan, Fev, Mar).
// Cada fase tem seu período de veiculação, status e itens (produtos).

export const campaignPhaseStatusEnum = pgEnum("campaign_phase_status", [
  "planejada",
  "ativa",
  "concluida",
  "cancelada",
]);

export const campaignPhases = pgTable("campaign_phases", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(), // ordem 1,2,3...
  label: varchar("label", { length: 100 }).notNull(), // "Mês 1", "Ciclo Jan/25"
  periodStart: date("periodStart").notNull(),
  periodEnd: date("periodEnd").notNull(),
  status: campaignPhaseStatusEnum("status").default("planejada").notNull(),
  notes: text("notes"),
  // Timeline própria por batch (mesmas etapas do pipeline da campanha)
  briefingEnteredAt: timestamp("briefingEnteredAt"),
  designEnteredAt: timestamp("designEnteredAt"),
  aprovacaoEnteredAt: timestamp("aprovacaoEnteredAt"),
  producaoEnteredAt: timestamp("producaoEnteredAt"),
  distribuicaoEnteredAt: timestamp("distribuicaoEnteredAt"),
  veiculacaoEnteredAt: timestamp("veiculacaoEnteredAt"),
  concluidaAt: timestamp("concluidaAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_campaign_phases_campaign_id").on(t.campaignId),
  index("idx_campaign_phases_status").on(t.status),
  index("idx_campaign_phases_period").on(t.periodStart, t.periodEnd),
  unique("uq_campaign_phase_sequence").on(t.campaignId, t.sequence),
]);

export type CampaignPhase = typeof campaignPhases.$inferSelect;
export type InsertCampaignPhase = typeof campaignPhases.$inferInsert;

// ─── Campaign Items (itens/produtos dentro de uma fase) ──────────────────────
// Ex: fase 1 tem [3000 coasters @ R$ 0,80, 10 telas @ R$ 500/mês].
// É onde vivem quantidade, preço unitário, custos de produção e frete
// específicos por produto/fase.

export const campaignItems = pgTable("campaign_items", {
  id: serial("id").primaryKey(),
  campaignPhaseId: integer("campaignPhaseId").notNull().references(() => campaignPhases.id, { onDelete: "cascade" }),
  productId: integer("productId").notNull().references(() => products.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unitPrice", { precision: 12, scale: 4 }).notNull().default("0.0000"),
  // Preço total (quantity × unitPrice), armazenado pra facilitar relatórios.
  // Nullable: se for null, calcular em runtime. Útil pra produtos com preço
  // não-linear (ex: mensalidade fixa independente de qty).
  totalPrice: decimal("totalPrice", { precision: 14, scale: 2 }),
  // Custos previstos (serão sincronizados com accounts_payable)
  productionCost: decimal("productionCost", { precision: 12, scale: 2 }).default("0.00").notNull(),
  freightCost: decimal("freightCost", { precision: 12, scale: 2 }).default("0.00").notNull(),
  // Marketplace v2: vincula o item a um local específico (active_restaurants)
  // e ao "share slot" reservado naquele local. Nullable para itens legados
  // (rede inteira) e itens de produtos não-locais.
  restaurantId: integer("restaurantId").references(() => activeRestaurants.id, { onDelete: "set null" }),
  shareIndex: integer("shareIndex"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_campaign_items_phase_id").on(t.campaignPhaseId),
  index("idx_campaign_items_product_id").on(t.productId),
  index("idx_campaign_items_restaurant_id").on(t.restaurantId),
]);

export type CampaignItem = typeof campaignItems.$inferSelect;
export type InsertCampaignItem = typeof campaignItems.$inferInsert;

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
  userName: varchar("userName", { length: 255 }),
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
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lng: decimal("lng", { precision: 10, scale: 7 }),
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
  // Fase específica que esta fatura cobre. Nullable por compat com invoices
  // antigas e pra permitir faturas "soltas" (não-faseadas) no futuro.
  campaignPhaseId: integer("campaignPhaseId").references(() => campaignPhases.id, { onDelete: "set null" }),
  clientId: integer("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
  invoiceNumber: varchar("invoiceNumber", { length: 20 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  billingType: billingModeEnum("billingType").default("bruto").notNull(),
  withheldTax: decimal("withheldTax", { precision: 12, scale: 2 }),
  // ISS (Imposto Sobre Serviços) — alíquota % e flag se é retido pelo tomador.
  // Se issRetained=true: valor é descontado do que recebemos (nossa parte cai).
  // Se issRetained=false: empresa recolhe depois; não afeta o líquido recebido.
  issRate: decimal("issRate", { precision: 5, scale: 2 }).default("0.00"),
  issRetained: boolean("issRetained").default(false).notNull(),
  issueDate: date("issueDate").notNull(),
  dueDate: date("dueDate").notNull(),
  paymentDate: date("paymentDate"),
  // Finrefac #4 — quando o dinheiro entrou efetivamente (conciliação bancária).
  // paymentDate = registro contábil; receivedDate = caixa real.
  receivedDate: date("receivedDate"),
  status: invoiceStatusEnum("status").default("emitida").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  notes: text("notes"),
  // Marketplace v2: link público para o documento financeiro (NF/recibo)
  // exibido no Portal do Anunciante, com label opcional p/ rotular o arquivo.
  documentUrl: text("documentUrl"),
  documentLabel: varchar("documentLabel", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_invoices_campaign_id").on(t.campaignId),
  index("idx_invoices_client_id").on(t.clientId),
  index("idx_invoices_status").on(t.status),
  index("idx_invoices_due_date").on(t.dueDate),
  index("idx_invoices_campaign_phase_id").on(t.campaignPhaseId),
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
  coasterVolume: integer("coasterVolume"),
  manualDiscountPercent: decimal("manualDiscountPercent", { precision: 5, scale: 2 }).default("0"),
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
  productId: integer("productId").references(() => products.id),
  partnerId: integer("partnerId").references(() => partners.id, { onDelete: "set null" }),
  periodStart: date("periodStart"),
  batchWeeks: integer("batchWeeks").default(4),
  createdBy: varchar("createdBy", { length: 255 }),
  isCustomProduct: boolean("isCustomProduct").default(false).notNull(),
  customProductName: varchar("customProductName", { length: 255 }),
  customProjectCost: decimal("customProjectCost", { precision: 12, scale: 2 }),
  customPricingMode: varchar("customPricingMode", { length: 20 }),
  customMarginPercent: decimal("customMarginPercent", { precision: 5, scale: 2 }),
  customFinalPrice: decimal("customFinalPrice", { precision: 12, scale: 2 }),
  customRestaurantCommission: decimal("customRestaurantCommission", { precision: 5, scale: 2 }),
  customPartnerCommission: decimal("customPartnerCommission", { precision: 5, scale: 2 }),
  customSellerCommission: decimal("customSellerCommission", { precision: 5, scale: 2 }),
  agencyCommissionPercent: decimal("agencyCommissionPercent", { precision: 5, scale: 2 }),
  source: varchar("source", { length: 50 }).default("internal"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_quotations_client_id").on(t.clientId),
  index("idx_quotations_status").on(t.status),
  index("idx_quotations_partner_id").on(t.partnerId),
]);

export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = typeof quotations.$inferInsert;

// ─── Partners (parceiros comerciais/agências) ────────────────────────────────

export const partnerTypeEnum = pgEnum("partner_type", ["agencia", "indicador", "consultor"]);

export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }),
  cnpj: varchar("cnpj", { length: 20 }),
  contactName: varchar("contactName", { length: 255 }),
  contactPhone: varchar("contactPhone", { length: 50 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  type: partnerTypeEnum("type").default("indicador").notNull(),
  commissionPercent: decimal("commissionPercent", { precision: 5, scale: 2 }).default("10.00").notNull(),
  billingMode: billingModeEnum("billingMode").default("bruto").notNull(),
  status: statusEnum("status").default("active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_partners_status").on(t.status),
  index("idx_partners_type").on(t.type),
  index("idx_partners_cnpj").on(t.cnpj),
]);

export type Partner = typeof partners.$inferSelect;
export type InsertPartner = typeof partners.$inferInsert;

// ─── VIP Providers (provedores de sala VIP — recebem repasse de telas/janelas) ─

export const vipProviders = pgTable("vip_providers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }),
  cnpj: varchar("cnpj", { length: 20 }),
  contactName: varchar("contactName", { length: 255 }),
  contactPhone: varchar("contactPhone", { length: 50 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  location: varchar("location", { length: 255 }),
  // Renomeado em finrefac fase 1: era `commissionPercent`. Termo de negócio
  // correto é "Repasse Sala VIP" (cf. docs/financeiro-glossario.md §2).
  repassePercent: decimal("repassePercent", { precision: 5, scale: 2 }).default("10.00").notNull(),
  billingMode: billingModeEnum("billingMode").default("bruto").notNull(),
  status: statusEnum("status").default("active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_vip_providers_status").on(t.status),
  index("idx_vip_providers_cnpj").on(t.cnpj),
]);

export type VipProvider = typeof vipProviders.$inferSelect;
export type InsertVipProvider = typeof vipProviders.$inferInsert;

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
  partnerId: integer("partnerId").references(() => partners.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_leads_type").on(t.type),
  index("idx_leads_stage").on(t.stage),
  index("idx_leads_partner_id").on(t.partnerId),
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
  // Batch específico que esta OS atende. Nullable pra OS antigas/agrupadas.
  campaignPhaseId: integer("campaignPhaseId").references(() => campaignPhases.id, { onDelete: "set null" }),
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
  productId: integer("productId").references(() => products.id, { onDelete: "set null" }),
  trackingCode: varchar("trackingCode", { length: 100 }),
  freightProvider: varchar("freightProvider", { length: 150 }),
  freightExpectedDate: date("freightExpectedDate"),
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

// ─── Service Order Trackings (multiple tracking codes per OS) ─────────────────

export const serviceOrderTrackings = pgTable("service_order_trackings", {
  id: serial("id").primaryKey(),
  serviceOrderId: integer("serviceOrderId").notNull().references(() => serviceOrders.id, { onDelete: "cascade" }),
  trackingCode: varchar("trackingCode", { length: 100 }).notNull(),
  freightProvider: varchar("freightProvider", { length: 150 }),
  expectedDate: date("expectedDate"),
  label: varchar("label", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_so_trackings_so_id").on(t.serviceOrderId),
]);

export type ServiceOrderTracking = typeof serviceOrderTrackings.$inferSelect;
export type InsertServiceOrderTracking = typeof serviceOrderTrackings.$inferInsert;

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
  tipo: productTypeEnum("tipo").default("impressos"),
  unitLabel: varchar("unitLabel", { length: 50 }).notNull().default("unidade"),
  unitLabelPlural: varchar("unitLabelPlural", { length: 50 }).notNull().default("unidades"),
  temDistribuicaoPorLocal: boolean("temDistribuicaoPorLocal").default(true).notNull(),
  defaultQtyPerLocation: integer("defaultQtyPerLocation").default(500),
  defaultSemanas: integer("defaultSemanas").default(12),
  imagemUrl: text("imagemUrl"),
  irpj: decimal("irpj", { precision: 5, scale: 2 }).default("6.00"),
  comRestaurante: decimal("comRestaurante", { precision: 5, scale: 2 }).default("15.00"),
  comComercial: decimal("comComercial", { precision: 5, scale: 2 }).default("10.00"),
  pricingMode: pricingModeEnum("pricingMode").default("cost_based").notNull(),
  entryType: entryTypeEnum("entryType").default("tiers").notNull(),
  visibleToPartners: boolean("visibleToPartners").default(false).notNull(),
  visibleToAdvertisers: boolean("visibleToAdvertisers").default(false).notNull(),
  workflowTemplate: workflowTemplateEnum("workflowTemplate"),
  isActive: boolean("isActive").default(true).notNull(),
  impressionFormulaType: varchar("impressionFormulaType", { length: 50 }).default("por_coaster").notNull(),
  attentionFactor: decimal("attentionFactor", { precision: 4, scale: 2 }).default("1.00").notNull(),
  frequencyParam: decimal("frequencyParam", { precision: 8, scale: 2 }).default("1.00"),
  distributionType: distributionTypeEnum("distributionType").default("rede"),
  defaultPessoasPorMesa: decimal("defaultPessoasPorMesa", { precision: 4, scale: 2 }).default("3.00").notNull(),
  loopDurationSeconds: integer("loopDurationSeconds").default(30).notNull(),
  frequenciaAparicoes: decimal("frequenciaAparicoes", { precision: 4, scale: 2 }).default("1.00").notNull(),
  vipProviderId: integer("vipProviderId").references(() => vipProviders.id, { onDelete: "set null" }),
  vipProviderCommissionPercent: decimal("vipProviderCommissionPercent", { precision: 5, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ─── Product ↔ Location (junction for local_especifico products) ──────────────

export const productLocations = pgTable("product_locations", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  restaurantId: integer("restaurantId").notNull().references(() => activeRestaurants.id, { onDelete: "cascade" }),
  maxShares: integer("maxShares").default(1).notNull(),
  cycleWeeks: integer("cycleWeeks").default(4).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_product_locations_product_id").on(t.productId),
  index("idx_product_locations_restaurant_id").on(t.restaurantId),
  unique("uq_product_location").on(t.productId, t.restaurantId),
]);

export type ProductLocation = typeof productLocations.$inferSelect;
export type InsertProductLocation = typeof productLocations.$inferInsert;

// ─── Seasonal Multipliers (Marketplace v2) ───────────────────────────────────
// Multiplicador sazonal de preço aplicado a um produto e (opcionalmente) a um
// local específico, durante uma janela de datas. Ex: "Carnaval 2026" ×1.30
// no produto Coaster, válido de 10/02 a 18/02.

export const seasonalMultipliers = pgTable("seasonal_multipliers", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  restaurantId: integer("restaurantId").references(() => activeRestaurants.id, { onDelete: "cascade" }),
  seasonLabel: varchar("seasonLabel", { length: 100 }).notNull(),
  startDate: date("startDate").notNull(),
  endDate: date("endDate").notNull(),
  multiplier: decimal("multiplier", { precision: 5, scale: 2 }).notNull().default("1.00"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_seasonal_multipliers_product_id").on(t.productId),
  index("idx_seasonal_multipliers_restaurant_id").on(t.restaurantId),
  index("idx_seasonal_multipliers_period").on(t.startDate, t.endDate),
]);

export type SeasonalMultiplier = typeof seasonalMultipliers.$inferSelect;
export type InsertSeasonalMultiplier = typeof seasonalMultipliers.$inferInsert;

// ─── Campaign Drafts (Marketplace v2) ────────────────────────────────────────
// Persistência de carrinho do fluxo /montar-campanha por anunciante.
// `cartJson` guarda o snapshot do carrinho (locais, shares, datas, totais).

export const campaignDrafts = pgTable("campaign_drafts", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
  cartJson: jsonb("cartJson").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_campaign_drafts_client_id").on(t.clientId),
  index("idx_campaign_drafts_expires_at").on(t.expiresAt),
]);

export type CampaignDraft = typeof campaignDrafts.$inferSelect;
export type InsertCampaignDraft = typeof campaignDrafts.$inferInsert;

export const productPricingTiers = pgTable("product_pricing_tiers", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  volumeMin: integer("volumeMin").notNull(),
  volumeMax: integer("volumeMax"),
  custoUnitario: decimal("custoUnitario", { precision: 10, scale: 4 }).notNull().default("0.0000"),
  frete: decimal("frete", { precision: 10, scale: 2 }).notNull().default("0.00"),
  margem: decimal("margem", { precision: 5, scale: 2 }).notNull().default("50.00"),
  artes: integer("artes").default(1),
  precoBase: decimal("precoBase", { precision: 12, scale: 2 }),
}, (t) => [
  index("idx_product_pricing_tiers_product_id").on(t.productId),
]);

export type ProductPricingTier = typeof productPricingTiers.$inferSelect;
export type InsertProductPricingTier = typeof productPricingTiers.$inferInsert;

// ─── Product Discount Price Tiers ─────────────────────────────────────────────

export const productDiscountPriceTiers = pgTable("product_discount_price_tiers", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  priceMin: decimal("priceMin", { precision: 12, scale: 2 }).notNull(),
  priceMax: decimal("priceMax", { precision: 12, scale: 2 }).notNull(),
  discountPercent: decimal("discountPercent", { precision: 5, scale: 2 }).notNull(),
}, (t) => [
  index("idx_product_discount_price_tiers_product_id").on(t.productId),
]);

export type ProductDiscountPriceTier = typeof productDiscountPriceTiers.$inferSelect;
export type InsertProductDiscountPriceTier = typeof productDiscountPriceTiers.$inferInsert;

// ─── Quotation Items (cotação multiproduto) ───────────────────────────────────

export const quotationItems = pgTable("quotation_items", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotationId").notNull().references(() => quotations.id, { onDelete: "cascade" }),
  productId: integer("productId").notNull().references(() => products.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull().default(1),
  quantityPerLocation: integer("quantityPerLocation"),
  unitCost: decimal("unitCost", { precision: 10, scale: 4 }),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 4 }),
  totalPrice: decimal("totalPrice", { precision: 12, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_quotation_items_quotation_id").on(t.quotationId),
  index("idx_quotation_items_product_id").on(t.productId),
]);

export type QuotationItem = typeof quotationItems.$inferSelect;
export type InsertQuotationItem = typeof quotationItems.$inferInsert;

// ─── Campaign Products (campanha multiproduto) ────────────────────────────────

export const campaignProducts = pgTable("campaign_products", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  productId: integer("productId").notNull().references(() => products.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull().default(1),
  quantityPerLocation: integer("quantityPerLocation"),
  usagePerDay: decimal("usagePerDay", { precision: 6, scale: 2 }),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 4 }),
  totalPrice: decimal("totalPrice", { precision: 12, scale: 2 }),
  customPricingParams: jsonb("customPricingParams"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_campaign_products_campaign_id").on(t.campaignId),
  index("idx_campaign_products_product_id").on(t.productId),
]);

export type CampaignProduct = typeof campaignProducts.$inferSelect;
export type InsertCampaignProduct = typeof campaignProducts.$inferInsert;

// ─── Service Order Items (OS multiproduto) ────────────────────────────────────

export const serviceOrderItems = pgTable("service_order_items", {
  id: serial("id").primaryKey(),
  serviceOrderId: integer("serviceOrderId").notNull().references(() => serviceOrders.id, { onDelete: "cascade" }),
  productId: integer("productId").notNull().references(() => products.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull().default(1),
  productionStatus: productionStatusEnum("productionStatus").default("pending").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_service_order_items_order_id").on(t.serviceOrderId),
  index("idx_service_order_items_product_id").on(t.productId),
]);

export type ServiceOrderItem = typeof serviceOrderItems.$inferSelect;
export type InsertServiceOrderItem = typeof serviceOrderItems.$inferInsert;

// ─── CRM Notifications ───────────────────────────────────────────────────────

export const crmNotifications = pgTable("crm_notifications", {
  id: serial("id").primaryKey(),
  eventType: varchar("eventType", { length: 50 }).notNull(),
  leadId: integer("leadId").references(() => leads.id, { onDelete: "cascade" }),
  partnerId: integer("partnerId").references(() => partners.id, { onDelete: "set null" }),
  campaignId: integer("campaignId").references(() => campaigns.id, { onDelete: "cascade" }),
  clientId: integer("clientId").references(() => clients.id, { onDelete: "cascade" }),
  restaurantId: integer("restaurantId"),
  message: text("message").notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_crm_notifications_lead_id").on(t.leadId),
  index("idx_crm_notifications_read_at").on(t.readAt),
  index("idx_crm_notifications_created_at").on(t.createdAt),
  index("idx_crm_notifications_campaign_id").on(t.campaignId),
  index("idx_crm_notifications_client_id").on(t.clientId),
  index("idx_crm_notifications_restaurant_id").on(t.restaurantId),
]);

export type CrmNotification = typeof crmNotifications.$inferSelect;
export type InsertCrmNotification = typeof crmNotifications.$inferInsert;

// ─── User ↔ Restaurant (multi-access junction) ───────────────────────────────

export const userRestaurants = pgTable("user_restaurants", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  restaurantId: integer("restaurant_id").notNull().references(() => activeRestaurants.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_user_restaurants_user_id").on(t.userId),
  index("idx_user_restaurants_restaurant_id").on(t.restaurantId),
  unique("uq_user_restaurant").on(t.userId, t.restaurantId),
]);

export type UserRestaurant = typeof userRestaurants.$inferSelect;
export type InsertUserRestaurant = typeof userRestaurants.$inferInsert;

// ─── Campaign Reports ─────────────────────────────────────────────────────────

export const campaignReports = pgTable("campaign_reports", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  periodStart: date("periodStart").notNull(),
  periodEnd: date("periodEnd").notNull(),
  reportType: varchar("reportType", { length: 50 }).notNull().default("coaster"),
  numRestaurants: integer("numRestaurants").default(0).notNull(),
  coastersDistributed: integer("coastersDistributed").default(0).notNull(),
  usagePerDay: integer("usagePerDay").default(3).notNull(),
  daysInPeriod: integer("daysInPeriod").default(30).notNull(),
  numScreens: integer("numScreens").default(0).notNull(),
  spotsPerDay: integer("spotsPerDay").default(0).notNull(),
  spotDurationSeconds: integer("spotDurationSeconds").default(30).notNull(),
  activationEvents: integer("activationEvents").default(0).notNull(),
  peoplePerEvent: integer("peoplePerEvent").default(0).notNull(),
  totalImpressions: integer("totalImpressions").default(0).notNull(),
  notes: text("notes"),
  publishedAt: timestamp("publishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_campaign_reports_campaign_id").on(t.campaignId),
  index("idx_campaign_reports_published_at").on(t.publishedAt),
]);

export type CampaignReport = typeof campaignReports.$inferSelect;
export type InsertCampaignReport = typeof campaignReports.$inferInsert;

export const campaignReportPhotos = pgTable("campaign_report_photos", {
  id: serial("id").primaryKey(),
  reportId: integer("reportId").notNull().references(() => campaignReports.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  caption: varchar("caption", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_campaign_report_photos_report_id").on(t.reportId),
]);

export type CampaignReportPhoto = typeof campaignReportPhotos.$inferSelect;
export type InsertCampaignReportPhoto = typeof campaignReportPhotos.$inferInsert;

// ─── Integration Tokens (OAuth2 provider tokens) ──────────────────────────────

export const integrationTokens = pgTable("integration_tokens", {
  id: serial("id").primaryKey(),
  provider: varchar("provider", { length: 50 }).notNull().unique(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenType: varchar("tokenType", { length: 50 }),
  expiresAt: timestamp("expiresAt"),
  scopes: text("scopes"),
  metadata: jsonb("metadata"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type IntegrationToken = typeof integrationTokens.$inferSelect;

export const mediaKitSettings = pgTable("media_kit_settings", {
  id: serial("id").primaryKey(),
  pdfUrl: text("pdfUrl"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type MediaKitSettings = typeof mediaKitSettings.$inferSelect;

// ─── Accounts Payable (Contas a Pagar) ──────────────────────────────────────

// pgEnum espelhando o tipo `accounts_payable_source_type` criado em
// finrefac_02_accounts_payable_ledger_columns. Mantém Drizzle alinhado
// com o DB para tipagem forte das origens do ledger.
export const accountsPayableSourceTypeEnum = pgEnum("accounts_payable_source_type", [
  "restaurant_commission",
  "vip_repasse",
  "supplier_cost",
  "freight_cost",
  "partner_commission",
  "seller_commission",
  "tax",
  "manual",
]);

export const accountsPayable = pgTable("accounts_payable", {
  id: serial("id").primaryKey(),
  // campaignId é nullable porque restaurant_payments podem existir sem
  // campanha vinculada e o ledger precisa espelhá-las (lossless). O CHECK
  // chk_accounts_payable_campaign_required exige NOT NULL para todas as
  // demais origens.
  campaignId: integer("campaignId").references(() => campaigns.id, { onDelete: "cascade" }),
  // Rastreabilidade fase/item — permite saber qual item da qual fase gerou
  // este custo. Nullable pra compat com lançamentos antigos e despesas avulsas.
  campaignPhaseId: integer("campaignPhaseId").references(() => campaignPhases.id, { onDelete: "set null" }),
  campaignItemId: integer("campaignItemId").references(() => campaignItems.id, { onDelete: "set null" }),
  invoiceId: integer("invoiceId").references(() => invoices.id, { onDelete: "set null" }),
  supplierId: integer("supplierId").references(() => suppliers.id, { onDelete: "set null" }),
  vipProviderId: integer("vipProviderId").references(() => vipProviders.id, { onDelete: "set null" }),
  type: varchar("type", { length: 30 }).notNull(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: date("dueDate"),
  paymentDate: date("paymentDate"),
  status: varchar("status", { length: 20 }).notNull().default("pendente"),
  recipientType: varchar("recipientType", { length: 30 }),
  notes: text("notes"),
  proofUrl: text("proofUrl"),
  // ── Ledger único (finrefac fase 2) ──────────────────────────────────────
  // sourceType: origem semântica da obrigação (alinhada ao glossário §4).
  // sourceRef: ids da entidade-origem (ex.: { restaurantPaymentId, invoiceId }).
  // competenceMonth: mês de competência YYYY-MM para DRE.
  // createdBySystem: true quando linha foi gerada por trigger/sync, não por humano.
  sourceType: accountsPayableSourceTypeEnum("sourceType").notNull().default("manual"),
  sourceRef: jsonb("sourceRef").$type<Record<string, number | string | null | number[]>>(),
  competenceMonth: varchar("competenceMonth", { length: 7 }),
  createdBySystem: boolean("createdBySystem").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_accounts_payable_campaign_id").on(t.campaignId),
  index("idx_accounts_payable_status").on(t.status),
  index("idx_accounts_payable_type").on(t.type),
  index("idx_accounts_payable_vip_provider_id").on(t.vipProviderId),
  index("idx_accounts_payable_campaign_phase_id").on(t.campaignPhaseId),
  index("idx_accounts_payable_campaign_item_id").on(t.campaignItemId),
  index("idx_accounts_payable_status_due").on(t.status, t.dueDate),
  index("idx_accounts_payable_source_type_competence").on(t.sourceType, t.competenceMonth),
]);

export type AccountPayable = typeof accountsPayable.$inferSelect;
export type InsertAccountPayable = typeof accountsPayable.$inferInsert;

// ── Trilha de auditoria financeira (finrefac fase 5) ─────────────────────
// Registra TODA mutação relevante no módulo financeiro: invoices,
// accounts_payable, operational_costs, vip_providers, partners.
// `before`/`after` armazenam o snapshot completo da entidade em JSON.
// Quando `before` é NULL → criação. Quando `after` é NULL → exclusão.
export const financialAuditLog = pgTable("financial_audit_log", {
  id: serial("id").primaryKey(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: integer("entityId"),
  action: varchar("action", { length: 64 }).notNull(),
  actorUserId: varchar("actorUserId"),
  actorRole: varchar("actorRole", { length: 32 }),
  before: jsonb("before").$type<Record<string, unknown> | null>(),
  after: jsonb("after").$type<Record<string, unknown> | null>(),
  metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_fin_audit_entity").on(t.entityType, t.entityId),
  index("idx_fin_audit_actor").on(t.actorUserId),
  index("idx_fin_audit_created_at").on(t.createdAt),
  index("idx_fin_audit_action").on(t.action),
]);

export type FinancialAuditLog = typeof financialAuditLog.$inferSelect;
export type InsertFinancialAuditLog = typeof financialAuditLog.$inferInsert;

// ── Conciliação Bancária (finrefac fase 6) ───────────────────────────────
// bankAccounts: contas bancárias da empresa para reconciliação.
// bankTransactions: linhas de extrato (OFX/CSV) importadas; quando reconciladas,
// apontam para a fatura ou conta a pagar correspondente.
export const bankAccounts = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  bank: varchar("bank", { length: 50 }).notNull(),
  agency: varchar("agency", { length: 20 }),
  account: varchar("account", { length: 30 }),
  initialBalance: decimal("initialBalance", { precision: 14, scale: 2 }).notNull().default("0"),
  currency: varchar("currency", { length: 8 }).notNull().default("BRL"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type BankAccount = typeof bankAccounts.$inferSelect;
export type InsertBankAccount = typeof bankAccounts.$inferInsert;

export const bankTransactions = pgTable("bank_transactions", {
  id: serial("id").primaryKey(),
  bankAccountId: integer("bankAccountId").notNull().references(() => bankAccounts.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  // 'credit' = entrada (recebimento), 'debit' = saída (pagamento).
  type: varchar("type", { length: 10 }).notNull(),
  description: text("description").notNull(),
  // FITID do OFX ou hash linha do CSV — usado para deduplicar import.
  externalId: varchar("externalId", { length: 100 }),
  importBatchId: varchar("importBatchId", { length: 64 }),
  reconciled: boolean("reconciled").notNull().default(false),
  reconciledAt: timestamp("reconciledAt"),
  reconciledBy: varchar("reconciledBy"),
  // Em matches 1↔1: matchedEntityType + matchedEntityId. Em 1↔N: matches[].
  matchedEntityType: varchar("matchedEntityType", { length: 32 }),
  matchedEntityId: integer("matchedEntityId"),
  matches: jsonb("matches").$type<Array<{ entityType: "invoice" | "accounts_payable"; entityId: number; amount: string }>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_bank_tx_account").on(t.bankAccountId),
  index("idx_bank_tx_date").on(t.date),
  index("idx_bank_tx_reconciled").on(t.reconciled),
  index("idx_bank_tx_match").on(t.matchedEntityType, t.matchedEntityId),
  unique("uq_bank_tx_account_external").on(t.bankAccountId, t.externalId),
]);

export type BankTransaction = typeof bankTransactions.$inferSelect;
export type InsertBankTransaction = typeof bankTransactions.$inferInsert;

export * from "../shared/models/auth";
