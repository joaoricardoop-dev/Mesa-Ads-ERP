import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import {
  users,
  restaurants,
  clients,
  campaigns,
  campaignRestaurants,
  campaignHistory,
  activeRestaurants,
  restaurantPhotos,
  restaurantPayments,
  suppliers,
  budgets,
  budgetItems,
  type InsertRestaurant,
  type InsertClient,
  type InsertCampaign,
  type InsertCampaignRestaurant,
  type InsertActiveRestaurant,
  type InsertRestaurantPhoto,
  type InsertRestaurantPayment,
  type InsertSupplier,
  type InsertBudget,
  type InsertBudgetItem,
} from "../drizzle/schema";
import { calcularRating, temCamposRatingCompletos } from "../shared/rating";

neonConfig.webSocketConstructor = ws;

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      _db = drizzle(pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ──────────────────────────────────────────────────────────────────

export async function getUserById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Restaurants ────────────────────────────────────────────────────────────

export async function listRestaurants() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(restaurants).orderBy(desc(restaurants.createdAt));
}

export async function getRestaurant(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.id, id))
    .limit(1);
  return result[0];
}

export async function createRestaurant(data: Omit<InsertRestaurant, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(restaurants).values(data).returning({ id: restaurants.id });
  return { id: result[0].id };
}

export async function updateRestaurant(id: number, data: Partial<InsertRestaurant>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(restaurants).set({ ...data, updatedAt: new Date() }).where(eq(restaurants.id, id));
}

export async function deleteRestaurant(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(restaurants).where(eq(restaurants.id, id));
}

// ─── Clients ────────────────────────────────────────────────────────────────

export async function listClients() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clients).orderBy(desc(clients.createdAt));
}

export async function getClient(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  return result[0];
}

export async function createClient(data: Omit<InsertClient, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(clients).values(data).returning({ id: clients.id });
  return { id: result[0].id };
}

export async function updateClient(id: number, data: Partial<InsertClient>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(clients).set({ ...data, updatedAt: new Date() }).where(eq(clients.id, id));
}

export async function deleteClient(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(clients).where(eq(clients.id, id));
}

// ─── Campaigns ──────────────────────────────────────────────────────────────

export async function listCampaigns() {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      id: campaigns.id,
      clientId: campaigns.clientId,
      name: campaigns.name,
      startDate: campaigns.startDate,
      endDate: campaigns.endDate,
      status: campaigns.status,
      notes: campaigns.notes,
      coastersPerRestaurant: campaigns.coastersPerRestaurant,
      usagePerDay: campaigns.usagePerDay,
      daysPerMonth: campaigns.daysPerMonth,
      activeRestaurants: campaigns.activeRestaurants,
      pricingType: campaigns.pricingType,
      markupPercent: campaigns.markupPercent,
      fixedPrice: campaigns.fixedPrice,
      commissionType: campaigns.commissionType,
      restaurantCommission: campaigns.restaurantCommission,
      fixedCommission: campaigns.fixedCommission,
      sellerCommission: campaigns.sellerCommission,
      taxRate: campaigns.taxRate,
      contractDuration: campaigns.contractDuration,
      batchSize: campaigns.batchSize,
      batchCost: campaigns.batchCost,
      budgetId: campaigns.budgetId,
      createdAt: campaigns.createdAt,
      updatedAt: campaigns.updatedAt,
      clientName: clients.name,
      clientCompany: clients.company,
    })
    .from(campaigns)
    .leftJoin(clients, eq(campaigns.clientId, clients.id))
    .orderBy(desc(campaigns.createdAt));
  return result;
}

export async function getCampaign(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, id))
    .limit(1);
  return result[0];
}

export async function createCampaign(data: Omit<InsertCampaign, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(campaigns).values(data).returning({ id: campaigns.id });
  return { id: result[0].id };
}

export async function updateCampaign(id: number, data: Partial<InsertCampaign>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(campaigns).set({ ...data, updatedAt: new Date() }).where(eq(campaigns.id, id));
}

export async function deleteCampaign(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(campaignRestaurants).where(eq(campaignRestaurants.campaignId, id));
  await db.delete(campaigns).where(eq(campaigns.id, id));
}

// ─── Campaign Restaurants ───────────────────────────────────────────────────

export async function getCampaignRestaurants(campaignId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: campaignRestaurants.id,
      campaignId: campaignRestaurants.campaignId,
      restaurantId: campaignRestaurants.restaurantId,
      coastersCount: campaignRestaurants.coastersCount,
      usagePerDay: campaignRestaurants.usagePerDay,
      restaurantName: restaurants.name,
      restaurantNeighborhood: restaurants.neighborhood,
      restaurantCommission: restaurants.commissionPercent,
      ratingScore: activeRestaurants.ratingScore,
      ratingTier: activeRestaurants.ratingTier,
      ratingMultiplier: activeRestaurants.ratingMultiplier,
    })
    .from(campaignRestaurants)
    .leftJoin(restaurants, eq(campaignRestaurants.restaurantId, restaurants.id))
    .leftJoin(activeRestaurants, eq(activeRestaurants.parentRestaurantId, campaignRestaurants.restaurantId))
    .where(eq(campaignRestaurants.campaignId, campaignId));
}

export async function setCampaignRestaurants(
  campaignId: number,
  items: Array<{ restaurantId: number; coastersCount: number; usagePerDay: number }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(campaignRestaurants).where(eq(campaignRestaurants.campaignId, campaignId));

  if (items.length > 0) {
    await db.insert(campaignRestaurants).values(
      items.map((item) => ({
        campaignId,
        restaurantId: item.restaurantId,
        coastersCount: item.coastersCount,
        usagePerDay: item.usagePerDay,
      }))
    );
  }
}

// ─── Campaign History ───────────────────────────────────────────────────────

export async function getCampaignHistory(campaignId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(campaignHistory)
    .where(eq(campaignHistory.campaignId, campaignId))
    .orderBy(desc(campaignHistory.createdAt));
}

export async function addCampaignHistory(campaignId: number, action: string, details?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(campaignHistory).values({ campaignId, action, details });
}

export async function getClientHistory(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  const clientCampaigns = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.clientId, clientId));
  if (clientCampaigns.length === 0) return [];
  const campaignIds = clientCampaigns.map((c) => c.id);
  return db
    .select({
      id: campaignHistory.id,
      campaignId: campaignHistory.campaignId,
      campaignName: campaigns.name,
      action: campaignHistory.action,
      details: campaignHistory.details,
      createdAt: campaignHistory.createdAt,
    })
    .from(campaignHistory)
    .leftJoin(campaigns, eq(campaignHistory.campaignId, campaigns.id))
    .where(sql`${campaignHistory.campaignId} IN (${sql.join(campaignIds.map(id => sql`${id}`), sql`, `)})`)
    .orderBy(desc(campaignHistory.createdAt));
}

// ─── Monthly Economics ──────────────────────────────────────────────────────

export async function getMonthlyEconomics(year: number, month: number) {
  const db = await getDb();
  if (!db) return { campaigns: [], totals: { revenue: 0, commission: 0, production: 0, profit: 0 } };

  const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const endOfMonth = new Date(year, month, 0);
  const endStr = `${year}-${String(month).padStart(2, "0")}-${String(endOfMonth.getDate()).padStart(2, "0")}`;

  const activeCampaigns = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      clientId: campaigns.clientId,
      startDate: campaigns.startDate,
      endDate: campaigns.endDate,
      status: campaigns.status,
      coastersPerRestaurant: campaigns.coastersPerRestaurant,
      usagePerDay: campaigns.usagePerDay,
      daysPerMonth: campaigns.daysPerMonth,
      activeRestaurants: campaigns.activeRestaurants,
      pricingType: campaigns.pricingType,
      markupPercent: campaigns.markupPercent,
      fixedPrice: campaigns.fixedPrice,
      commissionType: campaigns.commissionType,
      restaurantCommission: campaigns.restaurantCommission,
      fixedCommission: campaigns.fixedCommission,
      sellerCommission: campaigns.sellerCommission,
      taxRate: campaigns.taxRate,
      batchSize: campaigns.batchSize,
      batchCost: campaigns.batchCost,
      clientName: clients.name,
      clientCompany: clients.company,
    })
    .from(campaigns)
    .leftJoin(clients, eq(campaigns.clientId, clients.id))
    .where(
      sql`${campaigns.startDate} <= ${endStr} AND ${campaigns.endDate} >= ${startOfMonth}`
    );

  const campaignEconomics = [];
  let totalRevenue = 0;
  let totalCommission = 0;
  let totalProduction = 0;
  let totalProfit = 0;

  for (const campaign of activeCampaigns) {
    const campRestaurants = await db
      .select({
        restaurantId: campaignRestaurants.restaurantId,
        coastersCount: campaignRestaurants.coastersCount,
        usagePerDay: campaignRestaurants.usagePerDay,
        restaurantName: restaurants.name,
        commissionPercent: restaurants.commissionPercent,
      })
      .from(campaignRestaurants)
      .leftJoin(restaurants, eq(campaignRestaurants.restaurantId, restaurants.id))
      .where(eq(campaignRestaurants.campaignId, campaign.id));

    const campStart = new Date(campaign.startDate);
    const campEnd = new Date(campaign.endDate);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    const effectiveStart = campStart > monthStart ? campStart : monthStart;
    const effectiveEnd = campEnd < monthEnd ? campEnd : monthEnd;
    const daysInMonth = Math.max(0, Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const coasters = campaign.coastersPerRestaurant;
    const unitCost = parseFloat(String(campaign.batchCost)) / campaign.batchSize;
    const productionCostPerRest = coasters * unitCost;
    const sellerRate = parseFloat(String(campaign.sellerCommission)) / 100;
    const taxRateDecimal = parseFloat(String(campaign.taxRate)) / 100;
    const markupPct = parseFloat(String(campaign.markupPercent));
    const restCommFixed = campaign.commissionType === "fixed" ? parseFloat(String(campaign.fixedCommission)) * coasters : 0;
    const custoPD = productionCostPerRest + restCommFixed;
    const restVarRate = campaign.commissionType === "variable" ? parseFloat(String(campaign.restaurantCommission)) / 100 : 0;
    const totalVarRate = sellerRate + taxRateDecimal + restVarRate;
    const denominator = 1 - totalVarRate;
    const custoBruto = denominator > 0 ? custoPD / denominator : custoPD;

    let sellingPrice: number;
    if (campaign.pricingType === "fixed") {
      sellingPrice = custoBruto + parseFloat(String(campaign.fixedPrice));
    } else {
      sellingPrice = custoBruto * (1 + markupPct / 100);
    }

    const actualRestComm = campaign.commissionType === "fixed"
      ? parseFloat(String(campaign.fixedCommission)) * coasters
      : sellingPrice * (parseFloat(String(campaign.restaurantCommission)) / 100);
    const actualSellerComm = sellingPrice * sellerRate;
    const actualTax = sellingPrice * taxRateDecimal;
    const totalCosts = productionCostPerRest + actualRestComm + actualSellerComm + actualTax;
    const profit = sellingPrice - totalCosts;

    const restCount = campRestaurants.length > 0 ? campRestaurants.length : campaign.activeRestaurants;
    const campaignRevenue = sellingPrice * restCount;
    const campaignCommission = actualRestComm * restCount;
    const campaignProduction = productionCostPerRest * restCount;
    const campaignProfit = profit * restCount;

    totalRevenue += campaignRevenue;
    totalCommission += campaignCommission;
    totalProduction += campaignProduction;
    totalProfit += campaignProfit;

    const restaurantDetails = campRestaurants.map((r) => {
      const impressions = r.coastersCount * r.usagePerDay * daysInMonth;
      return {
        restaurantId: r.restaurantId,
        restaurantName: r.restaurantName,
        coastersCount: r.coastersCount,
        usagePerDay: r.usagePerDay,
        impressions,
        revenue: sellingPrice,
        commissionPercent: parseFloat(String(r.commissionPercent || "20")),
        commission: actualRestComm,
        production: productionCostPerRest,
        profit,
      };
    });

    campaignEconomics.push({
      id: campaign.id,
      name: campaign.name,
      clientName: campaign.clientName,
      clientCompany: campaign.clientCompany,
      status: campaign.status,
      daysInMonth,
      restaurantCount: restCount,
      revenue: campaignRevenue,
      commission: campaignCommission,
      production: campaignProduction,
      profit: campaignProfit,
      margin: campaignRevenue > 0 ? (campaignProfit / campaignRevenue) * 100 : 0,
      restaurants: restaurantDetails,
    });
  }

  return {
    campaigns: campaignEconomics,
    totals: {
      revenue: totalRevenue,
      commission: totalCommission,
      production: totalProduction,
      profit: totalProfit,
      margin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
      campaignCount: activeCampaigns.length,
      restaurantCount: campaignEconomics.reduce((sum, c) => sum + c.restaurantCount, 0),
    },
  };
}

// ─── Suppliers ─────────────────────────────────────────────────────────────

export async function listSuppliers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(suppliers).orderBy(desc(suppliers.createdAt));
}

export async function createSupplier(data: Omit<InsertSupplier, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(suppliers).values(data).returning({ id: suppliers.id });
  return { id: result[0].id };
}

export async function updateSupplier(id: number, data: Partial<InsertSupplier>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(suppliers).set({ ...data, updatedAt: new Date() }).where(eq(suppliers.id, id));
}

export async function deleteSupplier(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const supplierBudgets = await db.select({ id: budgets.id }).from(budgets).where(eq(budgets.supplierId, id));
  for (const b of supplierBudgets) {
    await db.delete(budgetItems).where(eq(budgetItems.budgetId, b.id));
  }
  await db.delete(budgets).where(eq(budgets.supplierId, id));
  await db.delete(suppliers).where(eq(suppliers.id, id));
}

// ─── Budgets ───────────────────────────────────────────────────────────────

export async function listBudgets() {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      id: budgets.id,
      supplierId: budgets.supplierId,
      code: budgets.code,
      description: budgets.description,
      productSpec: budgets.productSpec,
      validUntil: budgets.validUntil,
      status: budgets.status,
      notes: budgets.notes,
      createdAt: budgets.createdAt,
      updatedAt: budgets.updatedAt,
      supplierName: suppliers.name,
      supplierCity: suppliers.city,
      supplierState: suppliers.state,
    })
    .from(budgets)
    .leftJoin(suppliers, eq(budgets.supplierId, suppliers.id))
    .orderBy(desc(budgets.createdAt));
  return result;
}

export async function createBudget(
  data: Omit<InsertBudget, "id" | "createdAt" | "updatedAt">,
  items: Array<{ quantity: number; unitPrice: string; totalPrice: string }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(budgets).values(data).returning({ id: budgets.id });
  const budgetId = result[0].id;

  if (items.length > 0) {
    await db.insert(budgetItems).values(
      items.map((item) => ({
        budgetId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      }))
    );
  }

  return { id: budgetId };
}

export async function updateBudget(
  id: number,
  data: Partial<InsertBudget>,
  items?: Array<{ quantity: number; unitPrice: string; totalPrice: string }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(budgets).set({ ...data, updatedAt: new Date() }).where(eq(budgets.id, id));

  if (items !== undefined) {
    await db.delete(budgetItems).where(eq(budgetItems.budgetId, id));
    if (items.length > 0) {
      await db.insert(budgetItems).values(
        items.map((item) => ({
          budgetId: id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        }))
      );
    }
  }
}

export async function deleteBudget(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(budgetItems).where(eq(budgetItems.budgetId, id));
  await db.delete(budgets).where(eq(budgets.id, id));
}

export async function getBudgetItems(budgetId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(budgetItems)
    .where(eq(budgetItems.budgetId, budgetId))
    .orderBy(budgetItems.quantity);
}

export async function listBudgetsBySupplier(supplierId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(budgets)
    .where(eq(budgets.supplierId, supplierId))
    .orderBy(desc(budgets.createdAt));
}

// ─── Budget lookup for Simulator ──────────────────────────────────────────

export async function listActiveBudgetsWithItems() {
  const db = await getDb();
  if (!db) return [];

  const activeBudgets = await db
    .select({
      id: budgets.id,
      supplierId: budgets.supplierId,
      code: budgets.code,
      description: budgets.description,
      supplierName: suppliers.name,
    })
    .from(budgets)
    .leftJoin(suppliers, eq(budgets.supplierId, suppliers.id))
    .where(eq(budgets.status, "active"))
    .orderBy(desc(budgets.createdAt));

  const result = [];
  for (const b of activeBudgets) {
    const items = await db
      .select({
        quantity: budgetItems.quantity,
        unitPrice: budgetItems.unitPrice,
        totalPrice: budgetItems.totalPrice,
      })
      .from(budgetItems)
      .where(eq(budgetItems.budgetId, b.id))
      .orderBy(budgetItems.quantity);

    result.push({
      ...b,
      items,
    });
  }

  return result;
}

export async function listActiveRestaurants() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(activeRestaurants).orderBy(activeRestaurants.name);
}

export async function getActiveRestaurant(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(activeRestaurants).where(eq(activeRestaurants.id, id)).limit(1);
  return result[0];
}

export async function recalculateAllRatings() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const all = await db.select().from(activeRestaurants);
  let atualizados = 0, ignorados = 0;

  for (const r of all) {
    if (!temCamposRatingCompletos(r)) {
      ignorados++;
      continue;
    }
    const rating = calcularRating(r);
    await db.update(activeRestaurants).set({
      ratingScore: String(rating.score),
      ratingTier: rating.tier,
      ratingMultiplier: String(rating.multiplicador),
      ratingUpdatedAt: new Date(),
    }).where(eq(activeRestaurants.id, r.id));
    atualizados++;
  }

  return { total: all.length, atualizados, ignorados };
}

const RATING_FIELDS = [
  'monthlyDrinksSold', 'tableCount', 'ticketMedio',
  'locationRating', 'venueType', 'digitalPresence'
];

export async function createActiveRestaurant(data: InsertActiveRestaurant) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(activeRestaurants).values(data).returning();
  const restaurant = result[0];

  if (temCamposRatingCompletos(restaurant)) {
    const rating = calcularRating(restaurant);
    const updated = await db.update(activeRestaurants).set({
      ratingScore: String(rating.score),
      ratingTier: rating.tier,
      ratingMultiplier: String(rating.multiplicador),
      ratingUpdatedAt: new Date(),
    }).where(eq(activeRestaurants.id, restaurant.id)).returning();
    return updated[0];
  }

  return restaurant;
}

export async function updateActiveRestaurant(id: number, data: Partial<InsertActiveRestaurant>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.update(activeRestaurants).set({ ...data, updatedAt: new Date() }).where(eq(activeRestaurants.id, id)).returning();
  const restaurant = result[0];

  const alterouRating = RATING_FIELDS.some(campo => campo in data);
  if (alterouRating) {
    if (temCamposRatingCompletos(restaurant)) {
      const rating = calcularRating(restaurant);
      const updated = await db.update(activeRestaurants).set({
        ratingScore: String(rating.score),
        ratingTier: rating.tier,
        ratingMultiplier: String(rating.multiplicador),
        ratingUpdatedAt: new Date(),
      }).where(eq(activeRestaurants.id, id)).returning();
      return updated[0];
    } else {
      const updated = await db.update(activeRestaurants).set({
        ratingScore: null,
        ratingTier: null,
        ratingMultiplier: null,
        ratingUpdatedAt: null,
      }).where(eq(activeRestaurants.id, id)).returning();
      return updated[0];
    }
  }

  return restaurant;
}

export async function deleteActiveRestaurant(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(activeRestaurants).where(eq(activeRestaurants.id, id));
}

// ─── Restaurant Profile (enriched queries) ─────────────────────────────────

export async function getRestaurantCampaigns(restaurantId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      campaignId: campaignRestaurants.campaignId,
      coastersCount: campaignRestaurants.coastersCount,
      usagePerDay: campaignRestaurants.usagePerDay,
      campaignName: campaigns.name,
      clientId: campaigns.clientId,
      startDate: campaigns.startDate,
      endDate: campaigns.endDate,
      status: campaigns.status,
      coastersPerRestaurant: campaigns.coastersPerRestaurant,
      pricingType: campaigns.pricingType,
      markupPercent: campaigns.markupPercent,
      fixedPrice: campaigns.fixedPrice,
      commissionType: campaigns.commissionType,
      restaurantCommission: campaigns.restaurantCommission,
      fixedCommission: campaigns.fixedCommission,
      sellerCommission: campaigns.sellerCommission,
      taxRate: campaigns.taxRate,
      contractDuration: campaigns.contractDuration,
      batchSize: campaigns.batchSize,
      batchCost: campaigns.batchCost,
      daysPerMonth: campaigns.daysPerMonth,
      activeRestaurants: campaigns.activeRestaurants,
    })
    .from(campaignRestaurants)
    .leftJoin(campaigns, eq(campaigns.id, campaignRestaurants.campaignId))
    .where(eq(campaignRestaurants.restaurantId, restaurantId))
    .orderBy(desc(campaigns.startDate));

  const clientIds = Array.from(new Set(result.map(r => r.clientId).filter(Boolean))) as number[];
  let clientsMap: Record<number, string> = {};
  if (clientIds.length > 0) {
    const clientRows = await db.select({ id: clients.id, name: clients.name, company: clients.company }).from(clients);
    for (const c of clientRows) {
      clientsMap[c.id] = c.company ? `${c.name} (${c.company})` : c.name;
    }
  }

  return result.map(r => ({
    ...r,
    clientName: r.clientId ? clientsMap[r.clientId] || "" : "",
  }));
}

export async function getRestaurantBranches(parentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(activeRestaurants)
    .where(sql`${activeRestaurants.id} != ${parentId}`)
    .orderBy(activeRestaurants.name);
}

export async function linkBranch(parentId: number, branchId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(activeRestaurants)
    .set({ parentRestaurantId: parentId, updatedAt: new Date() })
    .where(eq(activeRestaurants.id, branchId));
}

export async function unlinkBranch(branchId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(activeRestaurants)
    .set({ parentRestaurantId: null, updatedAt: new Date() })
    .where(eq(activeRestaurants.id, branchId));
}

// ─── Restaurant Photos ──────────────────────────────────────────────────────

export async function listRestaurantPhotos(restaurantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(restaurantPhotos)
    .where(eq(restaurantPhotos.restaurantId, restaurantId))
    .orderBy(desc(restaurantPhotos.createdAt));
}

export async function addRestaurantPhoto(data: InsertRestaurantPhoto) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(restaurantPhotos).values(data).returning();
}

export async function deleteRestaurantPhoto(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(restaurantPhotos).where(eq(restaurantPhotos.id, id));
}

// ─── Restaurant Payments ────────────────────────────────────────────────────

export async function listRestaurantPayments(restaurantId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    id: restaurantPayments.id,
    restaurantId: restaurantPayments.restaurantId,
    campaignId: restaurantPayments.campaignId,
    amount: restaurantPayments.amount,
    referenceMonth: restaurantPayments.referenceMonth,
    paymentDate: restaurantPayments.paymentDate,
    status: restaurantPayments.status,
    pixKey: restaurantPayments.pixKey,
    notes: restaurantPayments.notes,
    createdAt: restaurantPayments.createdAt,
    campaignName: campaigns.name,
  })
    .from(restaurantPayments)
    .leftJoin(campaigns, eq(campaigns.id, restaurantPayments.campaignId))
    .where(eq(restaurantPayments.restaurantId, restaurantId))
    .orderBy(desc(restaurantPayments.referenceMonth));
  return result;
}

export async function addRestaurantPayment(data: InsertRestaurantPayment) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(restaurantPayments).values(data).returning();
}

export async function updateRestaurantPayment(id: number, data: Partial<InsertRestaurantPayment>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(restaurantPayments).set(data).where(eq(restaurantPayments.id, id)).returning();
}

export async function deleteRestaurantPayment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(restaurantPayments).where(eq(restaurantPayments.id, id));
}
