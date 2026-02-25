import { useState, useMemo, useEffect, useCallback } from "react";

export interface RestaurantForAllocation {
  id: number;
  name: string;
  neighborhood: string | null;
  ratingScore: string | null;
  ratingMultiplier: string | null;
  commissionPercent: string;
  status: string;
}

export interface AllocationEntry {
  restaurantId: number;
  coasters: number;
}

const STORAGE_KEY = "mesa-ads-restaurant-allocations";

function loadAllocations(): AllocationEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

function saveAllocations(allocations: AllocationEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allocations));
  } catch {}
}

function safeParseFloat(val: string | null, fallback: number): number {
  if (!val) return fallback;
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}

export function useRestaurantAllocation(
  restaurants: RestaurantForAllocation[],
  totalCoasters: number
) {
  const [allocations, setAllocations] = useState<AllocationEntry[]>(loadAllocations);

  useEffect(() => {
    saveAllocations(allocations);
  }, [allocations]);

  useEffect(() => {
    if (restaurants.length === 0) return;
    setAllocations(prev => {
      const activeIds = new Set(restaurants.filter(r => r.status === "active").map(r => r.id));
      const cleaned = prev.filter(a => activeIds.has(a.restaurantId));
      if (cleaned.length !== prev.length) return cleaned;
      return prev;
    });
  }, [restaurants]);

  const selectedIds = useMemo(
    () => allocations.map(a => a.restaurantId),
    [allocations]
  );

  const addRestaurant = useCallback((id: number) => {
    setAllocations(prev => {
      if (prev.find(a => a.restaurantId === id)) return prev;
      return [...prev, { restaurantId: id, coasters: 0 }];
    });
  }, []);

  const removeRestaurant = useCallback((id: number) => {
    setAllocations(prev => prev.filter(a => a.restaurantId !== id));
  }, []);

  const updateCoasters = useCallback((id: number, coasters: number) => {
    setAllocations(prev =>
      prev.map(a =>
        a.restaurantId === id
          ? { ...a, coasters: Math.max(0, coasters) }
          : a
      )
    );
  }, []);

  const allocatedTotal = useMemo(
    () => allocations.reduce((sum, a) => sum + a.coasters, 0),
    [allocations]
  );

  const remaining = totalCoasters - allocatedTotal;
  const isValid = allocations.length > 0 && allocatedTotal === totalCoasters && totalCoasters > 0;
  const hasAllocations = allocations.length > 0;

  const weightedMultiplier = useMemo(() => {
    if (allocatedTotal === 0 || allocations.length === 0) return 1.0;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const alloc of allocations) {
      if (alloc.coasters <= 0) continue;
      const restaurant = restaurants.find(r => r.id === alloc.restaurantId);
      if (!restaurant) continue;

      const multiplier = safeParseFloat(restaurant.ratingMultiplier, 1.0);
      weightedSum += multiplier * alloc.coasters;
      totalWeight += alloc.coasters;
    }

    return totalWeight > 0
      ? Math.round((weightedSum / totalWeight) * 100) / 100
      : 1.0;
  }, [allocations, restaurants, allocatedTotal]);

  const weightedScore = useMemo(() => {
    if (allocatedTotal === 0 || allocations.length === 0) return 0;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const alloc of allocations) {
      if (alloc.coasters <= 0) continue;
      const restaurant = restaurants.find(r => r.id === alloc.restaurantId);
      if (!restaurant) continue;

      const score = safeParseFloat(restaurant.ratingScore, 0);
      if (score <= 0) continue;
      weightedSum += score * alloc.coasters;
      totalWeight += alloc.coasters;
    }

    return totalWeight > 0
      ? Math.round((weightedSum / totalWeight) * 100) / 100
      : 0;
  }, [allocations, restaurants, allocatedTotal]);

  const weightedCommission = useMemo(() => {
    if (allocatedTotal === 0 || allocations.length === 0) return 20;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const alloc of allocations) {
      if (alloc.coasters <= 0) continue;
      const restaurant = restaurants.find(r => r.id === alloc.restaurantId);
      if (!restaurant) continue;

      const commission = safeParseFloat(restaurant.commissionPercent, 20);
      weightedSum += commission * alloc.coasters;
      totalWeight += alloc.coasters;
    }

    return totalWeight > 0
      ? Math.round((weightedSum / totalWeight) * 100) / 100
      : 20;
  }, [allocations, restaurants, allocatedTotal]);

  const distributeEvenly = useCallback(() => {
    if (allocations.length === 0 || totalCoasters <= 0) return;
    const perRestaurant = Math.floor(totalCoasters / allocations.length);
    const remainder = totalCoasters - perRestaurant * allocations.length;
    setAllocations(prev =>
      prev.map((a, i) => ({
        ...a,
        coasters: perRestaurant + (i < remainder ? 1 : 0),
      }))
    );
  }, [allocations.length, totalCoasters]);

  return {
    allocations,
    selectedIds,
    addRestaurant,
    removeRestaurant,
    updateCoasters,
    allocatedTotal,
    remaining,
    isValid,
    hasAllocations,
    weightedMultiplier,
    weightedScore,
    weightedCommission,
    distributeEvenly,
  };
}
