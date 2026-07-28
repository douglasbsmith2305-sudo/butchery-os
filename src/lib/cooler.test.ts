import { describe, expect, it } from "vitest";
import {
  calculateDeliveryVariance,
  nextBatchCode,
  processingStatus,
  validateBatchProcessing,
  weightedAverageCost,
} from "./cooler";

describe("Cooler receiving and batches", () => {
  it("uses actual scale weight for cost and reports invoice variance", () => {
    expect(calculateDeliveryVariance(718, 720, 92)).toEqual({
      varianceKg: 2,
      variancePercent: 0.28,
      totalCost: 66240,
    });
  });

  it("generates the next daily batch number", () => {
    expect(nextBatchCode(["BF-20260728-001", "BF-20260728-002"], "2026-07-28")).toBe("BF-20260728-003");
  });

  it("requires every input kilogram to become output or recorded loss", () => {
    expect(validateBatchProcessing(100, [{ productId: "rump", actualKg: 98.5 }], 1.5).reconciled).toBe(true);
    expect(() => validateBatchProcessing(100, [{ productId: "rump", actualKg: 97 }], 1)).toThrow("unaccounted");
  });

  it("moves a batch through raw, partial, and processed states", () => {
    expect(processingStatus(720, 720)).toBe("Raw");
    expect(processingStatus(720, 200)).toBe("Part processed");
    expect(processingStatus(720, 0)).toBe("Processed");
  });

  it("updates weighted average inventory cost", () => {
    expect(weightedAverageCost(10, 80, 10, 100)).toBe(90);
  });
});
