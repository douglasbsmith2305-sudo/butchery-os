import { describe, expect, it } from "vitest";
import { buildSectionedCsv } from "./reports";

describe("sectioned CSV reports", () => {
  it("creates readable sections and safely escapes spreadsheet values", () => {
    const csv = buildSectionedCsv("Butchery report", "2026-08-03 10:00", [
      { title: "Inventory", headers: ["Product", "Notes"], rows: [["Rump", "Fresh, chilled"], ["Steak", 'Label says "special"']] },
    ]);

    expect(csv).toContain("Inventory\r\nProduct,Notes");
    expect(csv).toContain('Rump,"Fresh, chilled"');
    expect(csv).toContain('Steak,"Label says ""special"""');
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });
});
