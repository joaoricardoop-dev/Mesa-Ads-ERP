import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  planScheduledInvoices,
  sumPhaseRevenue,
  type PhaseForScheduling,
  type ItemForScheduling,
} from "./scheduleInvoices";

describe("addDaysIso", () => {
  it("adds days respecting UTC", () => {
    expect(addDaysIso("2026-05-01", 15)).toBe("2026-05-16");
    expect(addDaysIso("2026-05-20", 15)).toBe("2026-06-04");
  });
});

describe("sumPhaseRevenue", () => {
  it("uses totalPrice when set, falls back to quantity*unitPrice", () => {
    const items: ItemForScheduling[] = [
      { campaignPhaseId: 1, quantity: 10, unitPrice: "5.00", totalPrice: null },
      { campaignPhaseId: 1, quantity: 1, unitPrice: "0", totalPrice: "100.00" },
      { campaignPhaseId: 2, quantity: 3, unitPrice: "7.50", totalPrice: null },
    ];
    const result = sumPhaseRevenue(items);
    expect(result[1]).toBeCloseTo(150.0);
    expect(result[2]).toBeCloseTo(22.5);
  });
});

describe("planScheduledInvoices", () => {
  const phases: PhaseForScheduling[] = [
    { id: 10, sequence: 1, label: "Ciclo 1", periodStart: "2026-05-01" },
    { id: 11, sequence: 2, label: "Ciclo 2", periodStart: "2026-05-29" },
    { id: 12, sequence: 3, label: "Ciclo 3", periodStart: "2026-06-26" },
  ];

  it("creates one prevista invoice per phase using item revenue", () => {
    const items: ItemForScheduling[] = [
      { campaignPhaseId: 10, quantity: 1, unitPrice: "0", totalPrice: "1000.00" },
      { campaignPhaseId: 11, quantity: 2, unitPrice: "250.00", totalPrice: null },
      { campaignPhaseId: 12, quantity: 1, unitPrice: "0", totalPrice: "750.00" },
    ];
    const rows = planScheduledInvoices({
      campaignId: 99,
      clientId: 5,
      phases,
      items,
      phasesWithExistingInvoice: new Set(),
      dueOffsetDays: 15,
    });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      campaignId: 99,
      campaignPhaseId: 10,
      clientId: 5,
      invoiceNumber: "PREV-99-1",
      amount: "1000.00",
      status: "prevista",
      billingType: "bruto",
      issueDate: "2026-05-01",
      dueDate: "2026-05-16",
    });
    expect(rows[1].amount).toBe("500.00");
    expect(rows[2].amount).toBe("750.00");
  });

  it("is idempotent: skips phases that already have an active invoice", () => {
    const rows = planScheduledInvoices({
      campaignId: 1,
      clientId: 1,
      phases,
      items: [],
      phasesWithExistingInvoice: new Set([10, 12]),
      dueOffsetDays: 15,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].campaignPhaseId).toBe(11);
  });

  it("creates a prevista with amount 0 when phase has no items (manual createPhase flow)", () => {
    const rows = planScheduledInvoices({
      campaignId: 7,
      clientId: 2,
      phases: [phases[0]],
      items: [],
      phasesWithExistingInvoice: new Set(),
      dueOffsetDays: 15,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe("0.00");
    expect(rows[0].invoiceNumber).toBe("PREV-7-1");
  });

  it("covers the won-quotation flow: schedules every phase generated from quotation_items", () => {
    const items: ItemForScheduling[] = [
      { campaignPhaseId: 10, quantity: 1, unitPrice: "0", totalPrice: "300.00" },
      { campaignPhaseId: 11, quantity: 1, unitPrice: "0", totalPrice: "300.00" },
      { campaignPhaseId: 12, quantity: 1, unitPrice: "0", totalPrice: "300.00" },
    ];
    const rows = planScheduledInvoices({
      campaignId: 42,
      clientId: 3,
      phases,
      items,
      phasesWithExistingInvoice: new Set(),
      dueOffsetDays: 30,
    });
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.campaignPhaseId)).toEqual([10, 11, 12]);
    expect(rows.every((r) => r.amount === "300.00")).toBe(true);
    expect(rows[0].dueDate).toBe("2026-05-31");
  });
});
