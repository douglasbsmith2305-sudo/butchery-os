import type {
  ButcherTicket,
  InventoryItem,
  LedgerMovement,
  SaleRecord,
  StockCountRecord,
  TillSession,
  WasteRecord,
} from "../components/operations-store";
import { profile } from "./demo-data";

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const round3 = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;

export type ManagementRange = "today" | "7d" | "30d" | "all";

export type ManagementBatch = {
  code: string;
  supplier: string;
  date: string;
  receivedKg: number;
  invoiceKg: number;
  costPerKg: number;
  unitCount: number;
  processedKg: number;
  remainingRawKg: number;
  actualYields: Record<string, number>;
  baseRevenue: number;
  soldEquivalentKg: number;
  stockRemainingKg: number;
};

const yields = (values: number[]) => Object.fromEntries(profile.map(([name], index) => [name, values[index] ?? 0]));

export const managementBatches: ManagementBatch[] = [
  {
    code: "BF-20260727-001", supplier: "Karoo Prime Meats", date: "2026-07-27",
    receivedKg: 720, invoiceKg: 718, costPerKg: 92, unitCount: 5, processedKg: 720,
    remainingRawKg: 0, actualYields: yields([48.2, 63.1, 30.1, 11.4, 121, 38.8, 36.1, 57.4, 130, 36, 105, 38.7]),
    baseRevenue: 94870, soldEquivalentKg: 612.4, stockRemainingKg: 105.4,
  },
  {
    code: "BF-20260726-003", supplier: "Karoo Prime Meats", date: "2026-07-26",
    receivedKg: 684.5, invoiceKg: 686, costPerKg: 91.5, unitCount: 5, processedKg: 500,
    remainingRawKg: 184.5, actualYields: yields([36.5, 42.1, 19.8, 7.2, 86.4, 27.3, 25.1, 39.2, 91.8, 24.6, 73.2, 25.4]),
    baseRevenue: 48320, soldEquivalentKg: 338.2, stockRemainingKg: 345.1,
  },
  {
    code: "BF-20260726-002", supplier: "Highveld Beef Co.", date: "2026-07-26",
    receivedKg: 712.2, invoiceKg: 710.4, costPerKg: 93.2, unitCount: 5, processedKg: 0,
    remainingRawKg: 712.2, actualYields: {}, baseRevenue: 0, soldEquivalentKg: 0, stockRemainingKg: 712.2,
  },
  {
    code: "BF-20260725-001", supplier: "Lowveld Livestock", date: "2026-07-25",
    receivedKg: 648.9, invoiceKg: 650, costPerKg: 89.8, unitCount: 5, processedKg: 648.9,
    remainingRawKg: 0, actualYields: yields([42.9, 51.1, 24.7, 9.3, 105.9, 33.8, 31.7, 49.4, 113.8, 31.2, 98.9, 53.1]),
    baseRevenue: 78640, soldEquivalentKg: 536.1, stockRemainingKg: 109.7,
  },
];

function rangeStart(range: ManagementRange, anchor = new Date("2026-07-28T12:00:00+02:00")) {
  if (range === "all") return new Date(0);
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  if (range === "7d") start.setDate(start.getDate() - 6);
  if (range === "30d") start.setDate(start.getDate() - 29);
  return start;
}

export function isInRange(value: string, range: ManagementRange) {
  return new Date(value) >= rangeStart(range);
}

export function completedSales(sales: SaleRecord[], range: ManagementRange = "all") {
  return sales.filter((sale) => sale.status === "Completed" && isInRange(sale.createdAt, range));
}

export function calculateManagementSummary(input: {
  inventory: InventoryItem[];
  sales: SaleRecord[];
  waste: WasteRecord[];
  stockCounts: StockCountRecord[];
  tillSessions: TillSession[];
  tickets: ButcherTicket[];
  range: ManagementRange;
}) {
  const sales = completedSales(input.sales, input.range);
  const revenue = round2(sales.reduce((sum, sale) => sum + sale.revenue, 0));
  const grossProfit = round2(sales.reduce((sum, sale) => sum + sale.grossProfit, 0));
  const kgSold = round3(sales.reduce((sum, sale) => sum + sale.totalKg, 0));
  const meatRevenue = round2(sales.flatMap((sale) => sale.items).reduce((sum, line) => sum + (line.weightKg ? line.lineTotal : 0), 0));
  const batches = managementBatches.filter((batch) => isInRange(batch.date, input.range));
  const purchaseKg = round3(batches.reduce((sum, batch) => sum + batch.receivedKg, 0));
  const purchases = round2(batches.reduce((sum, batch) => sum + batch.receivedKg * batch.costPerKg, 0));
  const wasteKg = round3(input.waste.filter((record) => isInRange(record.createdAt, input.range)).reduce((sum, record) => sum + record.weightKg, 0));
  const stockVarianceKg = round3(input.stockCounts.filter((record) => isInRange(record.createdAt, input.range)).reduce((sum, record) => sum + record.varianceKg, 0));
  const cashVariance = round2(input.tillSessions.filter((session) => session.closedAt && isInRange(session.closedAt, input.range)).reduce((sum, session) => sum + (session.variance ?? 0), 0));
  return {
    revenue,
    grossProfit,
    grossMargin: revenue ? round2((grossProfit / revenue) * 100) : 0,
    kgSold,
    averageSellingPriceKg: kgSold ? round2(meatRevenue / kgSold) : 0,
    purchases,
    purchaseKg,
    wasteKg,
    stockVarianceKg,
    cashVariance,
    openTickets: input.tickets.filter((ticket) => ticket.status === "Open" || ticket.status === "Awaiting payment").length,
    inventoryValue: round2(input.inventory.reduce((sum, item) => sum + item.physical * item.cost, 0)),
  };
}

export type ProductProfitabilityRow = {
  productId: string;
  product: string;
  openingKg: number;
  producedKg: number;
  soldKg: number;
  revenue: number;
  averageSellingPriceKg: number;
  averageCostKg: number;
  grossProfit: number;
  grossMargin: number;
  closingKg: number;
  varianceKg: number;
};

export function calculateProductProfitability(input: {
  inventory: InventoryItem[];
  sales: SaleRecord[];
  waste: WasteRecord[];
  stockCounts: StockCountRecord[];
  range: ManagementRange;
}): ProductProfitabilityRow[] {
  const sales = completedSales(input.sales, input.range);
  const production = managementBatches
    .filter((batch) => isInRange(batch.date, input.range))
    .reduce<Record<string, number>>((totals, batch) => {
      for (const [name, quantity] of Object.entries(batch.actualYields)) totals[name] = (totals[name] ?? 0) + quantity;
      return totals;
    }, {});
  return input.inventory.map((item) => {
    const lines = sales.flatMap((sale) => sale.items).filter((line) => line.productId === item.id && line.weightKg);
    const soldKg = round3(lines.reduce((sum, line) => sum + (line.weightKg ?? 0), 0));
    const revenue = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));
    const cogs = round2(lines.reduce((sum, line) => sum + line.costOfGoods, 0));
    const producedKg = round3(production[item.product] ?? 0);
    const wasteKg = round3(input.waste.filter((record) => record.productId === item.id && isInRange(record.createdAt, input.range)).reduce((sum, record) => sum + record.weightKg, 0));
    const varianceKg = round3(input.stockCounts.filter((record) => isInRange(record.createdAt, input.range)).reduce((sum, record) => sum + record.varianceKg / Math.max(input.inventory.length, 1), 0));
    const openingKg = round3(Math.max(0, item.physical + soldKg + wasteKg - producedKg - varianceKg));
    const grossProfit = round2(revenue - cogs);
    return {
      productId: item.id,
      product: item.product,
      openingKg,
      producedKg,
      soldKg,
      revenue,
      averageSellingPriceKg: soldKg ? round2(revenue / soldKg) : item.price,
      averageCostKg: item.cost,
      grossProfit,
      grossMargin: revenue ? round2((grossProfit / revenue) * 100) : 0,
      closingKg: item.physical,
      varianceKg,
    };
  });
}

export function calculateBatchProfitability(batch: ManagementBatch) {
  const purchaseCost = round2(batch.receivedKg * batch.costPerKg);
  const realizedCost = round2(batch.soldEquivalentKg * batch.costPerKg);
  const grossProfit = round2(batch.baseRevenue - realizedCost);
  const expectedYields = Object.fromEntries(profile.map(([name, percent]) => [name, round3(batch.processedKg * percent / 100)]));
  const actualOutputKg = round3(Object.values(batch.actualYields).reduce((sum, value) => sum + value, 0));
  const saleableOutputKg = round3(Object.entries(batch.actualYields).reduce((sum, [name, value]) => sum + (name === "Bone" || name === "Fat/Waste" ? 0 : value), 0));
  return {
    ...batch,
    purchaseCost,
    realizedCost,
    grossProfit,
    grossMargin: batch.baseRevenue ? round2((grossProfit / batch.baseRevenue) * 100) : 0,
    expectedYields,
    actualOutputKg,
    yieldVarianceKg: round3(actualOutputKg - batch.processedKg),
    saleableYield: batch.processedKg ? round2((saleableOutputKg / batch.processedKg) * 100) : 0,
    remainingValue: round2(batch.stockRemainingKg * batch.costPerKg),
  };
}

export function calculateSupplierPerformance(batches = managementBatches) {
  const suppliers = [...new Set(batches.map((batch) => batch.supplier))];
  return suppliers.map((supplier) => {
    const rows = batches.filter((batch) => batch.supplier === supplier);
    const processed = rows.filter((batch) => batch.processedKg > 0);
    const processedKg = processed.reduce((sum, batch) => sum + batch.processedKg, 0);
    const yieldFor = (product: string) => processedKg
      ? round2(processed.reduce((sum, batch) => sum + (batch.actualYields[product] ?? 0), 0) / processedKg * 100)
      : 0;
    const saleableKg = processed.reduce((sum, batch) => sum + Object.entries(batch.actualYields).reduce((subtotal, [name, value]) => subtotal + (name === "Bone" || name === "Fat/Waste" ? 0 : value), 0), 0);
    const averageCostKg = round2(rows.reduce((sum, batch) => sum + batch.costPerKg * batch.receivedKg, 0) / rows.reduce((sum, batch) => sum + batch.receivedKg, 0));
    const saleableYield = processedKg ? round2(saleableKg / processedKg * 100) : 0;
    return {
      supplier,
      deliveries: rows.length,
      receivedKg: round3(rows.reduce((sum, batch) => sum + batch.receivedKg, 0)),
      averageCarcassKg: round2(rows.reduce((sum, batch) => sum + batch.receivedKg, 0) / rows.reduce((sum, batch) => sum + batch.unitCount, 0)),
      averageCostKg,
      rumpYield: yieldFor("Rump"),
      steakYield: yieldFor("Steak"),
      boneYield: yieldFor("Bone"),
      saleableYield,
      economicIndex: round2(saleableYield / averageCostKg * 100),
      sampleReady: processed.length > 0,
    };
  }).sort((a, b) => b.economicIndex - a.economicIndex);
}

export type VarianceIssue = {
  id: string;
  category: "Stock count" | "Waste" | "Till" | "Receiving";
  reference: string;
  occurredAt: string;
  description: string;
  quantityKg?: number;
  value: number;
  severity: "High" | "Medium" | "Low";
};

export function calculateVarianceIssues(input: {
  stockCounts: StockCountRecord[];
  waste: WasteRecord[];
  tillSessions: TillSession[];
}): VarianceIssue[] {
  const stock = input.stockCounts.map<VarianceIssue>((record) => ({
    id: `stock-${record.id}`, category: "Stock count", reference: record.number, occurredAt: record.createdAt,
    description: `${record.itemCount} products physically counted`, quantityKg: record.varianceKg, value: record.varianceValue,
    severity: Math.abs(record.varianceValue) >= 500 ? "High" : Math.abs(record.varianceValue) >= 100 ? "Medium" : "Low",
  }));
  const waste = input.waste.map<VarianceIssue>((record) => ({
    id: `waste-${record.id}`, category: "Waste", reference: record.number, occurredAt: record.createdAt,
    description: `${record.product} · ${record.reason}`, quantityKg: -record.weightKg, value: -record.costValue,
    severity: record.costValue >= 500 ? "High" : record.costValue >= 150 ? "Medium" : "Low",
  }));
  const tills = input.tillSessions.filter((session) => session.status === "Closed" && session.variance !== undefined).map<VarianceIssue>((session) => ({
    id: `till-${session.id}`, category: "Till", reference: session.number, occurredAt: session.closedAt ?? session.openedAt,
    description: `${session.cashier} closing cash variance`, value: session.variance ?? 0,
    severity: Math.abs(session.variance ?? 0) >= 200 ? "High" : Math.abs(session.variance ?? 0) >= 50 ? "Medium" : "Low",
  }));
  const receiving = managementBatches.map<VarianceIssue>((batch) => {
    const quantityKg = round3(batch.receivedKg - batch.invoiceKg);
    return {
      id: `receiving-${batch.code}`, category: "Receiving", reference: batch.code, occurredAt: batch.date,
      description: `${batch.supplier} actual vs invoice weight`, quantityKg, value: round2(quantityKg * batch.costPerKg),
      severity: Math.abs(quantityKg / batch.invoiceKg * 100) >= .5 ? "High" : Math.abs(quantityKg) >= 1 ? "Medium" : "Low",
    };
  });
  return [...stock, ...waste, ...tills, ...receiving].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function calculateReconciliation(input: {
  inventory: InventoryItem[];
  sales: SaleRecord[];
  waste: WasteRecord[];
  stockCounts: StockCountRecord[];
  ledger: LedgerMovement[];
  range: ManagementRange;
}) {
  const physicalClosingKg = round3(input.inventory.reduce((sum, item) => sum + item.physical, 0));
  const receivedKg = round3(managementBatches.filter((batch) => isInRange(batch.date, input.range)).reduce((sum, batch) => sum + batch.receivedKg, 0));
  const soldKg = round3(completedSales(input.sales, input.range).reduce((sum, sale) => sum + sale.totalKg, 0));
  const wasteKg = round3(input.waste.filter((record) => isInRange(record.createdAt, input.range)).reduce((sum, record) => sum + record.weightKg, 0));
  const returnsKg = round3(input.ledger.filter((entry) => entry.type === "CUSTOMER_RETURN" && isInRange(entry.createdAt, input.range)).reduce((sum, entry) => sum + entry.quantityKg, 0));
  const latestCount = input.stockCounts.filter((record) => isInRange(record.createdAt, input.range))[0];
  const varianceKg = latestCount?.varianceKg ?? 0;
  const adjustmentsKg = round3(input.stockCounts.filter((record) => isInRange(record.createdAt, input.range)).reduce((sum, record) => sum + record.varianceKg, 0));
  const expectedClosingKg = round3(physicalClosingKg - varianceKg);
  const openingKg = round3(expectedClosingKg - receivedKg - returnsKg + soldKg + wasteKg - adjustmentsKg);
  const averageCost = input.inventory.reduce((sum, item) => sum + item.cost, 0) / Math.max(input.inventory.length, 1);
  return {
    openingKg,
    receivedKg,
    returnsKg,
    soldKg,
    wasteKg,
    adjustmentsKg,
    expectedClosingKg,
    physicalClosingKg,
    varianceKg: round3(physicalClosingKg - expectedClosingKg),
    varianceValue: round2((physicalClosingKg - expectedClosingKg) * averageCost),
    reservedKg: round3(input.inventory.reduce((sum, item) => sum + item.reserved, 0)),
    reconciled: Math.abs(physicalClosingKg - expectedClosingKg) <= .01,
  };
}
