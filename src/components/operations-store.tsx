"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { calculateDeliveryVariance, nextBatchCode, processingStatus, validateBatchProcessing, weightedAverageCost } from "@/lib/cooler";
import { booleanFromCsv, type CsvRow, type ImportDataset, type ImportMode } from "@/lib/csv";
import { inventory as seedInventory, profile } from "@/lib/demo-data";
import { assertCanConsume, cancelReservation, recordWaste as calculateWaste, reconcileStockCount, reserveStock } from "@/lib/inventory";
import { normalizePlu, paymentDifference } from "@/lib/pos";

export type InventoryItem = {
  id: string;
  product: string;
  physical: number;
  reserved: number;
  cost: number;
  price: number;
  movement: string;
  scalePlu: string;
  category: string;
  reorderLevelKg: number;
  active: boolean;
};

export type TicketStatus = "Open" | "Awaiting payment" | "Paid" | "Cancelled" | "Returned";

export type TicketItem = {
  id: string;
  productId: string;
  product: string;
  weightKg: number;
  pricePerKg: number;
  lineTotal: number;
};

export type ButcherTicket = {
  id: string;
  number: string;
  customer: string;
  butcher: string;
  status: TicketStatus;
  items: TicketItem[];
  total: number;
  totalKg: number;
  createdAt: string;
  cancelledAt?: string;
  cancellationReason?: string;
};

export type WasteRecord = {
  id: string;
  number: string;
  productId: string;
  product: string;
  weightKg: number;
  costValue: number;
  reason: string;
  notes?: string;
  recordedBy: string;
  createdAt: string;
};

export type StockCountRecord = {
  id: string;
  number: string;
  countedBy: string;
  createdAt: string;
  itemCount: number;
  varianceKg: number;
  varianceValue: number;
};

export type CountSubmission = {
  productId: string;
  countedKg: number;
  reason: string;
};

export type NewTicketInput = {
  customer: string;
  butcher: string;
  items: { productId: string; weightKg: number }[];
};

export type RetailProduct = {
  id: string;
  sku: string;
  name: string;
  barcode: string;
  price: number;
  cost: number;
  stockUnits: number;
  category: string;
  reorderLevelUnits: number;
  active: boolean;
};

export type Supplier = {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  paymentTermsDays: number;
  active: boolean;
};

export type PurchaseOrder = {
  id: string;
  number: string;
  supplierId: string;
  supplier: string;
  deliveryDate: string;
  status: "Draft" | "Ordered" | "Received" | "Cancelled";
  lines: { id: string; description: string; orderedKg: number; costPerKg: number }[];
  subtotal: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
};

export type BlockTestProfile = {
  id: string;
  name: string;
  active: boolean;
  lines: { productId: string; product: string; percent: number }[];
  updatedAt: string;
};

export type StaffUser = {
  id: string;
  name: string;
  role: "Manager" | "Warehouse" | "Butcher" | "Cashier";
  active: boolean;
};

export type FoodSafetyCheck = {
  id: string;
  number: string;
  area: string;
  temperatureC: number;
  maximumC: number;
  status: "Pass" | "Action required";
  correctiveAction?: string;
  recordedBy: string;
  createdAt: string;
};

export type ImportBatch = {
  id: string;
  number: string;
  dataset: ImportDataset;
  filename: string;
  rowCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  importedBy: string;
  createdAt: string;
};

export type PaymentMethod = "Cash" | "Card" | "EFT" | "Customer account";
export type SaleStatus = "Completed" | "Refunded";

export type SaleLine = {
  id: string;
  source: "scale" | "ticket" | "retail";
  productId: string;
  product: string;
  barcode?: string;
  ticketId?: string;
  ticketNumber?: string;
  weightKg?: number;
  quantity?: number;
  unitPrice: number;
  lineTotal: number;
  costOfGoods: number;
};

export type SaleRecord = {
  id: string;
  number: string;
  receiptNumber: string;
  status: SaleStatus;
  customer: string;
  cashier: string;
  items: SaleLine[];
  payments: { id: string; method: PaymentMethod; amount: number }[];
  revenue: number;
  costOfGoods: number;
  grossProfit: number;
  grossMargin: number;
  totalKg: number;
  totalUnits: number;
  createdAt: string;
  refundedAt?: string;
  refundReason?: string;
};

export type TillSession = {
  id: string;
  number: string;
  status: "Open" | "Closed";
  cashier: string;
  openingFloat: number;
  openedAt: string;
  closingCount?: number;
  expectedCash?: number;
  variance?: number;
  closedAt?: string;
};

export type PosSaleInputLine =
  | { source: "scale"; productId: string; barcode: string; weightKg: number; lineTotal: number }
  | { source: "ticket"; ticketId: string }
  | { source: "retail"; retailProductId: string; quantity: number };

export type CompleteSaleInput = {
  customer: string;
  lines: PosSaleInputLine[];
  payments: { method: PaymentMethod; amount: number }[];
};

export type ManagementReview = {
  issueId: string;
  note: string;
  reviewedBy: string;
  reviewedAt: string;
};

export type ReconciliationSnapshot = {
  range: string;
  openingKg: number;
  receivedKg: number;
  returnsKg: number;
  soldKg: number;
  wasteKg: number;
  adjustmentsKg: number;
  expectedClosingKg: number;
  physicalClosingKg: number;
  varianceKg: number;
  varianceValue: number;
  note: string;
};

export type ReconciliationRecord = ReconciliationSnapshot & {
  id: string;
  number: string;
  status: "Completed";
  completedBy: string;
  createdAt: string;
};

export type BatchStatus = "Raw" | "Part processed" | "Processed";

export type BatchYieldLine = {
  productId: string;
  product: string;
  percent: number;
  expectedKg: number;
  actualKg: number;
};

export type CoolerBatch = {
  id: string;
  code: string;
  supplier: string;
  supplierCode: string;
  invoiceNumber: string;
  deliveryDate: string;
  meatType: string;
  unitCount: number;
  invoiceWeightKg: number;
  receivedKg: number;
  costPerKg: number;
  totalCost: number;
  remainingRawKg: number;
  status: BatchStatus;
  profileName: string;
  yields: BatchYieldLine[];
  notes?: string;
  receivedBy: string;
  createdAt: string;
};

export type ProcessingRun = {
  id: string;
  number: string;
  batchId: string;
  batchCode: string;
  inputKg: number;
  outputKg: number;
  lossKg: number;
  lossReason: string;
  outputs: { productId: string; product: string; expectedKg: number; actualKg: number; varianceKg: number }[];
  completedBy: string;
  completedAt: string;
};

export type ReceiveDeliveryInput = {
  supplier: string;
  invoiceNumber: string;
  deliveryDate: string;
  meatType: string;
  unitCount: number;
  invoiceWeightKg: number;
  actualWeightKg: number;
  costPerKg: number;
  notes?: string;
};

export type ProcessBatchInput = {
  batchId: string;
  inputKg: number;
  outputs: { productId: string; actualKg: number }[];
  lossKg: number;
  lossReason: string;
};

export type LedgerMovement = {
  id: string;
  product: string;
  quantityKg: number;
  type: "SUPPLIER_RECEIPT" | "PROCESSING_INPUT" | "PROCESSING_OUTPUT" | "PROCESSING_LOSS" | "WASTE" | "PHYSICAL_COUNT_ADJUSTMENT" | "BUTCHER_BOOKING" | "BOOKING_CANCELLATION" | "POS_SALE" | "CUSTOMER_RETURN";
  reason: string;
  reference: string;
  createdAt: string;
  batchCode?: string;
};

type OperationsState = {
  inventory: InventoryItem[];
  tickets: ButcherTicket[];
  waste: WasteRecord[];
  stockCounts: StockCountRecord[];
  ledger: LedgerMovement[];
  retailProducts: RetailProduct[];
  sales: SaleRecord[];
  tillSessions: TillSession[];
  managementReviews: ManagementReview[];
  reconciliations: ReconciliationRecord[];
  coolerBatches: CoolerBatch[];
  processingRuns: ProcessingRun[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  blockTestProfiles: BlockTestProfile[];
  staffUsers: StaffUser[];
  foodSafetyChecks: FoodSafetyCheck[];
  importBatches: ImportBatch[];
};

type OperationsContextValue = OperationsState & {
  createTicket(input: NewTicketInput): ButcherTicket;
  cancelTicket(ticketId: string, reason: string): void;
  recordWaste(input: { productId: string; weightKg: number; reason: string; notes?: string }): WasteRecord;
  submitStockCount(items: CountSubmission[]): StockCountRecord;
  completeSale(input: CompleteSaleInput): SaleRecord;
  refundSale(saleId: string, reason: string): void;
  updateScalePlu(productId: string, plu: string): void;
  openTill(openingFloat: number): TillSession;
  closeTill(closingCount: number): TillSession;
  reviewManagementIssue(issueId: string, note: string): void;
  completeReconciliation(input: ReconciliationSnapshot): ReconciliationRecord;
  receiveDelivery(input: ReceiveDeliveryInput): CoolerBatch;
  processBatch(input: ProcessBatchInput): ProcessingRun;
  saveInventoryProduct(input: Omit<InventoryItem, "movement" | "reserved" | "physical"> & { physical?: number }): void;
  saveRetailProduct(input: RetailProduct): void;
  saveSupplier(input: Supplier): void;
  savePurchaseOrder(input: { supplierId: string; deliveryDate: string; description: string; orderedKg: number; costPerKg: number; notes?: string }): PurchaseOrder;
  updatePurchaseOrderStatus(id: string, status: PurchaseOrder["status"]): void;
  saveBlockTestProfile(profile: BlockTestProfile): void;
  saveStaffUser(user: StaffUser): void;
  recordFoodSafetyCheck(input: { area: string; temperatureC: number; maximumC: number; correctiveAction?: string }): FoodSafetyCheck;
  importCsv(dataset: ImportDataset, rows: CsvRow[], filename: string, mode: ImportMode): ImportBatch;
  resetDemo(): void;
};

const STORAGE_KEY = "butchery-os-operations-v6";
const LEGACY_STORAGE_KEYS = ["butchery-os-operations-v5", "butchery-os-operations-v4", "butchery-os-operations-v3", "butchery-os-operations-v2"];
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const round3 = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;

const seededTickets: ButcherTicket[] = [
  {
    id: "ticket-seed-1",
    number: "BT-10482",
    customer: "Walk-in",
    butcher: "Johan van Wyk",
    status: "Awaiting payment",
    items: [
      { id: "item-1", productId: "rump", product: "Rump", weightKg: 2.3, pricePerKg: 169.99, lineTotal: 390.98 },
      { id: "item-2", productId: "mince-wors-meat", product: "Mince/Wors Meat", weightKg: 1.5, pricePerKg: 109.99, lineTotal: 164.99 },
      { id: "item-3", productId: "t-bone", product: "T-Bone", weightKg: 3.1, pricePerKg: 179.99, lineTotal: 557.97 },
    ],
    total: 1113.94,
    totalKg: 6.9,
    createdAt: "2026-07-27T09:36:00.000Z",
  },
  {
    id: "ticket-seed-2",
    number: "BT-10481",
    customer: "Thabo Nkosi",
    butcher: "Johan van Wyk",
    status: "Paid",
    items: [{ id: "item-4", productId: "steak", product: "Steak", weightKg: 4.8, pricePerKg: 149.99, lineTotal: 719.95 }],
    total: 719.95,
    totalKg: 4.8,
    createdAt: "2026-07-27T08:58:00.000Z",
  },
  {
    id: "ticket-seed-3",
    number: "BT-10480",
    customer: "Walk-in",
    butcher: "Lerato Molefe",
    status: "Cancelled",
    items: [{ id: "item-5", productId: "brisket", product: "Brisket", weightKg: 2.1, pricePerKg: 139.99, lineTotal: 293.98 }],
    total: 293.98,
    totalKg: 2.1,
    createdAt: "2026-07-27T08:22:00.000Z",
    cancelledAt: "2026-07-27T08:31:00.000Z",
    cancellationReason: "Customer changed order",
  },
];

function slugify(value: string) {
  return value.toLowerCase().replaceAll("/", "-").replaceAll(" ", "-");
}

const scalePlus: Record<string, string> = {
  rump: "4444",
  "t-bone": "1002",
  "club-steak": "1003",
  fillet: "1004",
  steak: "1005",
  "short-rib": "1006",
  brisket: "1007",
  chuck: "1008",
  "mince-wors-meat": "1009",
  "stew-beef": "1010",
  bone: "1011",
  "fat-waste": "1012",
};

function projectedYields(
  receivedKg: number,
  actuals: Record<string, number> = {},
  lines: { productId: string; product: string; percent: number }[] = profile.map(([product, percent]) => ({ productId: slugify(product), product, percent })),
): BatchYieldLine[] {
  return lines.map(({ productId, product, percent }) => {
    return {
      productId,
      product,
      percent,
      expectedKg: round3(receivedKg * percent / 100),
      actualKg: round3(actuals[productId] ?? 0),
    };
  });
}

const seededSuppliers: Supplier[] = [
  { id: "supplier-kpm", code: "KPM", name: "Karoo Prime Meats", contactPerson: "Anika Smit", phone: "021 555 0142", email: "orders@karooprime.example", paymentTermsDays: 30, active: true },
  { id: "supplier-hbc", code: "HBC", name: "Highveld Beef Co.", contactPerson: "Neo Maseko", phone: "011 555 0119", email: "sales@highveld.example", paymentTermsDays: 14, active: true },
  { id: "supplier-ll", code: "LL", name: "Lowveld Livestock", contactPerson: "Marius Nel", phone: "013 555 0191", email: "dispatch@lowveld.example", paymentTermsDays: 30, active: true },
];

const seededBlockTestProfile: BlockTestProfile = {
  id: "profile-standard-beef",
  name: "Standard Beef",
  active: true,
  lines: profile.map(([product, percent]) => ({ productId: slugify(product), product, percent })),
  updatedAt: "2026-07-27T06:00:00.000Z",
};

const seededBatches: CoolerBatch[] = [
  {
    id: "batch-seed-1", code: "BF-20260727-001", supplier: "Karoo Prime Meats", supplierCode: "KPM",
    invoiceNumber: "KPM-77841", deliveryDate: "2026-07-27", meatType: "Raw Beef", unitCount: 5,
    invoiceWeightKg: 718, receivedKg: 720, costPerKg: 92, totalCost: 66240, remainingRawKg: 0,
    status: "Processed", profileName: "Standard Beef",
    yields: projectedYields(720, { rump: 48.2, "t-bone": 63.1, "club-steak": 30.1, fillet: 11.4, steak: 121, "short-rib": 38.8, brisket: 36.1, chuck: 57.4, "mince-wors-meat": 130, "stew-beef": 36, bone: 105, "fat-waste": 40.6 }),
    notes: "Delivery temperature and seals checked.", receivedBy: "Naledi Mokoena", createdAt: "2026-07-27T07:58:00.000Z",
  },
  {
    id: "batch-seed-2", code: "BF-20260726-003", supplier: "Karoo Prime Meats", supplierCode: "KPM",
    invoiceNumber: "KPM-77798", deliveryDate: "2026-07-26", meatType: "Raw Beef", unitCount: 5,
    invoiceWeightKg: 686, receivedKg: 684.5, costPerKg: 91.5, totalCost: 62631.75, remainingRawKg: 184.5,
    status: "Part processed", profileName: "Standard Beef",
    yields: projectedYields(684.5, { rump: 34.4, "t-bone": 42.2, "club-steak": 19.6, fillet: 7.8, steak: 84.1, "short-rib": 27.1, brisket: 24.9, chuck: 40.1, "mince-wors-meat": 89.8, "stew-beef": 25.1, bone: 76.2, "fat-waste": 28.7 }),
    receivedBy: "Naledi Mokoena", createdAt: "2026-07-26T09:18:00.000Z",
  },
  {
    id: "batch-seed-3", code: "BF-20260726-002", supplier: "Highveld Beef Co.", supplierCode: "HBC",
    invoiceNumber: "HBC-40126", deliveryDate: "2026-07-26", meatType: "Raw Beef", unitCount: 5,
    invoiceWeightKg: 710.4, receivedKg: 712.2, costPerKg: 93.2, totalCost: 66377.04, remainingRawKg: 712.2,
    status: "Raw", profileName: "Standard Beef", yields: projectedYields(712.2),
    notes: "Awaiting block-out.", receivedBy: "Naledi Mokoena", createdAt: "2026-07-26T07:34:00.000Z",
  },
  {
    id: "batch-seed-4", code: "BF-20260725-001", supplier: "Lowveld Livestock", supplierCode: "LL",
    invoiceNumber: "LL-12908", deliveryDate: "2026-07-25", meatType: "Raw Beef", unitCount: 5,
    invoiceWeightKg: 650, receivedKg: 648.9, costPerKg: 89.8, totalCost: 58271.22, remainingRawKg: 0,
    status: "Processed", profileName: "Standard Beef", yields: projectedYields(648.9),
    receivedBy: "Naledi Mokoena", createdAt: "2026-07-25T08:03:00.000Z",
  },
];

function createSeedState(): OperationsState {
  const ticketReserved = new Map<string, number>();
  for (const ticket of seededTickets.filter((item) => item.status === "Awaiting payment" || item.status === "Open")) {
    for (const item of ticket.items) ticketReserved.set(item.productId, (ticketReserved.get(item.productId) ?? 0) + item.weightKg);
  }

  return {
    inventory: seedInventory.map((item) => {
      const id = slugify(item.product);
      return {
        id,
        ...item,
        scalePlu: scalePlus[id],
        reserved: ticketReserved.get(id) ?? item.reserved,
        category: item.product === "Fat/Waste" || item.product === "Bone" ? "By-products" : "Beef cuts",
        reorderLevelKg: item.product === "Fat/Waste" ? 0 : 15,
        active: item.product !== "Fat/Waste",
      };
    }),
    tickets: seededTickets,
    waste: [
      { id: "waste-seed-1", number: "WR-2031", productId: "steak", product: "Steak", weightKg: 1.4, costValue: 123.76, reason: "Trimming loss", notes: "Counter trim at opening", recordedBy: "Naledi Mokoena", createdAt: "2026-07-27T07:42:00.000Z" },
      { id: "waste-seed-2", number: "WR-2030", productId: "mince-wors-meat", product: "Mince/Wors Meat", weightKg: 2.1, costValue: 119.91, reason: "Quality rejection", notes: "Temperature check failed", recordedBy: "Naledi Mokoena", createdAt: "2026-07-26T16:18:00.000Z" },
    ],
    stockCounts: [],
    ledger: [
      { id: "ledger-seed-1", product: "Rump", quantityKg: 48.2, type: "PROCESSING_OUTPUT", reason: "Finished output posted to inventory", reference: "PROC-5001", batchCode: "BF-20260727-001", createdAt: "2026-07-27T10:42:00.000Z" },
      { id: "ledger-seed-2", product: "T-Bone", quantityKg: 63.1, type: "PROCESSING_OUTPUT", reason: "Finished output posted to inventory", reference: "PROC-5001", batchCode: "BF-20260727-001", createdAt: "2026-07-27T10:42:00.000Z" },
      { id: "ledger-seed-3", product: "Raw Beef", quantityKg: 720, type: "PROCESSING_INPUT", reason: "Raw batch issued to processing", reference: "PROC-5001", batchCode: "BF-20260727-001", createdAt: "2026-07-27T10:41:00.000Z" },
      { id: "ledger-seed-4", product: "Raw Beef", quantityKg: 720, type: "SUPPLIER_RECEIPT", reason: "Validated supplier delivery", reference: "KPM-77841", batchCode: "BF-20260727-001", createdAt: "2026-07-27T07:58:00.000Z" },
      { id: "ledger-seed-5", product: "Raw Beef", quantityKg: 712.2, type: "SUPPLIER_RECEIPT", reason: "Validated supplier delivery", reference: "HBC-40126", batchCode: "BF-20260726-002", createdAt: "2026-07-26T07:34:00.000Z" },
    ],
    retailProducts: [
      {
        id: "retail-coke-330",
        sku: "BEV-COKE-330",
        name: "Coca-Cola Original 330 ml",
        barcode: "5449000000996",
        price: 15.99,
        cost: 10.2,
        stockUnits: 48,
        category: "Cold drinks",
        reorderLevelUnits: 12,
        active: true,
      },
    ],
    sales: [
      {
        id: "sale-seed-1",
        number: "SAL-9001",
        receiptNumber: "RCP-9001",
        status: "Completed",
        customer: "Thabo Nkosi",
        cashier: "Ayanda Khumalo",
        items: [
          {
            id: "sale-line-seed-1",
            source: "ticket",
            productId: "steak",
            product: "Steak",
            ticketId: "ticket-seed-2",
            ticketNumber: "BT-10481",
            weightKg: 4.8,
            unitPrice: 149.99,
            lineTotal: 719.95,
            costOfGoods: 424.32,
          },
        ],
        payments: [{ id: "payment-seed-1", method: "Card", amount: 719.95 }],
        revenue: 719.95,
        costOfGoods: 424.32,
        grossProfit: 295.63,
        grossMargin: 41.06,
        totalKg: 4.8,
        totalUnits: 0,
        createdAt: "2026-07-27T08:59:00.000Z",
      },
    ],
    tillSessions: [
      {
        id: "till-seed-1",
        number: "TILL-301",
        status: "Open",
        cashier: "Ayanda Khumalo",
        openingFloat: 500,
        openedAt: "2026-07-28T06:00:00.000Z",
      },
    ],
    managementReviews: [],
    reconciliations: [],
    coolerBatches: seededBatches,
    processingRuns: [
      {
        id: "processing-seed-1", number: "PROC-5001", batchId: "batch-seed-1", batchCode: "BF-20260727-001",
        inputKg: 720, outputKg: 717.7, lossKg: 2.3, lossReason: "Moisture / processing loss",
        outputs: seededBatches[0].yields.map((item) => ({ productId: item.productId, product: item.product, expectedKg: item.expectedKg, actualKg: item.actualKg, varianceKg: round3(item.actualKg - item.expectedKg) })),
        completedBy: "Johan Botha", completedAt: "2026-07-27T10:42:00.000Z",
      },
    ],
    suppliers: seededSuppliers,
    purchaseOrders: [
      {
        id: "po-seed-1", number: "PO-2001", supplierId: "supplier-hbc", supplier: "Highveld Beef Co.",
        deliveryDate: "2026-07-30", status: "Ordered",
        lines: [{ id: "po-line-seed-1", description: "Raw Beef", orderedKg: 700, costPerKg: 93.5 }],
        subtotal: 65450, notes: "Confirm delivery temperature on arrival.", createdBy: "Lerato Dlamini", createdAt: "2026-07-27T13:00:00.000Z",
      },
    ],
    blockTestProfiles: [seededBlockTestProfile],
    staffUsers: [
      { id: "user-1", name: "Lerato Dlamini", role: "Manager", active: true },
      { id: "user-2", name: "Naledi Mokoena", role: "Warehouse", active: true },
      { id: "user-3", name: "Johan Botha", role: "Butcher", active: true },
      { id: "user-4", name: "Ayanda Khumalo", role: "Cashier", active: true },
    ],
    foodSafetyChecks: [
      { id: "safety-seed-1", number: "FS-1001", area: "Main cooler", temperatureC: 2.8, maximumC: 5, status: "Pass", recordedBy: "Naledi Mokoena", createdAt: "2026-07-27T06:15:00.000Z" },
    ],
    importBatches: [],
  };
}

function upgradeState(saved: Partial<OperationsState>): OperationsState {
  const seed = createSeedState();
  const savedInventory = saved.inventory ?? seed.inventory;
  return {
    ...seed,
    ...saved,
    inventory: savedInventory.map((item) => ({
      ...item,
      scalePlu: item.scalePlu ?? seed.inventory.find((seedItem) => seedItem.id === item.id)?.scalePlu ?? "",
      category: item.category ?? "Beef cuts",
      reorderLevelKg: item.reorderLevelKg ?? 15,
      active: item.active ?? true,
    })),
    tickets: (saved.tickets ?? seed.tickets).map((ticket) => ({
      ...ticket,
      items: ticket.items.map((item) => item.productId === "wors"
        ? { ...item, productId: "mince-wors-meat", product: "Mince/Wors Meat" }
        : item),
    })),
    retailProducts: (saved.retailProducts ?? seed.retailProducts).map((item) => ({
      ...item,
      reorderLevelUnits: item.reorderLevelUnits ?? 10,
      active: item.active ?? true,
    })),
    sales: saved.sales ?? seed.sales,
    tillSessions: saved.tillSessions ?? seed.tillSessions,
    managementReviews: saved.managementReviews ?? seed.managementReviews,
    reconciliations: saved.reconciliations ?? seed.reconciliations,
    coolerBatches: saved.coolerBatches ?? seed.coolerBatches,
    processingRuns: saved.processingRuns ?? seed.processingRuns,
    suppliers: saved.suppliers ?? seed.suppliers,
    purchaseOrders: saved.purchaseOrders ?? seed.purchaseOrders,
    blockTestProfiles: saved.blockTestProfiles ?? seed.blockTestProfiles,
    staffUsers: saved.staffUsers ?? seed.staffUsers,
    foodSafetyChecks: saved.foodSafetyChecks ?? seed.foodSafetyChecks,
    importBatches: saved.importBatches ?? seed.importBatches,
  };
}

const OperationsContext = createContext<OperationsContextValue | null>(null);

export function OperationsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OperationsState>(createSeedState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const saved = window.localStorage.getItem(STORAGE_KEY)
        ?? LEGACY_STORAGE_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean);
      if (saved) {
        try {
          setState(upgradeState(JSON.parse(saved) as Partial<OperationsState>));
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const value = useMemo<OperationsContextValue>(() => ({
    ...state,
    createTicket(input) {
      const inventory = state.inventory.map((item) => ({ ...item }));
      const ticketItems = input.items.map((entry, index) => {
        const stock = inventory.find((item) => item.id === entry.productId);
        if (!stock) throw new Error("Product not found");
        if (!stock.active) throw new Error(`${stock.product} is inactive`);
        const movement = reserveStock(round3(stock.physical - stock.reserved), stock.reserved, entry.weightKg);
        stock.reserved = movement.reservedKg;
        stock.movement = "Just now";
        return {
          id: `item-${Date.now()}-${index}`,
          productId: stock.id,
          product: stock.product,
          weightKg: round3(entry.weightKg),
          pricePerKg: stock.price,
          lineTotal: round2(entry.weightKg * stock.price),
        };
      });
      const highestTicket = Math.max(10482, ...state.tickets.map((ticket) => Number(ticket.number.replace("BT-", "")) || 0));
      const createdAt = new Date().toISOString();
      const created: ButcherTicket = {
        id: crypto.randomUUID(),
        number: `BT-${highestTicket + 1}`,
        customer: input.customer.trim() || "Walk-in",
        butcher: input.butcher,
        status: "Awaiting payment",
        items: ticketItems,
        total: round2(ticketItems.reduce((sum, item) => sum + item.lineTotal, 0)),
        totalKg: round3(ticketItems.reduce((sum, item) => sum + item.weightKg, 0)),
        createdAt,
      };
      const ledger = ticketItems.map<LedgerMovement>((item) => ({
        id: crypto.randomUUID(),
        product: item.product,
        quantityKg: item.weightKg,
        type: "BUTCHER_BOOKING",
        reason: "Reserved for customer ticket",
        reference: created.number,
        createdAt,
      }));
      setState({ ...state, inventory, tickets: [created, ...state.tickets], ledger: [...ledger, ...state.ledger] });
      return created;
    },
    cancelTicket(ticketId, reason) {
      const ticket = state.tickets.find((item) => item.id === ticketId);
      if (!ticket || (ticket.status !== "Open" && ticket.status !== "Awaiting payment")) throw new Error("Only open tickets can be cancelled");
      const inventory = state.inventory.map((item) => ({ ...item }));
      for (const ticketItem of ticket.items) {
        const stock = inventory.find((item) => item.id === ticketItem.productId);
        if (!stock) continue;
        stock.reserved = cancelReservation(stock.physical - stock.reserved, stock.reserved, ticketItem.weightKg).reservedKg;
        stock.movement = "Just now";
      }
      const cancelledAt = new Date().toISOString();
      const tickets = state.tickets.map((item) => item.id === ticketId ? { ...item, status: "Cancelled" as const, cancellationReason: reason, cancelledAt } : item);
      const ledger = ticket.items.map<LedgerMovement>((item) => ({
        id: crypto.randomUUID(), product: item.product, quantityKg: item.weightKg,
        type: "BOOKING_CANCELLATION", reason, reference: ticket.number, createdAt: cancelledAt,
      }));
      setState({ ...state, inventory, tickets, ledger: [...ledger, ...state.ledger] });
    },
    recordWaste(input) {
      const inventory = state.inventory.map((item) => ({ ...item }));
      const stock = inventory.find((item) => item.id === input.productId);
      if (!stock) throw new Error("Product not found");
      const result = calculateWaste(stock.physical, stock.reserved, input.weightKg);
      stock.physical = result.physicalKg;
      stock.movement = "Just now";
      const createdAt = new Date().toISOString();
      const highestWaste = Math.max(2031, ...state.waste.map((item) => Number(item.number.replace("WR-", "")) || 0));
      const created: WasteRecord = {
        id: crypto.randomUUID(),
        number: `WR-${highestWaste + 1}`,
        productId: stock.id,
        product: stock.product,
        weightKg: round3(input.weightKg),
        costValue: round2(input.weightKg * stock.cost),
        reason: input.reason,
        notes: input.notes?.trim() || undefined,
        recordedBy: "Naledi Mokoena",
        createdAt,
      };
      const movement: LedgerMovement = {
        id: crypto.randomUUID(), product: stock.product, quantityKg: input.weightKg,
        type: "WASTE", reason: input.reason, reference: created.number, createdAt,
      };
      setState({ ...state, inventory, waste: [created, ...state.waste], ledger: [movement, ...state.ledger] });
      return created;
    },
    submitStockCount(items) {
      const inventory = state.inventory.map((item) => ({ ...item }));
      let varianceKg = 0;
      let varianceValue = 0;
      const createdAt = new Date().toISOString();
      const highestCount = Math.max(4100, ...state.stockCounts.map((item) => Number(item.number.replace("SC-", "")) || 0));
      const number = `SC-${highestCount + 1}`;
      const ledger: LedgerMovement[] = [];
      for (const entry of items) {
        const stock = inventory.find((item) => item.id === entry.productId);
        if (!stock) continue;
        if (entry.countedKg < stock.reserved) throw new Error(`${stock.product}: count cannot be below reserved stock`);
        const result = reconcileStockCount(stock.physical, entry.countedKg);
        stock.physical = result.countedKg;
        stock.movement = "Just now";
        varianceKg += result.varianceKg;
        varianceValue += result.varianceKg * stock.cost;
        if (result.direction !== "NONE") {
          ledger.push({
            id: crypto.randomUUID(), product: stock.product, quantityKg: Math.abs(result.varianceKg),
            type: "PHYSICAL_COUNT_ADJUSTMENT", reason: entry.reason, reference: number, createdAt,
          });
        }
      }
      const created: StockCountRecord = {
        id: crypto.randomUUID(), number, countedBy: "Naledi Mokoena", createdAt,
        itemCount: items.length, varianceKg: round3(varianceKg), varianceValue: round2(varianceValue),
      };
      setState({ ...state, inventory, stockCounts: [created, ...state.stockCounts], ledger: [...ledger, ...state.ledger] });
      return created;
    },
    completeSale(input) {
      const till = state.tillSessions.find((session) => session.status === "Open");
      if (!till) throw new Error("Open a till session before taking payment");
      if (input.lines.length === 0) throw new Error("Add at least one item or butcher ticket");
      if (input.payments.length === 0) throw new Error("Capture at least one payment");

      const inventory = state.inventory.map((item) => ({ ...item }));
      const retailProducts = state.retailProducts.map((item) => ({ ...item }));
      let tickets = state.tickets.map((item) => ({ ...item }));
      const saleLines: SaleLine[] = [];
      const ledger: LedgerMovement[] = [];
      const createdAt = new Date().toISOString();
      const scannedLabels = new Set<string>();
      const ticketIds = new Set<string>();

      for (const line of input.lines) {
        if (line.source === "scale") {
          if (scannedLabels.has(line.barcode) || state.sales.some((sale) => sale.items.some((item) => item.barcode === line.barcode))) {
            throw new Error("This weighted label has already been sold or added");
          }
          scannedLabels.add(line.barcode);
          const stock = inventory.find((item) => item.id === line.productId);
          if (!stock) throw new Error("Scale product not found");
          if (!stock.active) throw new Error(`${stock.product} is inactive`);
          assertCanConsume(round3(stock.physical - stock.reserved), line.weightKg);
          stock.physical = round3(stock.physical - line.weightKg);
          stock.movement = "Just now";
          saleLines.push({
            id: crypto.randomUUID(),
            source: "scale",
            productId: stock.id,
            product: stock.product,
            barcode: line.barcode,
            weightKg: round3(line.weightKg),
            unitPrice: stock.price,
            lineTotal: round2(line.lineTotal),
            costOfGoods: round2(line.weightKg * stock.cost),
          });
          ledger.push({
            id: crypto.randomUUID(),
            product: stock.product,
            quantityKg: round3(line.weightKg),
            type: "POS_SALE",
            reason: "Teraoka scale label sold at POS",
            reference: "PENDING",
            createdAt,
          });
          continue;
        }

        if (line.source === "ticket") {
          if (ticketIds.has(line.ticketId)) throw new Error("A butcher ticket can only be added once");
          ticketIds.add(line.ticketId);
          const ticket = tickets.find((item) => item.id === line.ticketId);
          if (!ticket || (ticket.status !== "Open" && ticket.status !== "Awaiting payment")) {
            throw new Error("Butcher ticket is no longer awaiting payment");
          }
          for (const item of ticket.items) {
            const stock = inventory.find((inventoryItem) => inventoryItem.id === item.productId);
            if (!stock) throw new Error(`${item.product} is not mapped to Cooler stock`);
            assertCanConsume(stock.reserved, item.weightKg);
            assertCanConsume(stock.physical, item.weightKg);
            stock.physical = round3(stock.physical - item.weightKg);
            stock.reserved = round3(stock.reserved - item.weightKg);
            stock.movement = "Just now";
            saleLines.push({
              id: crypto.randomUUID(),
              source: "ticket",
              productId: stock.id,
              product: item.product,
              ticketId: ticket.id,
              ticketNumber: ticket.number,
              weightKg: item.weightKg,
              unitPrice: item.pricePerKg,
              lineTotal: item.lineTotal,
              costOfGoods: round2(item.weightKg * stock.cost),
            });
            ledger.push({
              id: crypto.randomUUID(),
              product: stock.product,
              quantityKg: item.weightKg,
              type: "POS_SALE",
              reason: "Reserved butcher ticket completed at POS",
              reference: ticket.number,
              createdAt,
            });
          }
          tickets = tickets.map((item) => item.id === ticket.id ? { ...item, status: "Paid" as const } : item);
          continue;
        }

        const retail = retailProducts.find((item) => item.id === line.retailProductId);
        if (!retail) throw new Error("Retail product not found");
        if (!retail.active) throw new Error(`${retail.name} is inactive`);
        if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new Error("Retail quantity must be a positive whole number");
        if (line.quantity > retail.stockUnits) throw new Error(`${retail.name}: only ${retail.stockUnits} units available`);
        retail.stockUnits -= line.quantity;
        saleLines.push({
          id: crypto.randomUUID(),
          source: "retail",
          productId: retail.id,
          product: retail.name,
          barcode: retail.barcode,
          quantity: line.quantity,
          unitPrice: retail.price,
          lineTotal: round2(retail.price * line.quantity),
          costOfGoods: round2(retail.cost * line.quantity),
        });
      }

      const revenue = round2(saleLines.reduce((sum, item) => sum + item.lineTotal, 0));
      const normalizedPayments = input.payments
        .filter((payment) => payment.amount > 0)
        .map((payment) => ({ ...payment, amount: round2(payment.amount) }));
      if (Math.abs(paymentDifference(revenue, normalizedPayments)) > 0.001) {
        throw new Error(`Payments must equal ${revenue.toFixed(2)}`);
      }
      const costOfGoods = round2(saleLines.reduce((sum, item) => sum + item.costOfGoods, 0));
      const highestSale = Math.max(9001, ...state.sales.map((sale) => Number(sale.number.replace("SAL-", "")) || 0));
      const number = `SAL-${highestSale + 1}`;
      const grossProfit = round2(revenue - costOfGoods);
      const created: SaleRecord = {
        id: crypto.randomUUID(),
        number,
        receiptNumber: `RCP-${highestSale + 1}`,
        status: "Completed",
        customer: input.customer.trim() || "Walk-in",
        cashier: "Ayanda Khumalo",
        items: saleLines,
        payments: normalizedPayments.map((payment) => ({ id: crypto.randomUUID(), ...payment })),
        revenue,
        costOfGoods,
        grossProfit,
        grossMargin: revenue === 0 ? 0 : round2((grossProfit / revenue) * 100),
        totalKg: round3(saleLines.reduce((sum, item) => sum + (item.weightKg ?? 0), 0)),
        totalUnits: saleLines.reduce((sum, item) => sum + (item.quantity ?? 0), 0),
        createdAt,
      };
      const completedLedger = ledger.map((item) => ({ ...item, reference: item.reference === "PENDING" ? number : item.reference }));
      setState({
        ...state,
        inventory,
        retailProducts,
        tickets,
        sales: [created, ...state.sales],
        ledger: [...completedLedger, ...state.ledger],
      });
      return created;
    },
    refundSale(saleId, reason) {
      const sale = state.sales.find((item) => item.id === saleId);
      if (!sale || sale.status !== "Completed") throw new Error("Only completed sales can be refunded");
      if (!reason.trim()) throw new Error("Select a refund reason");
      const inventory = state.inventory.map((item) => ({ ...item }));
      const retailProducts = state.retailProducts.map((item) => ({ ...item }));
      let tickets = state.tickets.map((item) => ({ ...item }));
      const refundedAt = new Date().toISOString();
      const ledger: LedgerMovement[] = [];
      for (const line of sale.items) {
        if (line.source === "retail") {
          const retail = retailProducts.find((item) => item.id === line.productId);
          if (retail) retail.stockUnits += line.quantity ?? 0;
          continue;
        }
        const stock = inventory.find((item) => item.id === line.productId);
        if (stock) {
          stock.physical = round3(stock.physical + (line.weightKg ?? 0));
          stock.movement = "Just now";
          ledger.push({
            id: crypto.randomUUID(),
            product: stock.product,
            quantityKg: line.weightKg ?? 0,
            type: "CUSTOMER_RETURN",
            reason,
            reference: sale.number,
            createdAt: refundedAt,
          });
        }
        if (line.ticketId) {
          tickets = tickets.map((ticket) => ticket.id === line.ticketId ? { ...ticket, status: "Returned" as const } : ticket);
        }
      }
      const sales = state.sales.map((item) => item.id === saleId ? {
        ...item,
        status: "Refunded" as const,
        refundedAt,
        refundReason: reason,
      } : item);
      setState({
        ...state,
        inventory,
        retailProducts,
        tickets,
        sales,
        ledger: [...ledger, ...state.ledger],
      });
    },
    updateScalePlu(productId, plu) {
      const normalized = normalizePlu(plu);
      if (!/^\d{1,5}$/.test(plu)) throw new Error("PLU must contain 1 to 5 digits");
      if (state.inventory.some((item) => item.id !== productId && normalizePlu(item.scalePlu) === normalized)) {
        throw new Error("That PLU is already assigned to another product");
      }
      const inventory = state.inventory.map((item) => item.id === productId ? { ...item, scalePlu: plu } : item);
      setState({ ...state, inventory });
    },
    openTill(openingFloat) {
      if (state.tillSessions.some((session) => session.status === "Open")) throw new Error("A till session is already open");
      if (!Number.isFinite(openingFloat) || openingFloat < 0) throw new Error("Opening float cannot be negative");
      const highestTill = Math.max(301, ...state.tillSessions.map((session) => Number(session.number.replace("TILL-", "")) || 0));
      const created: TillSession = {
        id: crypto.randomUUID(),
        number: `TILL-${highestTill + 1}`,
        status: "Open",
        cashier: "Ayanda Khumalo",
        openingFloat: round2(openingFloat),
        openedAt: new Date().toISOString(),
      };
      setState({ ...state, tillSessions: [created, ...state.tillSessions] });
      return created;
    },
    closeTill(closingCount) {
      const till = state.tillSessions.find((session) => session.status === "Open");
      if (!till) throw new Error("No till session is open");
      if (!Number.isFinite(closingCount) || closingCount < 0) throw new Error("Closing cash cannot be negative");
      const cashSales = state.sales
        .filter((sale) => sale.status === "Completed" && sale.createdAt >= till.openedAt)
        .flatMap((sale) => sale.payments)
        .filter((payment) => payment.method === "Cash")
        .reduce((sum, payment) => sum + payment.amount, 0);
      const expectedCash = round2(till.openingFloat + cashSales);
      const closed: TillSession = {
        ...till,
        status: "Closed",
        closingCount: round2(closingCount),
        expectedCash,
        variance: round2(closingCount - expectedCash),
        closedAt: new Date().toISOString(),
      };
      const tillSessions = state.tillSessions.map((session) => session.id === till.id ? closed : session);
      setState({ ...state, tillSessions });
      return closed;
    },
    reviewManagementIssue(issueId, note) {
      if (!note.trim()) throw new Error("Add a management review note");
      const review: ManagementReview = {
        issueId,
        note: note.trim(),
        reviewedBy: "Lerato Dlamini",
        reviewedAt: new Date().toISOString(),
      };
      const managementReviews = [
        review,
        ...state.managementReviews.filter((item) => item.issueId !== issueId),
      ];
      setState({ ...state, managementReviews });
    },
    completeReconciliation(input) {
      if (!input.note.trim()) throw new Error("Add a reconciliation note");
      const highest = Math.max(7000, ...state.reconciliations.map((record) => Number(record.number.replace("REC-", "")) || 0));
      const created: ReconciliationRecord = {
        ...input,
        id: crypto.randomUUID(),
        number: `REC-${highest + 1}`,
        status: "Completed",
        completedBy: "Lerato Dlamini",
        createdAt: new Date().toISOString(),
      };
      setState({ ...state, reconciliations: [created, ...state.reconciliations] });
      return created;
    },
    receiveDelivery(input) {
      if (!input.supplier.trim()) throw new Error("Select a supplier");
      if (!input.invoiceNumber.trim()) throw new Error("Enter the supplier invoice number");
      if (!Number.isInteger(input.unitCount) || input.unitCount <= 0) throw new Error("Units must be a positive whole number");
      if (state.coolerBatches.some((batch) => batch.invoiceNumber.toLowerCase() === input.invoiceNumber.trim().toLowerCase())) {
        throw new Error("That supplier invoice has already been received");
      }
      const calculation = calculateDeliveryVariance(input.invoiceWeightKg, input.actualWeightKg, input.costPerKg);
      const code = nextBatchCode(state.coolerBatches.map((batch) => batch.code), input.deliveryDate);
      const createdAt = new Date().toISOString();
      const supplier = state.suppliers.find((item) => item.name === input.supplier);
      const activeProfile = state.blockTestProfiles.find((item) => item.active) ?? seededBlockTestProfile;
      const created: CoolerBatch = {
        id: crypto.randomUUID(),
        code,
        supplier: input.supplier.trim(),
        supplierCode: supplier?.code ?? input.supplier.split(/\s+/).map((part) => part[0]).join("").slice(0, 4).toUpperCase(),
        invoiceNumber: input.invoiceNumber.trim(),
        deliveryDate: input.deliveryDate,
        meatType: input.meatType,
        unitCount: input.unitCount,
        invoiceWeightKg: round3(input.invoiceWeightKg),
        receivedKg: round3(input.actualWeightKg),
        costPerKg: round2(input.costPerKg),
        totalCost: calculation.totalCost,
        remainingRawKg: round3(input.actualWeightKg),
        status: "Raw",
        profileName: activeProfile.name,
        yields: projectedYields(input.actualWeightKg, {}, activeProfile.lines),
        notes: input.notes?.trim() || undefined,
        receivedBy: "Naledi Mokoena",
        createdAt,
      };
      const movement: LedgerMovement = {
        id: crypto.randomUUID(), product: input.meatType, quantityKg: created.receivedKg,
        type: "SUPPLIER_RECEIPT", reason: "Validated supplier delivery", reference: created.invoiceNumber,
        batchCode: created.code, createdAt,
      };
      setState({ ...state, coolerBatches: [created, ...state.coolerBatches], ledger: [movement, ...state.ledger] });
      return created;
    },
    processBatch(input) {
      const batch = state.coolerBatches.find((item) => item.id === input.batchId);
      if (!batch) throw new Error("Batch not found");
      if (input.inputKg > batch.remainingRawKg + .001) throw new Error(`Only ${batch.remainingRawKg.toFixed(3)} kg of raw stock remains`);
      if (input.lossKg > 0 && !input.lossReason.trim()) throw new Error("Select a reason for recorded loss");
      const reconciliation = validateBatchProcessing(input.inputKg, input.outputs, input.lossKg);
      const inventory = state.inventory.map((item) => ({ ...item }));
      const completedAt = new Date().toISOString();
      const outputs = input.outputs.filter((item) => item.actualKg > 0).map((entry) => {
        const stock = inventory.find((item) => item.id === entry.productId);
        if (!stock) throw new Error("A processing output is not mapped to inventory");
        const expected = round3(input.inputKg * (batch.yields.find((item) => item.productId === entry.productId)?.percent ?? 0) / 100);
        stock.cost = weightedAverageCost(stock.physical, stock.cost, entry.actualKg, batch.costPerKg);
        stock.physical = round3(stock.physical + entry.actualKg);
        stock.movement = "Just now";
        return {
          productId: stock.id, product: stock.product, expectedKg: expected,
          actualKg: round3(entry.actualKg), varianceKg: round3(entry.actualKg - expected),
        };
      });
      const remainingRawKg = round3(Math.max(0, batch.remainingRawKg - input.inputKg));
      const coolerBatches = state.coolerBatches.map((item) => item.id !== batch.id ? item : {
        ...item,
        remainingRawKg,
        status: processingStatus(item.receivedKg, remainingRawKg),
        yields: item.yields.map((yieldLine) => ({
          ...yieldLine,
          actualKg: round3(yieldLine.actualKg + (input.outputs.find((output) => output.productId === yieldLine.productId)?.actualKg ?? 0)),
        })),
      });
      const highest = Math.max(5000, ...state.processingRuns.map((run) => Number(run.number.replace("PROC-", "")) || 0));
      const created: ProcessingRun = {
        id: crypto.randomUUID(), number: `PROC-${highest + 1}`, batchId: batch.id, batchCode: batch.code,
        inputKg: round3(input.inputKg), outputKg: reconciliation.outputKg, lossKg: round3(input.lossKg),
        lossReason: input.lossReason.trim(), outputs, completedBy: "Johan Botha", completedAt,
      };
      const ledger: LedgerMovement[] = [
        {
          id: crypto.randomUUID(), product: batch.meatType, quantityKg: created.inputKg,
          type: "PROCESSING_INPUT", reason: "Raw batch issued to processing", reference: created.number,
          batchCode: batch.code, createdAt: completedAt,
        },
        ...outputs.map((item): LedgerMovement => ({
          id: crypto.randomUUID(), product: item.product, quantityKg: item.actualKg,
          type: "PROCESSING_OUTPUT", reason: "Finished output posted to inventory", reference: created.number,
          batchCode: batch.code, createdAt: completedAt,
        })),
      ];
      if (input.lossKg > 0) ledger.push({
        id: crypto.randomUUID(), product: "Processing loss", quantityKg: input.lossKg,
        type: "PROCESSING_LOSS", reason: input.lossReason, reference: created.number,
        batchCode: batch.code, createdAt: completedAt,
      });
      setState({
        ...state, inventory, coolerBatches, processingRuns: [created, ...state.processingRuns],
        ledger: [...ledger, ...state.ledger],
      });
      return created;
    },
    saveInventoryProduct(input) {
      if (!input.product.trim()) throw new Error("Enter a product name");
      if (!/^\d{1,5}$/.test(input.scalePlu)) throw new Error("Scale PLU must contain 1 to 5 digits");
      if (input.cost < 0 || input.price < 0 || input.reorderLevelKg < 0) throw new Error("Cost, price and reorder level cannot be negative");
      if (state.inventory.some((item) => item.id !== input.id && normalizePlu(item.scalePlu) === normalizePlu(input.scalePlu))) {
        throw new Error("That scale PLU is already assigned");
      }
      const existing = state.inventory.find((item) => item.id === input.id);
      const physical = input.physical ?? existing?.physical ?? 0;
      if (physical < (existing?.reserved ?? 0)) throw new Error("Physical stock cannot be below reserved stock");
      const saved: InventoryItem = {
        ...input,
        product: input.product.trim(),
        category: input.category.trim() || "Uncategorised",
        physical: round3(physical),
        reserved: existing?.reserved ?? 0,
        movement: existing?.movement ?? "Product created",
      };
      const inventory = existing
        ? state.inventory.map((item) => item.id === input.id ? saved : item)
        : [...state.inventory, saved];
      setState({ ...state, inventory });
    },
    saveRetailProduct(input) {
      if (!input.name.trim() || !input.sku.trim()) throw new Error("Enter a name and SKU");
      if (!/^\d{8,14}$/.test(input.barcode)) throw new Error("Barcode must contain 8 to 14 digits");
      if (input.cost < 0 || input.price < 0 || input.stockUnits < 0 || input.reorderLevelUnits < 0) throw new Error("Cost, price and stock cannot be negative");
      if (state.retailProducts.some((item) => item.id !== input.id && (item.sku.toLowerCase() === input.sku.toLowerCase() || item.barcode === input.barcode))) {
        throw new Error("That SKU or barcode is already assigned");
      }
      const saved = { ...input, name: input.name.trim(), sku: input.sku.trim(), category: input.category.trim() || "Uncategorised" };
      const exists = state.retailProducts.some((item) => item.id === input.id);
      setState({ ...state, retailProducts: exists ? state.retailProducts.map((item) => item.id === input.id ? saved : item) : [...state.retailProducts, saved] });
    },
    saveSupplier(input) {
      if (!input.name.trim() || !input.code.trim()) throw new Error("Enter a supplier name and code");
      if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error("Enter a valid email address");
      if (state.suppliers.some((item) => item.id !== input.id && item.code.toLowerCase() === input.code.toLowerCase())) throw new Error("That supplier code already exists");
      const saved = { ...input, code: input.code.trim().toUpperCase(), name: input.name.trim() };
      const exists = state.suppliers.some((item) => item.id === input.id);
      setState({ ...state, suppliers: exists ? state.suppliers.map((item) => item.id === input.id ? saved : item) : [...state.suppliers, saved] });
    },
    savePurchaseOrder(input) {
      const supplier = state.suppliers.find((item) => item.id === input.supplierId && item.active);
      if (!supplier) throw new Error("Select an active supplier");
      if (!input.description.trim()) throw new Error("Enter what is being ordered");
      if (input.orderedKg <= 0 || input.costPerKg < 0) throw new Error("Order weight must be positive and cost cannot be negative");
      const highest = Math.max(2001, ...state.purchaseOrders.map((item) => Number(item.number.replace("PO-", "")) || 0));
      const created: PurchaseOrder = {
        id: crypto.randomUUID(),
        number: `PO-${highest + 1}`,
        supplierId: supplier.id,
        supplier: supplier.name,
        deliveryDate: input.deliveryDate,
        status: "Draft",
        lines: [{ id: crypto.randomUUID(), description: input.description.trim(), orderedKg: round3(input.orderedKg), costPerKg: round2(input.costPerKg) }],
        subtotal: round2(input.orderedKg * input.costPerKg),
        notes: input.notes?.trim() || undefined,
        createdBy: "Lerato Dlamini",
        createdAt: new Date().toISOString(),
      };
      setState({ ...state, purchaseOrders: [created, ...state.purchaseOrders] });
      return created;
    },
    updatePurchaseOrderStatus(id, status) {
      const order = state.purchaseOrders.find((item) => item.id === id);
      if (!order) throw new Error("Purchase order not found");
      if (order.status === "Received" || order.status === "Cancelled") throw new Error("A closed purchase order cannot be changed");
      setState({ ...state, purchaseOrders: state.purchaseOrders.map((item) => item.id === id ? { ...item, status } : item) });
    },
    saveBlockTestProfile(savedProfile) {
      if (!savedProfile.name.trim()) throw new Error("Enter a profile name");
      const total = round2(savedProfile.lines.reduce((sum, item) => sum + item.percent, 0));
      if (Math.abs(total - 100) > .01) throw new Error(`Profile yield must total 100.00% (currently ${total.toFixed(2)}%)`);
      if (savedProfile.lines.some((line) => line.percent < 0)) throw new Error("Yield percentages cannot be negative");
      const exists = state.blockTestProfiles.some((item) => item.id === savedProfile.id);
      let blockTestProfiles = exists
        ? state.blockTestProfiles.map((item) => item.id === savedProfile.id ? { ...savedProfile, name: savedProfile.name.trim(), updatedAt: new Date().toISOString() } : item)
        : [...state.blockTestProfiles, { ...savedProfile, name: savedProfile.name.trim(), updatedAt: new Date().toISOString() }];
      if (savedProfile.active) blockTestProfiles = blockTestProfiles.map((item) => ({ ...item, active: item.id === savedProfile.id }));
      setState({ ...state, blockTestProfiles });
    },
    saveStaffUser(user) {
      if (!user.name.trim()) throw new Error("Enter the staff member's name");
      const saved = { ...user, name: user.name.trim() };
      const exists = state.staffUsers.some((item) => item.id === user.id);
      setState({ ...state, staffUsers: exists ? state.staffUsers.map((item) => item.id === user.id ? saved : item) : [...state.staffUsers, saved] });
    },
    recordFoodSafetyCheck(input) {
      if (!input.area.trim()) throw new Error("Enter the check area");
      if (!Number.isFinite(input.temperatureC) || !Number.isFinite(input.maximumC)) throw new Error("Enter valid temperatures");
      const requiresAction = input.temperatureC > input.maximumC;
      if (requiresAction && !input.correctiveAction?.trim()) throw new Error("Record corrective action for an out-of-range check");
      const highest = Math.max(1001, ...state.foodSafetyChecks.map((item) => Number(item.number.replace("FS-", "")) || 0));
      const created: FoodSafetyCheck = {
        id: crypto.randomUUID(),
        number: `FS-${highest + 1}`,
        area: input.area.trim(),
        temperatureC: round2(input.temperatureC),
        maximumC: round2(input.maximumC),
        status: requiresAction ? "Action required" : "Pass",
        correctiveAction: input.correctiveAction?.trim() || undefined,
        recordedBy: "Naledi Mokoena",
        createdAt: new Date().toISOString(),
      };
      setState({ ...state, foodSafetyChecks: [created, ...state.foodSafetyChecks] });
      return created;
    },
    importCsv(dataset, rows, filename, mode) {
      if (!rows.length || rows.some((row) => row.errors.length)) throw new Error("Resolve all CSV errors before importing");
      const inventory = state.inventory.map((item) => ({ ...item }));
      const retailProducts = state.retailProducts.map((item) => ({ ...item }));
      const suppliers = state.suppliers.map((item) => ({ ...item }));
      const ledger: LedgerMovement[] = [];
      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      const createdAt = new Date().toISOString();
      const highest = Math.max(0, ...state.importBatches.map((item) => Number(item.number.replace("IMP-", "")) || 0));
      const number = `IMP-${String(highest + 1).padStart(4, "0")}`;

      for (const row of rows) {
        const value = row.values;
        if (dataset === "weighted-products") {
          const existing = inventory.find((item) => item.scalePlu === value.scale_plu || item.product.toLowerCase() === value.product.toLowerCase());
          if (existing && mode === "add-only") {
            skippedCount += 1;
            continue;
          }
          const openingStock = value.opening_stock_kg === "" ? undefined : Number(value.opening_stock_kg);
          if (existing) {
            const previousPhysical = existing.physical;
            Object.assign(existing, {
              product: value.product,
              category: value.category || existing.category,
              scalePlu: value.scale_plu,
              cost: Number(value.cost_per_kg),
              price: Number(value.selling_price_per_kg),
              reorderLevelKg: Number(value.reorder_level_kg || existing.reorderLevelKg),
              active: booleanFromCsv(value.active, existing.active),
              physical: openingStock === undefined ? existing.physical : round3(openingStock),
              movement: openingStock === undefined || openingStock === previousPhysical ? existing.movement : "CSV stock adjustment",
            });
            if (existing.physical < existing.reserved) throw new Error(`${existing.product}: opening stock cannot be below reserved stock`);
            if (openingStock !== undefined && openingStock !== previousPhysical) ledger.push({
              id: crypto.randomUUID(), product: existing.product, quantityKg: Math.abs(openingStock - previousPhysical),
              type: "PHYSICAL_COUNT_ADJUSTMENT", reason: "CSV opening stock adjustment", reference: number, createdAt,
            });
            updatedCount += 1;
          } else {
            const idBase = slugify(value.product);
            const id = inventory.some((item) => item.id === idBase) ? `${idBase}-${crypto.randomUUID().slice(0, 6)}` : idBase;
            inventory.push({
              id, product: value.product, category: value.category || "Uncategorised", scalePlu: value.scale_plu,
              cost: Number(value.cost_per_kg), price: Number(value.selling_price_per_kg),
              reorderLevelKg: Number(value.reorder_level_kg || 0), active: booleanFromCsv(value.active),
              physical: round3(openingStock ?? 0), reserved: 0, movement: "Imported",
            });
            if (openingStock) ledger.push({
              id: crypto.randomUUID(), product: value.product, quantityKg: openingStock,
              type: "PHYSICAL_COUNT_ADJUSTMENT", reason: "CSV opening stock", reference: number, createdAt,
            });
            createdCount += 1;
          }
        } else if (dataset === "retail-products") {
          const existing = retailProducts.find((item) => item.sku.toLowerCase() === value.sku.toLowerCase() || item.barcode === value.barcode);
          if (existing && mode === "add-only") {
            skippedCount += 1;
            continue;
          }
          const openingStock = value.opening_stock_units === "" ? undefined : Number(value.opening_stock_units);
          if (existing) {
            Object.assign(existing, {
              sku: value.sku, name: value.name, barcode: value.barcode, category: value.category || existing.category,
              cost: Number(value.cost_per_unit), price: Number(value.selling_price_per_unit),
              reorderLevelUnits: Number(value.reorder_level_units || existing.reorderLevelUnits),
              stockUnits: openingStock ?? existing.stockUnits, active: booleanFromCsv(value.active, existing.active),
            });
            updatedCount += 1;
          } else {
            retailProducts.push({
              id: crypto.randomUUID(), sku: value.sku, name: value.name, barcode: value.barcode,
              category: value.category || "Uncategorised", cost: Number(value.cost_per_unit),
              price: Number(value.selling_price_per_unit), reorderLevelUnits: Number(value.reorder_level_units || 0),
              stockUnits: openingStock ?? 0, active: booleanFromCsv(value.active),
            });
            createdCount += 1;
          }
        } else {
          const existing = suppliers.find((item) => item.code.toLowerCase() === value.supplier_code.toLowerCase());
          if (existing && mode === "add-only") {
            skippedCount += 1;
            continue;
          }
          if (existing) {
            Object.assign(existing, {
              code: value.supplier_code.toUpperCase(), name: value.name, contactPerson: value.contact_person || "",
              phone: value.phone || "", email: value.email || "", paymentTermsDays: Number(value.payment_terms_days || 0),
              active: booleanFromCsv(value.active, existing.active),
            });
            updatedCount += 1;
          } else {
            suppliers.push({
              id: crypto.randomUUID(), code: value.supplier_code.toUpperCase(), name: value.name,
              contactPerson: value.contact_person || "", phone: value.phone || "", email: value.email || "",
              paymentTermsDays: Number(value.payment_terms_days || 0), active: booleanFromCsv(value.active),
            });
            createdCount += 1;
          }
        }
      }

      const created: ImportBatch = {
        id: crypto.randomUUID(), number, dataset, filename, rowCount: rows.length,
        createdCount, updatedCount, skippedCount, importedBy: "Lerato Dlamini", createdAt,
      };
      setState({
        ...state, inventory, retailProducts, suppliers,
        ledger: [...ledger, ...state.ledger], importBatches: [created, ...state.importBatches],
      });
      return created;
    },
    resetDemo() {
      setState(createSeedState());
    },
  }), [state]);

  return <OperationsContext.Provider value={value}>{children}</OperationsContext.Provider>;
}

export function useOperations() {
  const context = useContext(OperationsContext);
  if (!context) throw new Error("useOperations must be used inside OperationsProvider");
  return context;
}
