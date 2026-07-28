import { describe, expect, it } from "vitest";
import {
  calculateBatchProfitability,
  calculateManagementSummary,
  calculateSupplierPerformance,
  managementBatches,
} from "./management";

describe("management reporting", () => {
  it("excludes refunded sales from revenue and margin", () => {
    const baseSale = {
      id: "sale", number: "SAL-1", receiptNumber: "RCP-1", customer: "Walk-in", cashier: "Cashier",
      items: [], payments: [], revenue: 100, costOfGoods: 60, grossProfit: 40, grossMargin: 40,
      totalKg: 1, totalUnits: 0, createdAt: "2026-07-28T08:00:00.000Z",
    };
    const summary = calculateManagementSummary({
      inventory: [], waste: [], stockCounts: [], tillSessions: [], tickets: [], range: "today",
      sales: [{ ...baseSale, status: "Completed" }, { ...baseSale, id: "refund", status: "Refunded" }],
    });
    expect(summary.revenue).toBe(100);
    expect(summary.grossProfit).toBe(40);
    expect(summary.grossMargin).toBe(40);
  });

  it("uses realized batch cost when calculating gross profit", () => {
    const result = calculateBatchProfitability(managementBatches[0]);
    expect(result.purchaseCost).toBe(66240);
    expect(result.realizedCost).toBe(56340.8);
    expect(result.grossProfit).toBe(38529.2);
    expect(result.saleableYield).toBeGreaterThan(70);
  });

  it("ranks suppliers by economic yield rather than purchase price alone", () => {
    const suppliers = calculateSupplierPerformance();
    expect(suppliers[0].economicIndex).toBeGreaterThanOrEqual(suppliers[1].economicIndex);
    expect(suppliers.some((supplier) => supplier.supplier === "Karoo Prime Meats")).toBe(true);
  });
});
