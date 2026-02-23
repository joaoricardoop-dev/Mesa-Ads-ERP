import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  restaurants,
  clients,
  campaigns,
  campaignRestaurants,
  type InsertRestaurant,
  type InsertClient,
  type InsertCampaign,
  type InsertCampaignRestaurant,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ──────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

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
  const result = await db.insert(restaurants).values(data);
  return { id: result[0].insertId };
}

export async function updateRestaurant(id: number, data: Partial<InsertRestaurant>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(restaurants).set(data).where(eq(restaurants.id, id));
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
  const result = await db.insert(clients).values(data);
  return { id: result[0].insertId };
}

export async function updateClient(id: number, data: Partial<InsertClient>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(clients).set(data).where(eq(clients.id, id));
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
      cpm: campaigns.cpm,
      startDate: campaigns.startDate,
      endDate: campaigns.endDate,
      status: campaigns.status,
      notes: campaigns.notes,
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
  const result = await db.insert(campaigns).values(data);
  return { id: result[0].insertId };
}

export async function updateCampaign(id: number, data: Partial<InsertCampaign>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(campaigns).set(data).where(eq(campaigns.id, id));
}

export async function deleteCampaign(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete related campaign_restaurants first
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
    })
    .from(campaignRestaurants)
    .leftJoin(restaurants, eq(campaignRestaurants.restaurantId, restaurants.id))
    .where(eq(campaignRestaurants.campaignId, campaignId));
}

export async function setCampaignRestaurants(
  campaignId: number,
  items: Array<{ restaurantId: number; coastersCount: number; usagePerDay: number }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete existing
  await db.delete(campaignRestaurants).where(eq(campaignRestaurants.campaignId, campaignId));

  // Insert new
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

// ─── Monthly Economics ──────────────────────────────────────────────────────

export async function getMonthlyEconomics(year: number, month: number) {
  const db = await getDb();
  if (!db) return { campaigns: [], totals: { revenue: 0, commission: 0, production: 0, profit: 0 } };

  // Get the first and last day of the month
  const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const endOfMonth = new Date(year, month, 0);
  const endStr = `${year}-${String(month).padStart(2, "0")}-${String(endOfMonth.getDate()).padStart(2, "0")}`;

  // Get active campaigns that overlap with this month
  const activeCampaigns = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      clientId: campaigns.clientId,
      cpm: campaigns.cpm,
      startDate: campaigns.startDate,
      endDate: campaigns.endDate,
      status: campaigns.status,
      clientName: clients.name,
      clientCompany: clients.company,
    })
    .from(campaigns)
    .leftJoin(clients, eq(campaigns.clientId, clients.id))
    .where(
      sql`${campaigns.startDate} <= ${endStr} AND ${campaigns.endDate} >= ${startOfMonth}`
    );

  // For each campaign, get its restaurants and calculate economics
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

    // Calculate days in month for this campaign
    const campStart = new Date(campaign.startDate);
    const campEnd = new Date(campaign.endDate);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    const effectiveStart = campStart > monthStart ? campStart : monthStart;
    const effectiveEnd = campEnd < monthEnd ? campEnd : monthEnd;
    const daysInMonth = Math.max(0, Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const cpmValue = parseFloat(String(campaign.cpm));

    // Batch cost assumptions (from simulator defaults)
    const batchSize = 10000;
    const batchCost = 1200;
    const costPerCoaster = batchCost / batchSize;

    let campaignRevenue = 0;
    let campaignCommission = 0;
    let campaignProduction = 0;

    const restaurantDetails = campRestaurants.map((r) => {
      const impressions = r.coastersCount * r.usagePerDay * daysInMonth;
      const revenue = (impressions / 1000) * cpmValue;
      const commPercent = parseFloat(String(r.commissionPercent || "20"));
      const commission = revenue * (commPercent / 100);
      const production = r.coastersCount * costPerCoaster;
      const profit = revenue - commission - production;

      campaignRevenue += revenue;
      campaignCommission += commission;
      campaignProduction += production;

      return {
        restaurantId: r.restaurantId,
        restaurantName: r.restaurantName,
        coastersCount: r.coastersCount,
        usagePerDay: r.usagePerDay,
        impressions,
        revenue,
        commissionPercent: commPercent,
        commission,
        production,
        profit,
      };
    });

    const campaignProfit = campaignRevenue - campaignCommission - campaignProduction;

    totalRevenue += campaignRevenue;
    totalCommission += campaignCommission;
    totalProduction += campaignProduction;
    totalProfit += campaignProfit;

    campaignEconomics.push({
      id: campaign.id,
      name: campaign.name,
      clientName: campaign.clientName,
      clientCompany: campaign.clientCompany,
      cpm: cpmValue,
      status: campaign.status,
      daysInMonth,
      restaurantCount: campRestaurants.length,
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

import {
  suppliers,
  budgets,
  budgetItems,
  type InsertSupplier,
  type InsertBudget,
  type InsertBudgetItem,
} from "../drizzle/schema";

export async function listSuppliers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(suppliers).orderBy(desc(suppliers.createdAt));
}

export async function createSupplier(data: Omit<InsertSupplier, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(suppliers).values(data);
  return { id: result[0].insertId };
}

export async function updateSupplier(id: number, data: Partial<InsertSupplier>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(suppliers).set(data).where(eq(suppliers.id, id));
}

export async function deleteSupplier(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete related budgets and items first
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
  const result = await db.insert(budgets).values(data);
  const budgetId = result[0].insertId;

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
  await db.update(budgets).set(data).where(eq(budgets.id, id));

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
