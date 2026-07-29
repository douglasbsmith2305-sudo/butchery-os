import { describe, expect, it } from "vitest";
import { booleanFromCsv, createCsv, parseCsv, previewCsv } from "./csv";

describe("CSV imports", () => {
  it("parses quoted commas and escaped quotes", () => {
    expect(parseCsv('name,notes\r\n"Prime, Beef","Called ""today"""')).toEqual([
      ["name", "notes"],
      ["Prime, Beef", 'Called "today"'],
    ]);
  });

  it("reports missing headers and invalid product values", () => {
    const result = previewCsv("weighted-products", "product,scale_plu,cost_per_kg\nRump,ABC,-1");
    expect(result.errors).toContain("Missing required column: selling_price_per_kg");
    expect(result.rows[0].errors).toContain("Scale PLU must contain 1 to 5 digits");
    expect(result.rows[0].errors).toContain("Cost per kg cannot be below 0");
  });

  it("detects duplicates inside an import", () => {
    const csv = "supplier_code,name\nKPM,Karoo Prime\nKPM,Duplicate";
    expect(previewCsv("suppliers", csv).rows[1].errors[0]).toContain("Duplicate record");
  });

  it("normalizes boolean values and exports safe CSV", () => {
    expect(booleanFromCsv("yes")).toBe(true);
    expect(booleanFromCsv("0")).toBe(false);
    expect(createCsv(["name", "note"], [["Rump", "Prime, aged"]])).toBe('name,note\nRump,"Prime, aged"');
  });
});
