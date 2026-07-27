import { describe, expect, it } from "vitest";
import {
  calculateProjectedYields, cancelReservation, completeSale, grossMargin,
  reconcileProcessing, reserveStock, reverseSale, validateYieldProfile, weightedAverageCost,
} from "./inventory";

const lines = [{ productId: "rump", name: "Rump", percent: 40 }, { productId: "bone", name: "Bone", percent: 60 }];

describe("critical stock logic", () => {
  it("calculates theoretical block-test yields", () => {
    expect(calculateProjectedYields(720, lines).map((x) => x.expectedKg)).toEqual([288, 432]);
  });
  it("requires block-test profiles to total 100%", () => {
    expect(() => validateYieldProfile([{ ...lines[0], percent: 99 }])).toThrow(/100%/);
  });
  it("processing detects missing kilograms", () => {
    expect(reconcileProcessing(720, [{ productId: "rump", actualKg: 700 }], 18).differenceKg).toBe(2);
  });
  it("processing reconciles recorded loss", () => {
    expect(reconcileProcessing(720, [{ productId: "rump", actualKg: 700 }], 20).reconciled).toBe(true);
  });
  it("cannot reserve more than available and never goes negative", () => {
    expect(() => reserveStock(5, 0, 6)).toThrow(/Insufficient/);
    expect(reserveStock(5, 0, 3)).toEqual({ availableKg: 2, reservedKg: 3 });
  });
  it("cancelled tickets return reservations", () => {
    expect(cancelReservation(2, 3, 3)).toEqual({ availableKg: 5, reservedKg: 0 });
  });
  it("POS sale moves reserved stock to sold", () => {
    expect(completeSale(3, 10, 3)).toEqual({ reservedKg: 0, soldKg: 13 });
  });
  it("refund reverses sold stock", () => {
    expect(reverseSale(2, 13, 3)).toEqual({ availableKg: 5, soldKg: 10 });
  });
  it("calculates weighted average cost", () => {
    expect(weightedAverageCost(100, 90, 50, 96)).toBe(92);
  });
  it("calculates financial gross margin", () => {
    expect(grossMargin(150, 100)).toBe(33.33);
  });
});
