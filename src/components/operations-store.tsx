"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { inventory as seedInventory } from "@/lib/demo-data";
import { cancelReservation, recordWaste as calculateWaste, reconcileStockCount, reserveStock } from "@/lib/inventory";

export type InventoryItem = {
  id: string;
  product: string;
  physical: number;
  reserved: number;
  cost: number;
  price: number;
  movement: string;
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

type LedgerMovement = {
  id: string;
  product: string;
  quantityKg: number;
  type: "WASTE" | "PHYSICAL_COUNT_ADJUSTMENT" | "BUTCHER_BOOKING" | "BOOKING_CANCELLATION";
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
};

type OperationsContextValue = OperationsState & {
  createTicket(input: NewTicketInput): ButcherTicket;
  cancelTicket(ticketId: string, reason: string): void;
  recordWaste(input: { productId: string; weightKg: number; reason: string; notes?: string }): WasteRecord;
  submitStockCount(items: CountSubmission[]): StockCountRecord;
  resetDemo(): void;
};

const STORAGE_KEY = "butchery-os-operations-v2";
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
      { id: "item-2", productId: "wors", product: "Wors", weightKg: 1.5, pricePerKg: 109.99, lineTotal: 164.99 },
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

function createSeedState(): OperationsState {
  const ticketReserved = new Map<string, number>();
  for (const ticket of seededTickets.filter((item) => item.status === "Awaiting payment" || item.status === "Open")) {
    for (const item of ticket.items) ticketReserved.set(item.productId, (ticketReserved.get(item.productId) ?? 0) + item.weightKg);
  }

  return {
    inventory: seedInventory.map((item) => {
      const id = slugify(item.product);
      return { id, ...item, reserved: ticketReserved.get(id) ?? item.reserved };
    }),
    tickets: seededTickets,
    waste: [
      { id: "waste-seed-1", number: "WR-2031", productId: "steak", product: "Steak", weightKg: 1.4, costValue: 123.76, reason: "Trimming loss", notes: "Counter trim at opening", recordedBy: "Naledi Mokoena", createdAt: "2026-07-27T07:42:00.000Z" },
      { id: "waste-seed-2", number: "WR-2030", productId: "mince-wors-meat", product: "Mince/Wors Meat", weightKg: 2.1, costValue: 119.91, reason: "Quality rejection", notes: "Temperature check failed", recordedBy: "Naledi Mokoena", createdAt: "2026-07-26T16:18:00.000Z" },
    ],
    stockCounts: [],
    ledger: [],
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
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setState(JSON.parse(saved) as OperationsState);
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
