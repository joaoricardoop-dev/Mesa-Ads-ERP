import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module
vi.mock("./db", () => ({
  listRestaurants: vi.fn().mockResolvedValue([
    { id: 1, name: "Bar do Zé", status: "active", coastersAllocated: 500 },
    { id: 2, name: "Restaurante Sol", status: "inactive", coastersAllocated: 1000 },
  ]),
  getRestaurant: vi.fn().mockResolvedValue({
    id: 1,
    name: "Bar do Zé",
    status: "active",
    coastersAllocated: 500,
    commissionPercent: "20.00",
  }),
  createRestaurant: vi.fn().mockResolvedValue({ id: 3 }),
  updateRestaurant: vi.fn().mockResolvedValue({ success: true }),
  deleteRestaurant: vi.fn().mockResolvedValue({ success: true }),

  listClients: vi.fn().mockResolvedValue([
    { id: 1, name: "Coca-Cola", company: "Coca-Cola Brasil", status: "active" },
  ]),
  getClient: vi.fn().mockResolvedValue({
    id: 1,
    name: "Coca-Cola",
    company: "Coca-Cola Brasil",
    status: "active",
  }),
  createClient: vi.fn().mockResolvedValue({ id: 2 }),
  updateClient: vi.fn().mockResolvedValue({ success: true }),
  deleteClient: vi.fn().mockResolvedValue({ success: true }),

  listCampaigns: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: "Verão 2026",
      clientId: 1,
      cpm: "50.00",
      status: "active",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-03-31"),
    },
  ]),
  getCampaign: vi.fn().mockResolvedValue({
    id: 1,
    name: "Verão 2026",
    clientId: 1,
    cpm: "50.00",
    status: "active",
  }),
  createCampaign: vi.fn().mockResolvedValue({ id: 2 }),
  updateCampaign: vi.fn().mockResolvedValue({ success: true }),
  deleteCampaign: vi.fn().mockResolvedValue({ success: true }),
  getCampaignRestaurants: vi.fn().mockResolvedValue([
    { id: 1, campaignId: 1, restaurantId: 1, coastersCount: 500, usagePerDay: 5 },
  ]),
  setCampaignRestaurants: vi.fn().mockResolvedValue({ success: true }),
  listSuppliers: vi.fn().mockResolvedValue([
    { id: 1, name: "Graftech Techsound", cnpj: "12.345.678/0001-90", city: "Manaus", state: "AM", status: "active" },
  ]),
  createSupplier: vi.fn().mockResolvedValue({ id: 2 }),
  updateSupplier: vi.fn().mockResolvedValue({ success: true }),
  deleteSupplier: vi.fn().mockResolvedValue({ success: true }),

  listBudgets: vi.fn().mockResolvedValue([
    {
      id: 1,
      supplierId: 1,
      code: "038075",
      description: "Bolacha Para Copo 8,5x8,5cm",
      productSpec: "4x0 cores, Reciclado 240g",
      status: "active",
      supplierName: "Graftech Techsound",
    },
  ]),
  createBudget: vi.fn().mockResolvedValue({ id: 2 }),
  updateBudget: vi.fn().mockResolvedValue({ success: true }),
  deleteBudget: vi.fn().mockResolvedValue({ success: true }),
  getBudgetItems: vi.fn().mockResolvedValue([
    { id: 1, budgetId: 1, quantity: 1000, unitPrice: "0.120", totalPrice: "120.00" },
    { id: 2, budgetId: 1, quantity: 5000, unitPrice: "0.080", totalPrice: "400.00" },
  ]),

  getMonthlyEconomics: vi.fn().mockResolvedValue({
    totals: {
      revenue: 10000,
      commission: 2000,
      production: 1200,
      profit: 6800,
      margin: 68,
      campaignCount: 2,
      restaurantCount: 5,
    },
    campaigns: [
      {
        id: 1,
        name: "Verão 2026",
        clientName: "Coca-Cola",
        cpm: "50.00",
        revenue: 5000,
        commission: 1000,
        production: 600,
        profit: 3400,
        margin: 68,
        restaurantCount: 3,
      },
    ],
  }),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("restaurant router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(createPublicContext());
  });

  it("lists restaurants", async () => {
    const result = await caller.restaurant.list();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Bar do Zé");
  });

  it("gets a single restaurant", async () => {
    const result = await caller.restaurant.get({ id: 1 });
    expect(result).toBeDefined();
    expect(result?.name).toBe("Bar do Zé");
  });

  it("creates a restaurant", async () => {
    const result = await caller.restaurant.create({
      name: "Novo Bar",
      coastersAllocated: 300,
      commissionPercent: "15.00",
    });
    expect(result).toEqual({ id: 3 });
  });

  it("updates a restaurant", async () => {
    const result = await caller.restaurant.update({
      id: 1,
      name: "Bar do Zé Atualizado",
    });
    expect(result).toEqual({ success: true });
  });

  it("deletes a restaurant", async () => {
    const result = await caller.restaurant.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });

  it("rejects restaurant creation with empty name", async () => {
    await expect(
      caller.restaurant.create({ name: "", coastersAllocated: 100 })
    ).rejects.toThrow();
  });
});

describe("advertiser router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(createPublicContext());
  });

  it("lists clients", async () => {
    const result = await caller.advertiser.list();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Coca-Cola");
  });

  it("gets a single client", async () => {
    const result = await caller.advertiser.get({ id: 1 });
    expect(result).toBeDefined();
    expect(result?.name).toBe("Coca-Cola");
  });

  it("creates a client", async () => {
    const result = await caller.advertiser.create({
      name: "Ambev",
      company: "Ambev S.A.",
      segment: "Bebidas",
    });
    expect(result).toEqual({ id: 2 });
  });

  it("updates a client", async () => {
    const result = await caller.advertiser.update({
      id: 1,
      company: "Coca-Cola Company",
    });
    expect(result).toEqual({ success: true });
  });

  it("deletes a client", async () => {
    const result = await caller.advertiser.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

describe("campaign router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(createPublicContext());
  });

  it("lists campaigns", async () => {
    const result = await caller.campaign.list();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Verão 2026");
  });

  it("gets a single campaign", async () => {
    const result = await caller.campaign.get({ id: 1 });
    expect(result).toBeDefined();
    expect(result?.name).toBe("Verão 2026");
  });

  it("creates a campaign with date conversion", async () => {
    const result = await caller.campaign.create({
      clientId: 1,
      name: "Inverno 2026",
      cpm: "60.00",
      startDate: "2026-06-01",
      endDate: "2026-08-31",
    });
    expect(result).toEqual({ id: 2 });
  });

  it("updates a campaign", async () => {
    const result = await caller.campaign.update({
      id: 1,
      status: "paused",
    });
    expect(result).toEqual({ success: true });
  });

  it("deletes a campaign", async () => {
    const result = await caller.campaign.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });

  it("gets campaign restaurants", async () => {
    const result = await caller.campaign.getRestaurants({ campaignId: 1 });
    expect(result).toHaveLength(1);
    expect(result[0].restaurantId).toBe(1);
  });

  it("sets campaign restaurants", async () => {
    const result = await caller.campaign.setRestaurants({
      campaignId: 1,
      restaurants: [
        { restaurantId: 1, coastersCount: 500, usagePerDay: 5 },
        { restaurantId: 2, coastersCount: 300, usagePerDay: 3 },
      ],
    });
    expect(result).toEqual({ success: true });
  });
});

describe("supplier router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(createPublicContext());
  });

  it("lists suppliers", async () => {
    const result = await caller.supplier.list();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Graftech Techsound");
  });

  it("creates a supplier", async () => {
    const result = await caller.supplier.create({
      name: "Nova Gráfica",
      city: "São Paulo",
      state: "SP",
    });
    expect(result).toEqual({ id: 2 });
  });

  it("updates a supplier", async () => {
    const result = await caller.supplier.update({
      id: 1,
      name: "Graftech Atualizada",
    });
    expect(result).toEqual({ success: true });
  });

  it("deletes a supplier", async () => {
    const result = await caller.supplier.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });

  it("rejects supplier creation with empty name", async () => {
    await expect(
      caller.supplier.create({ name: "" })
    ).rejects.toThrow();
  });
});

describe("budget router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(createPublicContext());
  });

  it("lists budgets", async () => {
    const result = await caller.budget.list();
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("Bolacha Para Copo 8,5x8,5cm");
  });

  it("gets budget items", async () => {
    const result = await caller.budget.getItems({ budgetId: 1 });
    expect(result).toHaveLength(2);
    expect(result[0].quantity).toBe(1000);
    expect(result[1].quantity).toBe(5000);
  });

  it("creates a budget with items", async () => {
    const result = await caller.budget.create({
      supplierId: 1,
      description: "Novo Orçamento",
      items: [
        { quantity: 1000, unitPrice: "0.150", totalPrice: "150.00" },
        { quantity: 2000, unitPrice: "0.120", totalPrice: "240.00" },
      ],
    });
    expect(result).toEqual({ id: 2 });
  });

  it("updates a budget", async () => {
    const result = await caller.budget.update({
      id: 1,
      description: "Orçamento Atualizado",
    });
    expect(result).toEqual({ success: true });
  });

  it("deletes a budget", async () => {
    const result = await caller.budget.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });

  it("rejects budget creation without description", async () => {
    await expect(
      caller.budget.create({
        supplierId: 1,
        description: "",
        items: [{ quantity: 1000, unitPrice: "0.100", totalPrice: "100.00" }],
      })
    ).rejects.toThrow();
  });
});

describe("economics router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(createPublicContext());
  });

  it("returns monthly economics data", async () => {
    const result = await caller.economics.monthly({ year: 2026, month: 2 });
    expect(result.totals).toBeDefined();
    expect(result.totals.revenue).toBe(10000);
    expect(result.totals.profit).toBe(6800);
    expect(result.totals.margin).toBe(68);
    expect(result.campaigns).toHaveLength(1);
    expect(result.campaigns[0].clientName).toBe("Coca-Cola");
  });

  it("rejects invalid month", async () => {
    await expect(
      caller.economics.monthly({ year: 2026, month: 13 })
    ).rejects.toThrow();
  });

  it("rejects month below 1", async () => {
    await expect(
      caller.economics.monthly({ year: 2026, month: 0 })
    ).rejects.toThrow();
  });
});
