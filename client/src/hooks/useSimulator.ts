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
  sellerCommission: number;
  taxRate: number;
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
  productionCost: number;
  unitProductionCost: number;
  restaurantCommission: number;
  agencyCommission: number;
  custoPD: number;
  sellerCommissionValue: number;
  taxValue: number;
  custoBruto: number;
  totalCosts: number;
  markupValue: number;
  sellingPrice: number;
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
  contractValue: number;
  contractProfit: number;
  sellerCommissionValue: number;
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
  markupPercent: 30,
  fixedPrice: 1500,
  commissionType: "variable",
  restaurantCommission: 20,
  fixedCommission: 0.05,
  minMargin: 15,
  maxDiscount: 25,
  sellerCommission: 10,
  taxRate: 15,
  contractDuration: 6,
};

export function loadInputs(): SimulatorInputs {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_INPUTS, ...parsed };
    }
  } catch {
  }
  return DEFAULT_INPUTS;
}

function saveInputs(inputs: SimulatorInputs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
  } catch {
  }
}

export function loadSavedBudgetId(): number | null {
  try {
    const stored = localStorage.getItem(BUDGET_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
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
      const denom = upper.quantity - lower.quantity;
      if (denom === 0) return parseFloat(lower.unitPrice);
      const ratio = (quantity - lower.quantity) / denom;
      const lowerPrice = parseFloat(lower.unitPrice);
      const upperPrice = parseFloat(upper.unitPrice);
      return lowerPrice + (upperPrice - lowerPrice) * ratio;
    }
  }

  return parseFloat(sorted[sorted.length - 1].unitPrice);
}

interface PricingResult {
  productionCost: number;
  restaurantCommission: number;
  agencyCommission: number;
  custoPD: number;
  sellerCommissionValue: number;
  taxValue: number;
  custoBruto: number;
  totalCosts: number;
  markupValue: number;
  sellingPrice: number;
  grossProfit: number;
  grossMargin: number;
}

interface CalcPricingOptions {
  markupOverride?: number;
  restaurantCommissionRate?: number;
  multiplier?: number;
}

export function calcPricing(
  productionCost: number,
  inputs: SimulatorInputs,
  opts: CalcPricingOptions = {}
): PricingResult {
  const coasters = inputs.coastersPerRestaurant;
  const markupPct = opts.markupOverride !== undefined ? opts.markupOverride : inputs.markupPercent;
  const restDbRate = (opts.restaurantCommissionRate ?? 10) / 100;
  const mult = opts.multiplier ?? 1.0;

  const agencyFixed =
    inputs.commissionType === "fixed"
      ? inputs.fixedCommission * coasters
      : 0;

  const custoPD = productionCost + agencyFixed;

  const sellerRate = inputs.sellerCommission / 100;
  const taxRateDecimal = inputs.taxRate / 100;
  const agencyVarRate =
    inputs.commissionType === "variable"
      ? inputs.restaurantCommission / 100
      : 0;

  const totalVarRate = sellerRate + taxRateDecimal + agencyVarRate + restDbRate;

  const denominator = 1 - totalVarRate;
  const custoBruto = denominator > 0 ? custoPD / denominator : custoPD;

  let baseSellingPrice: number;
  if (inputs.pricingType === "fixed") {
    baseSellingPrice = custoBruto + inputs.fixedPrice;
  } else {
    baseSellingPrice = custoBruto * (1 + markupPct / 100);
  }

  const sellingPrice = baseSellingPrice * mult;

  const actualAgencyComm =
    inputs.commissionType === "fixed"
      ? inputs.fixedCommission * coasters
      : sellingPrice * (inputs.restaurantCommission / 100);
  const actualRestCommission = sellingPrice * restDbRate;
  const actualSellerComm = sellingPrice * sellerRate;
  const actualTax = sellingPrice * taxRateDecimal;

  const totalCosts =
    productionCost + actualRestCommission + actualAgencyComm + actualSellerComm + actualTax;
  const markupValue = sellingPrice - totalCosts;
  const grossProfit = markupValue;
  const grossMargin = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;

  return {
    productionCost,
    restaurantCommission: actualRestCommission,
    agencyCommission: actualAgencyComm,
    custoPD,
    sellerCommissionValue: actualSellerComm,
    taxValue: actualTax,
    custoBruto,
    totalCosts,
    markupValue,
    sellingPrice,
    grossProfit,
    grossMargin,
  };
}

export function useSimulator(
  selectedBudget?: BudgetOption | null,
  restaurantCommissionRate?: number,
  weightedMultiplier?: number
) {
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

    const pricing = calcPricing(productionCost, inputs, {
      restaurantCommissionRate,
      multiplier: weightedMultiplier,
    });

    return {
      impressions,
      unitProductionCost,
      ...pricing,
    };
  }, [inputs, effectiveUnitCost, restaurantCommissionRate, weightedMultiplier]);

  const markupTable = useMemo<MarkupTableRow[]>(() => {
    const production = inputs.coastersPerRestaurant * effectiveUnitCost;
    const rows: MarkupTableRow[] = [];

    const markups = [50, 75, 100, 125, 150, 175, 200, 250, 300];
    for (const markup of markups) {
      const p = calcPricing(production, inputs, {
        markupOverride: markup,
        restaurantCommissionRate,
        multiplier: weightedMultiplier,
      });
      rows.push({
        markup,
        revenue: p.sellingPrice,
        commission: p.restaurantCommission + p.agencyCommission,
        production,
        profit: p.grossProfit,
        margin: p.grossMargin,
      });
    }
    return rows;
  }, [inputs, effectiveUnitCost, restaurantCommissionRate, weightedMultiplier]);

  const discountTable = useMemo<DiscountTableRow[]>(() => {
    const rows: DiscountTableRow[] = [];
    const production = inputs.coastersPerRestaurant * effectiveUnitCost;
    const restDbRate = (restaurantCommissionRate ?? 10) / 100;
    const baseResult = calcPricing(production, inputs, { restaurantCommissionRate, multiplier: weightedMultiplier });
    const basePrice = baseResult.sellingPrice;

    const tiers = [1, 2, 3, 5, 8, 10, 15, 20, 25, 30, 40, 50];

    for (const n of tiers) {
      let discountPercent = 0;
      if (n > 1) {
        discountPercent = Math.min(
          ((n - 1) / 49) * inputs.maxDiscount,
          inputs.maxDiscount
        );
      }

      const discountedPrice = basePrice * (1 - discountPercent / 100);

      const agencyComm =
        inputs.commissionType === "fixed"
          ? inputs.fixedCommission * inputs.coastersPerRestaurant
          : discountedPrice * (inputs.restaurantCommission / 100);
      const restComm = discountedPrice * restDbRate;
      const sellerComm = discountedPrice * (inputs.sellerCommission / 100);
      const tax = discountedPrice * (inputs.taxRate / 100);
      const profit = discountedPrice - production - agencyComm - restComm - sellerComm - tax;
      const margin =
        discountedPrice > 0 ? (profit / discountedPrice) * 100 : 0;

      const marginWarning = margin < inputs.minMargin;

      let finalDiscount = discountPercent;
      let finalPrice = discountedPrice;
      let finalProfit = profit;
      let finalMargin = margin;

      if (marginWarning) {
        const agencyVarRate =
          inputs.commissionType === "variable"
            ? inputs.restaurantCommission / 100
            : 0;
        const fixedCommTotal =
          inputs.commissionType === "fixed"
            ? inputs.fixedCommission * inputs.coastersPerRestaurant
            : 0;
        const totalVarRate =
          agencyVarRate + restDbRate +
          inputs.sellerCommission / 100 +
          inputs.taxRate / 100;
        const minPrice =
          (production + fixedCommTotal) /
          (1 - totalVarRate - inputs.minMargin / 100);
        if (minPrice <= basePrice) {
          finalDiscount = ((basePrice - minPrice) / basePrice) * 100;
          finalPrice = minPrice;
          const fAgencyComm =
            inputs.commissionType === "fixed"
              ? fixedCommTotal
              : finalPrice * (inputs.restaurantCommission / 100);
          const fRestComm = finalPrice * restDbRate;
          const fSellerComm = finalPrice * (inputs.sellerCommission / 100);
          const fTax = finalPrice * (inputs.taxRate / 100);
          finalProfit = finalPrice - production - fAgencyComm - fRestComm - fSellerComm - fTax;
          finalMargin =
            finalPrice > 0 ? (finalProfit / finalPrice) * 100 : 0;
        }
      }

      rows.push({
        restaurants: n,
        discountPercent: marginWarning ? finalDiscount : discountPercent,
        unitPrice: marginWarning ? finalPrice : discountedPrice,
        totalRevenue: (marginWarning ? finalPrice : discountedPrice) * n,
        totalProfit: (marginWarning ? finalProfit : profit) * n,
        margin: marginWarning ? finalMargin : margin,
        marginWarning,
      });
    }
    return rows;
  }, [inputs, effectiveUnitCost, restaurantCommissionRate, weightedMultiplier]);

  const unitEconomics = useMemo<UnitEconomics>(() => {
    const monthlyRevenue = perRestaurant.sellingPrice * inputs.activeRestaurants;
    const monthlyTotalProfit =
      perRestaurant.grossProfit * inputs.activeRestaurants;
    const contractValue = monthlyRevenue * inputs.contractDuration;
    const contractProfit = monthlyTotalProfit * inputs.contractDuration;
    const sellerCommissionValue = perRestaurant.sellerCommissionValue * inputs.activeRestaurants * inputs.contractDuration;
    const annualRevenue = monthlyRevenue * 12;
    const annualProfit = monthlyTotalProfit * 12;

    return {
      contractValue,
      contractProfit,
      sellerCommissionValue,
      monthlyRevenue,
      monthlyProfit: monthlyTotalProfit,
      annualRevenue,
      annualProfit,
    };
  }, [perRestaurant, inputs]);

  const scenarios = useMemo<ScenarioData[]>(() => {
    const production = inputs.coastersPerRestaurant * effectiveUnitCost;

    const scenarioConfigs = [
      { name: "Conservador", markup: 15 },
      { name: "Base", markup: inputs.pricingType === "variable" ? inputs.markupPercent : 30 },
      { name: "Premium", markup: 50 },
    ];

    return scenarioConfigs.map((s) => {
      const p = calcPricing(production, inputs, {
        markupOverride: s.markup,
        restaurantCommissionRate,
        multiplier: weightedMultiplier,
      });
      const monthlyTotal = p.grossProfit * inputs.activeRestaurants;
      const annualTotal = monthlyTotal * 12;

      return {
        name: s.name,
        markup: s.markup,
        revenue: p.sellingPrice,
        profit: p.grossProfit,
        margin: p.grossMargin,
        monthlyTotal,
        annualTotal,
      };
    });
  }, [inputs, effectiveUnitCost, restaurantCommissionRate, weightedMultiplier]);

  const revenueVsRestaurants = useMemo(() => {
    const data = [];
    for (let r = 1; r <= 50; r++) {
      data.push({
        restaurants: r,
        revenue: perRestaurant.sellingPrice * r,
        profit: perRestaurant.grossProfit * r,
      });
    }
    return data;
  }, [perRestaurant]);

  const marginVsMarkup = useMemo(() => {
    const production = inputs.coastersPerRestaurant * effectiveUnitCost;
    const data = [];
    for (let markup = 0; markup <= 100; markup += 5) {
      const p = calcPricing(production, inputs, {
        markupOverride: markup,
        restaurantCommissionRate,
        multiplier: weightedMultiplier,
      });
      data.push({ markup, margin: p.grossMargin, profit: p.grossProfit });
    }
    return data;
  }, [inputs, effectiveUnitCost, restaurantCommissionRate, weightedMultiplier]);

  const cumulativeProfit = useMemo(() => {
    const monthlyProfit =
      perRestaurant.grossProfit * inputs.activeRestaurants;
    const data = [];
    for (let m = 0; m <= 24; m++) {
      data.push({
        month: m,
        profit: monthlyProfit * m,
        revenue: perRestaurant.sellingPrice * inputs.activeRestaurants * m,
      });
    }
    return data;
  }, [perRestaurant, inputs]);

  const discountSensitivity = useMemo(() => {
    const production = inputs.coastersPerRestaurant * effectiveUnitCost;
    const restDbRate = (restaurantCommissionRate ?? 10) / 100;
    const baseResult = calcPricing(production, inputs, { restaurantCommissionRate, multiplier: weightedMultiplier });
    const basePrice = baseResult.sellingPrice;
    const data = [];
    for (let d = 0; d <= 40; d += 2) {
      const discountedPrice = basePrice * (1 - d / 100);
      const agencyComm =
        inputs.commissionType === "fixed"
          ? inputs.fixedCommission * inputs.coastersPerRestaurant
          : discountedPrice * (inputs.restaurantCommission / 100);
      const restComm = discountedPrice * restDbRate;
      const sellerComm = discountedPrice * (inputs.sellerCommission / 100);
      const tax = discountedPrice * (inputs.taxRate / 100);
      const profit = discountedPrice - production - agencyComm - restComm - sellerComm - tax;
      const margin =
        discountedPrice > 0 ? (profit / discountedPrice) * 100 : 0;
      data.push({
        discount: d,
        margin,
        profit,
        belowMin: margin < inputs.minMargin,
      });
    }
    return data;
  }, [inputs, effectiveUnitCost, restaurantCommissionRate, weightedMultiplier]);

  const resetInputs = useCallback(() => {
    setInputs(DEFAULT_INPUTS);
  }, []);

  return {
    inputs,
    updateInput,
    setInputs,
    resetInputs,
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
