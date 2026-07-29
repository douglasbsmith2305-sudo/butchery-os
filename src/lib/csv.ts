export type ImportDataset = "weighted-products" | "retail-products" | "suppliers";
export type ImportMode = "add-only" | "upsert";

export type CsvRow = {
  rowNumber: number;
  values: Record<string, string>;
  errors: string[];
  warnings: string[];
};

export type CsvPreview = {
  headers: string[];
  rows: CsvRow[];
  errors: string[];
};

export const csvTemplates: Record<ImportDataset, string> = {
  "weighted-products": [
    "product,category,scale_plu,cost_per_kg,selling_price_per_kg,reorder_level_kg,opening_stock_kg,active",
    "Rump,Beef cuts,1001,92.00,169.99,15,0,true",
  ].join("\n"),
  "retail-products": [
    "sku,name,barcode,category,cost_per_unit,selling_price_per_unit,reorder_level_units,opening_stock_units,active",
    "BEV-COKE-330,Coca-Cola Original 330 ml,5449000000996,Cold drinks,10.20,15.99,12,48,true",
  ].join("\n"),
  suppliers: [
    "supplier_code,name,contact_person,phone,email,payment_terms_days,active",
    "KPM,Karoo Prime Meats,Anika Smit,021 555 0142,orders@example.co.za,30,true",
  ].join("\n"),
};

const requiredHeaders: Record<ImportDataset, string[]> = {
  "weighted-products": ["product", "scale_plu", "cost_per_kg", "selling_price_per_kg"],
  "retail-products": ["sku", "name", "barcode", "cost_per_unit", "selling_price_per_unit"],
  suppliers: ["supplier_code", "name"],
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replaceAll(" ", "_").replaceAll("-", "_");
}

export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === "\"") {
      if (quoted && source[index + 1] === "\"") {
        field += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) records.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV has an unclosed quoted field");
  row.push(field.trim());
  if (row.some(Boolean)) records.push(row);
  return records;
}

function numeric(value: string, label: string, errors: string[], options: { required?: boolean; integer?: boolean; minimum?: number } = {}) {
  if (!value && !options.required) return;
  const parsed = Number(value);
  if (!value || !Number.isFinite(parsed)) {
    errors.push(`${label} must be a number`);
  } else if (options.integer && !Number.isInteger(parsed)) {
    errors.push(`${label} must be a whole number`);
  } else if (options.minimum !== undefined && parsed < options.minimum) {
    errors.push(`${label} cannot be below ${options.minimum}`);
  }
}

function validateBoolean(value: string, errors: string[]) {
  if (value && !["true", "false", "yes", "no", "1", "0"].includes(value.toLowerCase())) {
    errors.push("Active must be true/false, yes/no or 1/0");
  }
}

export function booleanFromCsv(value: string, fallback = true) {
  if (!value) return fallback;
  return ["true", "yes", "1"].includes(value.toLowerCase());
}

export function previewCsv(dataset: ImportDataset, text: string): CsvPreview {
  let records: string[][];
  try {
    records = parseCsv(text);
  } catch (error) {
    return { headers: [], rows: [], errors: [error instanceof Error ? error.message : "CSV could not be read"] };
  }
  if (records.length === 0) return { headers: [], rows: [], errors: ["The CSV file is empty"] };

  const headers = records[0].map(normalizeHeader);
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
  const errors = requiredHeaders[dataset]
    .filter((header) => !headers.includes(header))
    .map((header) => `Missing required column: ${header}`);
  if (duplicateHeaders.length) errors.push(`Duplicate columns: ${[...new Set(duplicateHeaders)].join(", ")}`);

  const seenKeys = new Map<string, number>();
  const rows = records.slice(1).map((record, index): CsvRow => {
    const values = Object.fromEntries(headers.map((header, column) => [header, record[column]?.trim() ?? ""]));
    const rowErrors: string[] = [];
    const warnings: string[] = [];
    if (record.length > headers.length) rowErrors.push("Row has more values than the header");

    let identity = "";
    if (dataset === "weighted-products") {
      if (!values.product) rowErrors.push("Product is required");
      if (!/^\d{1,5}$/.test(values.scale_plu ?? "")) rowErrors.push("Scale PLU must contain 1 to 5 digits");
      numeric(values.cost_per_kg, "Cost per kg", rowErrors, { required: true, minimum: 0 });
      numeric(values.selling_price_per_kg, "Selling price per kg", rowErrors, { required: true, minimum: 0 });
      numeric(values.reorder_level_kg, "Reorder level kg", rowErrors, { minimum: 0 });
      numeric(values.opening_stock_kg, "Opening stock kg", rowErrors, { minimum: 0 });
      validateBoolean(values.active, rowErrors);
      if (Number(values.selling_price_per_kg) < Number(values.cost_per_kg)) warnings.push("Selling price is below cost");
      identity = (values.scale_plu || values.product).toLowerCase();
    } else if (dataset === "retail-products") {
      if (!values.sku) rowErrors.push("SKU is required");
      if (!values.name) rowErrors.push("Name is required");
      if (!/^\d{8,14}$/.test(values.barcode ?? "")) rowErrors.push("Barcode must contain 8 to 14 digits");
      numeric(values.cost_per_unit, "Cost per unit", rowErrors, { required: true, minimum: 0 });
      numeric(values.selling_price_per_unit, "Selling price per unit", rowErrors, { required: true, minimum: 0 });
      numeric(values.reorder_level_units, "Reorder level units", rowErrors, { integer: true, minimum: 0 });
      numeric(values.opening_stock_units, "Opening stock units", rowErrors, { integer: true, minimum: 0 });
      validateBoolean(values.active, rowErrors);
      if (Number(values.selling_price_per_unit) < Number(values.cost_per_unit)) warnings.push("Selling price is below cost");
      identity = values.sku.toLowerCase();
    } else {
      if (!values.supplier_code) rowErrors.push("Supplier code is required");
      if (!values.name) rowErrors.push("Name is required");
      if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) rowErrors.push("Email address is invalid");
      numeric(values.payment_terms_days, "Payment terms days", rowErrors, { integer: true, minimum: 0 });
      validateBoolean(values.active, rowErrors);
      identity = values.supplier_code.toLowerCase();
    }

    const previousRow = seenKeys.get(identity);
    if (identity && previousRow) rowErrors.push(`Duplicate record (also on row ${previousRow})`);
    if (identity) seenKeys.set(identity, index + 2);
    return { rowNumber: index + 2, values, errors: rowErrors, warnings };
  });

  if (!rows.length) errors.push("The CSV contains headers but no data rows");
  return { headers, rows, errors };
}

function escapeCsv(value: unknown) {
  const stringValue = String(value ?? "");
  return /[",\r\n]/.test(stringValue) ? `"${stringValue.replaceAll("\"", "\"\"")}"` : stringValue;
}

export function createCsv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
}
