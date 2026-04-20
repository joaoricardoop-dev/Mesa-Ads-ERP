import { describe, expect, it } from "vitest";
import {
  computeShareAvailability,
  parseExcludedCategories,
  hasCategoryConflict,
  periodsOverlap,
  type ProductLocationRow,
  type OccupationRow,
} from "./utils/marketplaceAvailability";

const locations: ProductLocationRow[] = [
  { productId: 10, restaurantId: 1, maxShares: 2, cycleWeeks: 4 },
  { productId: 10, restaurantId: 2, maxShares: 1, cycleWeeks: 4 },
  { productId: 20, restaurantId: 1, maxShares: 3, cycleWeeks: 8 },
];

describe("periodsOverlap", () => {
  it("returns true when ranges intersect", () => {
    expect(periodsOverlap("2026-05-01", "2026-05-31", "2026-05-15", "2026-06-15")).toBe(true);
  });
  it("returns false when ranges are disjoint", () => {
    expect(periodsOverlap("2026-05-01", "2026-05-31", "2026-06-01", "2026-06-30")).toBe(false);
  });
  it("returns true when no window is provided", () => {
    expect(periodsOverlap("2026-05-01", "2026-05-31")).toBe(true);
  });
});

describe("computeShareAvailability", () => {
  it("returns full availability when there is no occupation", () => {
    const result = computeShareAvailability(locations, [], "2026-05-01", "2026-05-31");
    expect(result.get("10:1")?.availableShares).toBe(2);
    expect(result.get("10:1")?.occupiedShares).toBe(0);
    expect(result.get("20:1")?.availableShares).toBe(3);
  });

  it("reduces availability when a slot is partially occupied", () => {
    const occupations: OccupationRow[] = [
      { productId: 10, restaurantId: 1, phaseStart: "2026-05-10", phaseEnd: "2026-05-25" },
    ];
    const result = computeShareAvailability(locations, occupations, "2026-05-01", "2026-05-31");
    const cell = result.get("10:1");
    expect(cell?.maxShares).toBe(2);
    expect(cell?.occupiedShares).toBe(1);
    expect(cell?.availableShares).toBe(1);
    // Outras combinações permanecem livres.
    expect(result.get("10:2")?.availableShares).toBe(1);
    expect(result.get("20:1")?.availableShares).toBe(3);
  });

  it("ignores occupations outside the requested window", () => {
    const occupations: OccupationRow[] = [
      { productId: 10, restaurantId: 1, phaseStart: "2026-04-01", phaseEnd: "2026-04-30" },
    ];
    const result = computeShareAvailability(locations, occupations, "2026-05-01", "2026-05-31");
    expect(result.get("10:1")?.availableShares).toBe(2);
  });

  it("clamps to zero when fully booked", () => {
    const occupations: OccupationRow[] = [
      { productId: 10, restaurantId: 2, phaseStart: "2026-05-01", phaseEnd: "2026-05-31" },
      { productId: 10, restaurantId: 2, phaseStart: "2026-05-15", phaseEnd: "2026-06-15" },
    ];
    const result = computeShareAvailability(locations, occupations, "2026-05-01", "2026-05-31");
    const cell = result.get("10:2");
    expect(cell?.occupiedShares).toBe(2);
    expect(cell?.availableShares).toBe(0);
  });

  it("ignores phases marked as cancelada", () => {
    const occupations: OccupationRow[] = [
      {
        productId: 10,
        restaurantId: 1,
        phaseStart: "2026-05-10",
        phaseEnd: "2026-05-25",
        phaseStatus: "cancelada",
      },
    ];
    const result = computeShareAvailability(locations, occupations, "2026-05-01", "2026-05-31");
    expect(result.get("10:1")?.occupiedShares).toBe(0);
    expect(result.get("10:1")?.availableShares).toBe(2);
  });

  it("ignores phases whose campaign is archived/inativa", () => {
    const occupations: OccupationRow[] = [
      {
        productId: 10,
        restaurantId: 1,
        phaseStart: "2026-05-10",
        phaseEnd: "2026-05-25",
        phaseStatus: "ativa",
        campaignStatus: "archived",
      },
      {
        productId: 10,
        restaurantId: 2,
        phaseStart: "2026-05-10",
        phaseEnd: "2026-05-25",
        phaseStatus: "ativa",
        campaignStatus: "inativa",
      },
    ];
    const result = computeShareAvailability(locations, occupations, "2026-05-01", "2026-05-31");
    expect(result.get("10:1")?.availableShares).toBe(2);
    expect(result.get("10:2")?.availableShares).toBe(1);
  });

  it("counts phases with active/operacional statuses as occupying", () => {
    const occupations: OccupationRow[] = [
      {
        productId: 10,
        restaurantId: 1,
        phaseStart: "2026-05-10",
        phaseEnd: "2026-05-25",
        phaseStatus: "ativa",
        campaignStatus: "active",
      },
      {
        productId: 20,
        restaurantId: 1,
        phaseStart: "2026-05-10",
        phaseEnd: "2026-05-25",
        phaseStatus: "planejada",
        campaignStatus: "draft",
      },
    ];
    const result = computeShareAvailability(locations, occupations, "2026-05-01", "2026-05-31");
    expect(result.get("10:1")?.occupiedShares).toBe(1);
    expect(result.get("20:1")?.occupiedShares).toBe(1);
  });
});

describe("parseExcludedCategories", () => {
  it("returns empty list for null/empty", () => {
    expect(parseExcludedCategories(null)).toEqual([]);
    expect(parseExcludedCategories("")).toEqual([]);
    expect(parseExcludedCategories("   ")).toEqual([]);
  });
  it("parses JSON array format", () => {
    expect(parseExcludedCategories('["bebidas","cigarros"]')).toEqual(["bebidas", "cigarros"]);
  });
  it("parses pipe-separated legacy format", () => {
    expect(parseExcludedCategories("bebidas||cigarros")).toEqual(["bebidas", "cigarros"]);
  });
  it("parses CSV legacy format", () => {
    expect(parseExcludedCategories("bebidas, cigarros")).toEqual(["bebidas", "cigarros"]);
  });
});

describe("hasCategoryConflict", () => {
  it("returns false when no category is provided", () => {
    expect(hasCategoryConflict(["bebidas"], undefined)).toBe(false);
    expect(hasCategoryConflict(["bebidas"], "")).toBe(false);
  });
  it("flags a conflict (case-insensitive)", () => {
    expect(hasCategoryConflict(["Bebidas", "Cigarros"], "bebidas")).toBe(true);
  });
  it("returns false when category is allowed", () => {
    expect(hasCategoryConflict(["bebidas"], "alimentos")).toBe(false);
  });
});
