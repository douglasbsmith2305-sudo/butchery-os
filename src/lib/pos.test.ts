import { describe, expect, it } from "vitest";
import {
  buildGtin13,
  calculateScaleLine,
  isValidGtin,
  parseBarcode,
  paymentDifference,
} from "./pos";

describe("POS barcode handling", () => {
  it("validates a standard Coca-Cola EAN-13 barcode", () => {
    expect(isValidGtin("5449000000996")).toBe(true);
    expect(parseBarcode("5449000000996")).toEqual({ kind: "retail", raw: "5449000000996" });
  });

  it("rejects a mistyped barcode checksum", () => {
    expect(isValidGtin("5449000000995")).toBe(false);
    expect(() => parseBarcode("5449000000995")).toThrow("checksum");
  });

  it("parses the configured Teraoka mask independently of retail GTIN validation", () => {
    const parsed = parseBarcode("2044442153356");
    expect(parsed).toMatchObject({
      kind: "scale",
      plu: "4444",
      amountType: "price",
      embeddedAmount: 153.35,
    });
  });

  it("derives the scale weight from embedded price and price/kg", () => {
    const parsed = parseBarcode("2044442153356");
    if (parsed.kind !== "scale") throw new Error("Expected a scale barcode");
    expect(calculateScaleLine(parsed, 250)).toEqual({ weightKg: 0.613, lineTotal: 153.35 });
  });

  it("parses a weight-embedded mask", () => {
    const barcode = buildGtin13("210000100613");
    const parsed = parseBarcode(barcode);
    expect(parsed).toMatchObject({
      kind: "scale",
      plu: "00001",
      amountType: "weight",
      embeddedAmount: 0.613,
    });
    if (parsed.kind !== "scale") throw new Error("Expected a scale barcode");
    expect(calculateScaleLine(parsed, 169.99)).toEqual({ weightKg: 0.613, lineTotal: 104.2 });
  });
});

describe("POS payments", () => {
  it("accepts an exact split payment", () => {
    expect(paymentDifference(250, [{ amount: 100 }, { amount: 150 }])).toBe(0);
  });

  it("returns positive cash change and negative short payment", () => {
    expect(paymentDifference(100, [{ amount: 120 }])).toBe(20);
    expect(paymentDifference(100, [{ amount: 80 }])).toBe(-20);
  });
});
