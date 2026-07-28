"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { inventory as seedInventory } from "@/lib/demo-data";
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

export type LedgerMovement = {
  id: string;
  product: string;
  quantityKg: number;
  type: "WASTE" | "PHYSICAL_COUNT_ADJUSTMENT" | "BUTCHER_BOOKING" | "BOOKING_CANCELLATION" | "POS_SALE" | "CUSTOMER_RETURN";
  reason: string;
  reference: string;
  createdAt: string;
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
  resetDemo(): void;
};

const STORAGE_KEY = "butchery-os-operations-v4";
const LEGACY_STORAGE_KEYS = ["butchery-os-operations-v3", "butchery-os-operations-v2"];
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

function createSeedState(): OperationsState {
  const ticketReserved = new Map<string, number>();
  for (const ticket of seededTickets.filter((item) => item.status === "Awaiting payment" || item.status === "Open")) {
    for (const item of ticket.items) ticketReserved.set(item.productId, (ticketReserved.get(item.productId) ?? 0) + item.weightKg);
  }

  return {
    inventory: seedInventory.map((item) => {
      const id = slugify(item.product);
      return { id, ...item, scalePlu: scalePlus[id], reserved: ticketReserved.get(id) ?? item.reserved };
    }),
    tickets: seededTickets,
    waste: [
      { id: "waste-seed-1", number: "WR-2031", productId: "steak", product: "Steak", weightKg: 1.4, costValue: 123.76, reason: "Trimming loss", notes: "Counter trim at opening", recordedBy: "Naledi Mokoena", createdAt: "2026-07-27T07:42:00.000Z" },
      { id: "waste-seed-2", number: "WR-2030", productId: "mince-wors-meat", product: "Mince/Wors Meat", weightKg: 2.1, costValue: 119.91, reason: "Quality rejection", notes: "Temperature check failed", recordedBy: "Naledi Mokoena", createdAt: "2026-07-26T16:18:00.000Z" },
    ],
    stockCounts: [],
    ledger: [],
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
    })),
    tickets: (saved.tickets ?? seed.tickets).map((ticket) => ({
      ...ticket,
      items: ticket.items.map((item) => item.productId === "wors"
        ? { ...item, productId: "mince-wors-meat", product: "Mince/Wors Meat" }
        : item),
    })),
    retailProducts: saved.retailProducts ?? seed.retailProducts,
    sales: saved.sales ?? seed.sales,
    tillSessions: saved.tillSessions ?? seed.tillSessions,
    managementReviews: saved.managementReviews ?? seed.managementReviews,
    reconciliations: saved.reconciliations ?? seed.reconciliations,
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
