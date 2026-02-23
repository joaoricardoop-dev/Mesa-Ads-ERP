import { useState, useMemo, useEffect, useCallback } from "react";

export type CommissionType = "variable" | "fixed";
export type PricingType = "variable" | "fixed";

export interface SimulatorInputs {
  coastersPerRestaurant: number;
  usagePerDay: number;
  daysPerMonth: number;
  activeRestaurants: number;
  batchSize: number;
  batchCost: number;
  pricingType: PricingType;
  markupPercent: number;
  fixedPrice: number;
  commissionType: CommissionType;
  restaurantCommission: number;
  fixedCommission: number;
  minMargin: number;
  maxDiscount: number;
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

export interface MarkupTableRow {
  markup: number;
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
  markup: number;
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
  pricingType: "variable",
  markupPercent: 150,
  fixedPrice: 1500,
  commissionType: "variable",
  restaurantCommission: 20,
  fixedCommission: 0.05,
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

function calcCommission(
  revenue: number,
  inputs: SimulatorInputs
): number {
  const sellingPricePerCoaster = inputs.coastersPerRestaurant > 0
    ? revenue / inputs.coastersPerRestaurant
    : 0;
  if (inputs.commissionType === "fixed") {
    return inputs.fixedCommission * inputs.coastersPerRestaurant;
  }
  return sellingPricePerCoaster * (inputs.restaurantCommission / 100) * inputs.coastersPerRestaurant;
}

function calcRevenue(
  productionCost: number,
  inputs: SimulatorInputs
): number {
  if (inputs.pricingType === "fixed") {
    return inputs.fixedPrice;
  }
  return productionCost * (1 + inputs.markupPercent / 100);
}

function calcRevenueWithMarkup(
  productionCost: number,
  markupPercent: number,
  inputs: SimulatorInputs
): number {
  if (inputs.pricingType === "fixed") {
    return inputs.fixedPrice;
  }
  return productionCost * (1 + markupPercent / 100);
}

export function useSimulator(selectedBudget?: BudgetOption | null) {
  const [inputs, setInputs] = useState<SimulatorInputs>(loadInputs);

  useEffect(() => {
    saveInputs(inputs);
  }, [inputs]);

  const updateInput = useCallback(
    <K extends keyof SimulatorInputs>(key: K, value: SimulatorInputs[K]) => {
      setInputs((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

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

  const perRestaurant = useMemo<PerRestaurantMetrics>(() => {
    const impressions =
      inputs.coastersPerRestaurant * inputs.usagePerDay * inputs.daysPerMonth;
    const unitProductionCost = effectiveUnitCost;
    const productionCost = inputs.coastersPerRestaurant * unitProductionCost;
    const revenue = calcRevenue(productionCost, inputs);
    const commission = calcCommission(revenue, inputs);
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

  const markupTable = useMemo<MarkupTableRow[]>(() => {
    const production = inputs.coastersPerRestaurant * effectiveUnitCost;
    const rows: MarkupTableRow[] = [];

    const markups = [50, 75, 100, 125, 150, 175, 200, 250, 300];
    for (const markup of markups) {
      const revenue = calcRevenueWithMarkup(production, markup, inputs);
      const commission = calcCommission(revenue, inputs);
      const profit = revenue - commission - production;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      rows.push({ markup, revenue, commission, production, profit, margin });
    }
    return rows;
  }, [inputs, effectiveUnitCost]);

  const discountTable = useMemo<DiscountTableRow[]>(() => {
    const rows: DiscountTableRow[] = [];
    const production = inputs.coastersPerRestaurant * effectiveUnitCost;
    const baseRevenue = calcRevenue(production, inputs);

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
        const fixedCommTotal =
          inputs.commissionType === "fixed" ? inputs.fixedCommission * inputs.coastersPerRestaurant : 0;
        const minRevenue =
          (production + fixedCommTotal) / (1 - commRate - inputs.minMargin / 100);
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

  const scenarios = useMemo<ScenarioData[]>(() => {
    const production = inputs.coastersPerRestaurant * effectiveUnitCost;

    const scenarioConfigs = [
      { name: "Conservador", markup: 80 },
      { name: "Base", markup: inputs.pricingType === "variable" ? inputs.markupPercent : 150 },
      { name: "Premium", markup: 250 },
    ];

    return scenarioConfigs.map((s) => {
      const revenue = production * (1 + s.markup / 100);
      const commission = calcCommission(revenue, inputs);
      const profit = revenue - commission - production;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      const monthlyTotal = profit * inputs.activeRestaurants;
      const annualTotal = monthlyTotal * 12;

      return {
        name: s.name,
        markup: s.markup,
        revenue,
        profit,
        margin,
        monthlyTotal,
        annualTotal,
      };
    });
  }, [inputs, effectiveUnitCost]);

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

  const marginVsMarkup = useMemo(() => {
    const production = inputs.coastersPerRestaurant * effectiveUnitCost;
    const data = [];
    for (let markup = 0; markup <= 300; markup += 10) {
      const revenue = production * (1 + markup / 100);
      const commission = calcCommission(revenue, inputs);
      const profit = revenue - commission - production;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      data.push({ markup, margin, profit });
    }
    return data;
  }, [inputs, effectiveUnitCost]);

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

  const discountSensitivity = useMemo(() => {
    const production = inputs.coastersPerRestaurant * effectiveUnitCost;
    const baseRevenue = calcRevenue(production, inputs);
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
    markupTable,
    discountTable,
    unitEconomics,
    scenarios,
    revenueVsRestaurants,
    marginVsMarkup,
    cumulativeProfit,
    discountSensitivity,
  };
}
