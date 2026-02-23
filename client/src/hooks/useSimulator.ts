import { useState, useMemo, useEffect, useCallback } from "react";

export type CommissionType = "variable" | "fixed";

export interface SimulatorInputs {
  // Operacionais
  coastersPerRestaurant: number;
  usagePerDay: number;
  daysPerMonth: number;
  activeRestaurants: number;
  batchSize: number;
  batchCost: number;
  // Mídia
  cpm: number;
  // Comissão restaurante
  commissionType: CommissionType;
  restaurantCommission: number; // % se variável
  fixedCommission: number; // R$ se fixo
  minMargin: number;
  maxDiscount: number;
  // Comerciais
  cacPerRestaurant: number;
  contractDuration: number;
}

export interface BudgetOption {
  id: number;
  code: string | null;
  description: string;
  supplierName: string | null;
  items: Array<{
    quantity: number;
    unitPrice: string;
    totalPrice: string;
  }>;
}

export interface PerRestaurantMetrics {
  impressions: number;
  revenue: number;
  commission: number;
  unitProductionCost: number;
  productionCost: number;
  grossProfit: number;
  grossMargin: number;
}

export interface CPMTableRow {
  cpm: number;
  revenue: number;
  commission: number;
  production: number;
  profit: number;
  margin: number;
}

export interface DiscountTableRow {
  restaurants: number;
  discountPercent: number;
  unitPrice: number;
  totalRevenue: number;
  totalProfit: number;
  margin: number;
  marginWarning: boolean;
}

export interface UnitEconomics {
  ltv: number;
  ltvCacRatio: number;
  monthlyRevenue: number;
  monthlyProfit: number;
  annualRevenue: number;
  annualProfit: number;
}

export interface ScenarioData {
  name: string;
  cpm: number;
  revenue: number;
  profit: number;
  margin: number;
  monthlyTotal: number;
  annualTotal: number;
}

const STORAGE_KEY = "mesa-ads-simulator-inputs";
const BUDGET_STORAGE_KEY = "mesa-ads-simulator-budget-id";

const DEFAULT_INPUTS: SimulatorInputs = {
  coastersPerRestaurant: 500,
  usagePerDay: 3,
  daysPerMonth: 26,
  activeRestaurants: 10,
  batchSize: 10000,
  batchCost: 1200,
  cpm: 50,
  commissionType: "variable",
  restaurantCommission: 20,
  fixedCommission: 200,
  minMargin: 30,
  maxDiscount: 25,
  cacPerRestaurant: 300,
  contractDuration: 6,
};

function loadInputs(): SimulatorInputs {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_INPUTS, ...parsed };
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_INPUTS;
}

function saveInputs(inputs: SimulatorInputs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
  } catch {
    // ignore storage errors
  }
}

export function loadSavedBudgetId(): number | null {
  try {
    const stored = localStorage.getItem(BUDGET_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return null;
}

export function saveBudgetId(id: number | null) {
  try {
    if (id === null) {
      localStorage.removeItem(BUDGET_STORAGE_KEY);
    } else {
      localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(id));
    }
  } catch {
    // ignore
  }
}

/**
 * Interpola o custo unitário a partir da tabela de preços do orçamento.
 */
function interpolateUnitCost(
  items: Array<{ quantity: number; unitPrice: string }>,
  quantity: number
): number {
  if (items.length === 0) return 0;

  const sorted = [...items].sort((a, b) => a.quantity - b.quantity);

  if (quantity <= sorted[0].quantity) {
    return parseFloat(sorted[0].unitPrice);
  }

  if (quantity >= sorted[sorted.length - 1].quantity) {
    return parseFloat(sorted[sorted.length - 1].unitPrice);
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const lower = sorted[i];
    const upper = sorted[i + 1];
    if (quantity >= lower.quantity && quantity <= upper.quantity) {
      const ratio =
        (quantity - lower.quantity) / (upper.quantity - lower.quantity);
      const lowerPrice = parseFloat(lower.unitPrice);
      const upperPrice = parseFloat(upper.unitPrice);
      return lowerPrice + (upperPrice - lowerPrice) * ratio;
    }
  }

  return parseFloat(sorted[sorted.length - 1].unitPrice);
}

/**
 * Calcula a comissão com base no tipo (fixo ou variável).
 */
function calcCommission(
  revenue: number,
  inputs: SimulatorInputs
): number {
  if (inputs.commissionType === "fixed") {
    return inputs.fixedCommission;
  }
  return revenue * (inputs.restaurantCommission / 100);
}

export function useSimulator(selectedBudget?: BudgetOption | null) {
  const [inputs, setInputs] = useState<SimulatorInputs>(loadInputs);

  // Persist inputs to localStorage on every change
  useEffect(() => {
    saveInputs(inputs);
  }, [inputs]);

  const updateInput = useCallback(
    <K extends keyof SimulatorInputs>(key: K, value: SimulatorInputs[K]) => {
      setInputs((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Calculate the effective unit production cost
  const effectiveUnitCost = useMemo(() => {
    if (selectedBudget && selectedBudget.items.length > 0) {
      const totalCoasters =
        inputs.coastersPerRestaurant * inputs.activeRestaurants;
      return interpolateUnitCost(selectedBudget.items, totalCoasters);
    }
    return inputs.batchCost / inputs.batchSize;
  }, [
    selectedBudget,
    inputs.coastersPerRestaurant,
    inputs.activeRestaurants,
    inputs.batchCost,
    inputs.batchSize,
  ]);

  // Per-restaurant metrics
  const perRestaurant = useMemo<PerRestaurantMetrics>(() => {
    const impressions =
      inputs.coastersPerRestaurant * inputs.usagePerDay * inputs.daysPerMonth;
    const revenue = (impressions / 1000) * inputs.cpm;
    const commission = calcCommission(revenue, inputs);
    const unitProductionCost = effectiveUnitCost;
    const productionCost = inputs.coastersPerRestaurant * unitProductionCost;
    const grossProfit = revenue - commission - productionCost;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    return {
      impressions,
      revenue,
      commission,
      unitProductionCost,
      productionCost,
      grossProfit,
      grossMargin,
    };
  }, [inputs, effectiveUnitCost]);

  // CPM pricing table (30 to 80)
  const cpmTable = useMemo<CPMTableRow[]>(() => {
    const rows: CPMTableRow[] = [];
    const impressions =
      inputs.coastersPerRestaurant * inputs.usagePerDay * inputs.daysPerMonth;
    const production = inputs.coastersPerRestaurant * effectiveUnitCost;

    for (let cpm = 30; cpm <= 80; cpm += 5) {
      const revenue = (impressions / 1000) * cpm;
      const commission = calcCommission(revenue, inputs);
      const profit = revenue - commission - production;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      rows.push({ cpm, revenue, commission, production, profit, margin });
    }
    return rows;
  }, [inputs, effectiveUnitCost]);

  // Discount table (1 to 50 restaurants)
  const discountTable = useMemo<DiscountTableRow[]>(() => {
    const rows: DiscountTableRow[] = [];
    const impressions =
      inputs.coastersPerRestaurant * inputs.usagePerDay * inputs.daysPerMonth;
    const baseRevenue = (impressions / 1000) * inputs.cpm;
    const production = inputs.coastersPerRestaurant * effectiveUnitCost;

    const tiers = [1, 2, 3, 5, 8, 10, 15, 20, 25, 30, 40, 50];

    for (const n of tiers) {
      let discountPercent = 0;
      if (n > 1) {
        discountPercent = Math.min(
          ((n - 1) / 49) * inputs.maxDiscount,
          inputs.maxDiscount
        );
      }

      const discountedRevenue = baseRevenue * (1 - discountPercent / 100);
      const commission = calcCommission(discountedRevenue, inputs);
      const profit = discountedRevenue - commission - production;
      const margin =
        discountedRevenue > 0 ? (profit / discountedRevenue) * 100 : 0;

      const marginWarning = margin < inputs.minMargin;

      let finalDiscount = discountPercent;
      let finalRevenue = discountedRevenue;
      let finalProfit = profit;
      let finalMargin = margin;

      if (marginWarning) {
        const commRate =
          inputs.commissionType === "fixed"
            ? 0
            : inputs.restaurantCommission / 100;
        const fixedComm =
          inputs.commissionType === "fixed" ? inputs.fixedCommission : 0;
        const minRevenue =
          (production + fixedComm) / (1 - commRate - inputs.minMargin / 100);
        if (minRevenue <= baseRevenue) {
          finalDiscount = ((baseRevenue - minRevenue) / baseRevenue) * 100;
          finalRevenue = minRevenue;
          const finalCommission = calcCommission(finalRevenue, inputs);
          finalProfit = finalRevenue - finalCommission - production;
          finalMargin =
            finalRevenue > 0 ? (finalProfit / finalRevenue) * 100 : 0;
        }
      }

      rows.push({
        restaurants: n,
        discountPercent: marginWarning ? finalDiscount : discountPercent,
        unitPrice: marginWarning ? finalRevenue : discountedRevenue,
        totalRevenue: (marginWarning ? finalRevenue : discountedRevenue) * n,
        totalProfit: (marginWarning ? finalProfit : profit) * n,
        margin: marginWarning ? finalMargin : margin,
        marginWarning,
      });
    }
    return rows;
  }, [inputs, effectiveUnitCost]);

  // Unit Economics
  const unitEconomics = useMemo<UnitEconomics>(() => {
    const monthlyProfit = perRestaurant.grossProfit;
    const ltv = monthlyProfit * inputs.contractDuration;
    const ltvCacRatio =
      inputs.cacPerRestaurant > 0 ? ltv / inputs.cacPerRestaurant : 0;
    const monthlyRevenue = perRestaurant.revenue * inputs.activeRestaurants;
    const monthlyTotalProfit =
      perRestaurant.grossProfit * inputs.activeRestaurants;
    const annualRevenue = monthlyRevenue * 12;
    const annualProfit = monthlyTotalProfit * 12;

    return {
      ltv,
      ltvCacRatio,
      monthlyRevenue,
      monthlyProfit: monthlyTotalProfit,
      annualRevenue,
      annualProfit,
    };
  }, [perRestaurant, inputs]);

  // Scenarios
  const scenarios = useMemo<ScenarioData[]>(() => {
    const impressions =
      inputs.coastersPerRestaurant * inputs.usagePerDay * inputs.daysPerMonth;
    const production = inputs.coastersPerRestaurant * effectiveUnitCost;

    const scenarioConfigs = [
      { name: "Conservador", cpm: 35 },
      { name: "Base", cpm: inputs.cpm },
      { name: "Premium", cpm: 75 },
    ];

    return scenarioConfigs.map((s) => {
      const revenue = (impressions / 1000) * s.cpm;
      const commission = calcCommission(revenue, inputs);
      const profit = revenue - commission - production;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      const monthlyTotal = profit * inputs.activeRestaurants;
      const annualTotal = monthlyTotal * 12;

      return {
        name: s.name,
        cpm: s.cpm,
        revenue,
        profit,
        margin,
        monthlyTotal,
        annualTotal,
      };
    });
  }, [inputs, effectiveUnitCost]);

  // Chart data: Revenue vs Restaurants
  const revenueVsRestaurants = useMemo(() => {
    const data = [];
    for (let r = 1; r <= 50; r++) {
      data.push({
        restaurants: r,
        revenue: perRestaurant.revenue * r,
        profit: perRestaurant.grossProfit * r,
      });
    }
    return data;
  }, [perRestaurant]);

  // Chart data: Margin vs CPM
  const marginVsCpm = useMemo(() => {
    const impressions =
      inputs.coastersPerRestaurant * inputs.usagePerDay * inputs.daysPerMonth;
    const production = inputs.coastersPerRestaurant * effectiveUnitCost;
    const data = [];
    for (let cpm = 20; cpm <= 100; cpm += 5) {
      const revenue = (impressions / 1000) * cpm;
      const commission = calcCommission(revenue, inputs);
      const profit = revenue - commission - production;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      data.push({ cpm, margin, profit });
    }
    return data;
  }, [inputs, effectiveUnitCost]);

  // Chart data: Cumulative profit over months
  const cumulativeProfit = useMemo(() => {
    const monthlyProfit =
      perRestaurant.grossProfit * inputs.activeRestaurants;
    const totalCac = inputs.cacPerRestaurant * inputs.activeRestaurants;
    const data = [];
    for (let m = 0; m <= 24; m++) {
      data.push({
        month: m,
        profit: monthlyProfit * m - totalCac,
        revenue: perRestaurant.revenue * inputs.activeRestaurants * m,
      });
    }
    return data;
  }, [perRestaurant, inputs]);

  // Chart data: Discount sensitivity
  const discountSensitivity = useMemo(() => {
    const impressions =
      inputs.coastersPerRestaurant * inputs.usagePerDay * inputs.daysPerMonth;
    const baseRevenue = (impressions / 1000) * inputs.cpm;
    const production = inputs.coastersPerRestaurant * effectiveUnitCost;
    const data = [];
    for (let d = 0; d <= 40; d += 2) {
      const discountedRevenue = baseRevenue * (1 - d / 100);
      const commission = calcCommission(discountedRevenue, inputs);
      const profit = discountedRevenue - commission - production;
      const margin =
        discountedRevenue > 0 ? (profit / discountedRevenue) * 100 : 0;
      data.push({
        discount: d,
        margin,
        profit,
        belowMin: margin < inputs.minMargin,
      });
    }
    return data;
  }, [inputs, effectiveUnitCost]);

  return {
    inputs,
    updateInput,
    setInputs,
    effectiveUnitCost,
    perRestaurant,
    cpmTable,
    discountTable,
    unitEconomics,
    scenarios,
    revenueVsRestaurants,
    marginVsCpm,
    cumulativeProfit,
    discountSensitivity,
  };
}
