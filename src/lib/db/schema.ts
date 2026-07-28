import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["ADMIN", "MANAGER", "WAREHOUSE", "BUTCHER", "CASHIER"]);
export const batchStatusEnum = pgEnum("batch_status", ["RAW", "PARTIALLY_PROCESSED", "PROCESSED", "CLOSED"]);
export const movementEnum = pgEnum("movement_type", [
  "SUPPLIER_RECEIPT", "PROCESSING_INPUT", "PROCESSING_OUTPUT", "PROCESSING_LOSS",
  "BUTCHER_BOOKING", "BOOKING_CANCELLATION", "POS_SALE", "CUSTOMER_RETURN",
  "WASTE", "STOCK_ADJUSTMENT", "TRANSFER", "PHYSICAL_COUNT_ADJUSTMENT",
]);
export const directionEnum = pgEnum("movement_direction", ["IN", "OUT", "RESERVE", "RELEASE"]);
export const locationEnum = pgEnum("inventory_location", ["RAW_COOLER", "FINISHED_COOLER", "RESERVED", "SOLD", "WASTE"]);
export const ticketStatusEnum = pgEnum("ticket_status", ["OPEN", "AWAITING_PAYMENT", "PAID", "CANCELLED", "RETURNED", "PARTIALLY_RETURNED"]);
export const productSaleModeEnum = pgEnum("product_sale_mode", ["WEIGHT", "UNIT"]);
export const paymentMethodEnum = pgEnum("payment_method", ["CASH", "CARD", "EFT", "CUSTOMER_ACCOUNT"]);
export const saleStatusEnum = pgEnum("sale_status", ["COMPLETED", "REFUNDED"]);
export const tillStatusEnum = pgEnum("till_status", ["OPEN", "CLOSED"]);

const money = (name: string) => numeric(name, { precision: 14, scale: 2 });
const weight = (name: string) => numeric(name, { precision: 14, scale: 3 });
const percent = (name: string) => numeric(name, { precision: 7, scale: 4 });

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull(),
  passwordHash: text("password_hash"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const productCategories = pgTable("product_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
});

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  categoryId: uuid("category_id").references(() => productCategories.id),
  isRaw: boolean("is_raw").default(false).notNull(),
  saleable: boolean("saleable").default(true).notNull(),
  active: boolean("active").default(true).notNull(),
  saleMode: productSaleModeEnum("sale_mode").default("WEIGHT").notNull(),
  barcode: text("barcode").unique(),
  scalePlu: text("scale_plu").unique(),
  sellingPriceKg: money("selling_price_kg").default("0").notNull(),
  averageCostKg: money("average_cost_kg").default("0").notNull(),
  unitSellingPrice: money("unit_selling_price").default("0").notNull(),
  unitCost: money("unit_cost").default("0").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const blockTestProfiles = pgTable("block_test_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  version: integer("version").default(1).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const blockTestProfileItems = pgTable("block_test_profile_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => blockTestProfiles.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  yieldPercent: percent("yield_percent").notNull(),
}, (t) => [uniqueIndex("profile_product_unique").on(t.profileId, t.productId)]);

export const deliveries = pgTable("deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id),
  invoiceNumber: text("invoice_number").notNull(),
  deliveryDate: date("delivery_date").notNull(),
  meatType: text("meat_type").notNull(),
  unitCount: integer("unit_count"),
  invoiceWeightKg: weight("invoice_weight_kg").notNull(),
  actualWeightKg: weight("actual_weight_kg").notNull(),
  costPerKg: money("cost_per_kg").notNull(),
  totalCost: money("total_cost").notNull(),
  notes: text("notes"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const deliveryBatches = pgTable("delivery_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  deliveryId: uuid("delivery_id").notNull().references(() => deliveries.id),
  rawProductId: uuid("raw_product_id").notNull().references(() => products.id),
  profileId: uuid("profile_id").notNull().references(() => blockTestProfiles.id),
  receivedWeightKg: weight("received_weight_kg").notNull(),
  remainingRawKg: weight("remaining_raw_kg").notNull(),
  status: batchStatusEnum("status").default("RAW").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projectedYields = pgTable("projected_yields", {
  id: uuid("id").defaultRandom().primaryKey(),
  batchId: uuid("batch_id").notNull().references(() => deliveryBatches.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  profilePercent: percent("profile_percent").notNull(),
  expectedWeightKg: weight("expected_weight_kg").notNull(),
}, (t) => [uniqueIndex("batch_projection_unique").on(t.batchId, t.productId)]);

export const processingSessions = pgTable("processing_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  batchId: uuid("batch_id").notNull().references(() => deliveryBatches.id),
  inputWeightKg: weight("input_weight_kg").notNull(),
  status: text("status").default("COMPLETED").notNull(),
  reconciliationDifferenceKg: weight("reconciliation_difference_kg").default("0").notNull(),
  lossReason: text("loss_reason"),
  completedBy: uuid("completed_by").notNull().references(() => users.id),
  completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
});

export const processingOutputs = pgTable("processing_outputs", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => processingSessions.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  expectedWeightKg: weight("expected_weight_kg").notNull(),
  actualWeightKg: weight("actual_weight_kg").notNull(),
  costAllocated: money("cost_allocated").notNull(),
});

export const inventoryLots = pgTable("inventory_lots", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull().references(() => products.id),
  batchId: uuid("batch_id").references(() => deliveryBatches.id),
  location: locationEnum("location").notNull(),
  physicalKg: weight("physical_kg").default("0").notNull(),
  reservedKg: weight("reserved_kg").default("0").notNull(),
  unitCostKg: money("unit_cost_kg").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("inventory_product_location_idx").on(t.productId, t.location)]);

export const retailInventory = pgTable("retail_inventory", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull().unique().references(() => products.id),
  physicalUnits: integer("physical_units").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const stockLedgerEntries = pgTable("stock_ledger_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: text("transaction_id").notNull(),
  productId: uuid("product_id").notNull().references(() => products.id),
  batchId: uuid("batch_id").references(() => deliveryBatches.id),
  quantityKg: weight("quantity_kg").notNull(),
  direction: directionEnum("direction").notNull(),
  movementType: movementEnum("movement_type").notNull(),
  source: text("source").notNull(),
  destination: text("destination").notNull(),
  reason: text("reason").notNull(),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: uuid("related_entity_id"),
  userId: uuid("user_id").notNull().references(() => users.id),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("ledger_product_date_idx").on(t.productId, t.occurredAt), index("ledger_batch_idx").on(t.batchId)]);

export const stockCounts = pgTable("stock_counts", {
  id: uuid("id").defaultRandom().primaryKey(),
  number: text("number").notNull().unique(),
  status: text("status").default("COMPLETED").notNull(),
  countedBy: uuid("counted_by").notNull().references(() => users.id),
  notes: text("notes"),
  completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
});

export const stockCountItems = pgTable("stock_count_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  stockCountId: uuid("stock_count_id").notNull().references(() => stockCounts.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  expectedKg: weight("expected_kg").notNull(),
  countedKg: weight("counted_kg").notNull(),
  varianceKg: weight("variance_kg").notNull(),
  varianceValue: money("variance_value").notNull(),
  reason: text("reason").notNull(),
}, (t) => [uniqueIndex("stock_count_product_unique").on(t.stockCountId, t.productId)]);

export const wasteRecords = pgTable("waste_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  number: text("number").notNull().unique(),
  productId: uuid("product_id").notNull().references(() => products.id),
  batchId: uuid("batch_id").references(() => deliveryBatches.id),
  weightKg: weight("weight_kg").notNull(),
  costValue: money("cost_value").notNull(),
  reason: text("reason").notNull(),
  notes: text("notes"),
  recordedBy: uuid("recorded_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("waste_product_date_idx").on(t.productId, t.createdAt)]);

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  accountCode: text("account_code").unique(),
});

export const butcherTickets = pgTable("butcher_tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  number: text("number").notNull().unique(),
  status: ticketStatusEnum("status").default("AWAITING_PAYMENT").notNull(),
  butcherId: uuid("butcher_id").notNull().references(() => users.id),
  customerId: uuid("customer_id").references(() => customers.id),
  total: money("total").notNull(),
  totalWeightKg: weight("total_weight_kg").default("0").notNull(),
  cancellationReason: text("cancellation_reason"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const butcherTicketItems = pgTable("butcher_ticket_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id").notNull().references(() => butcherTickets.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  batchId: uuid("batch_id").references(() => deliveryBatches.id),
  weightKg: weight("weight_kg").notNull(),
  pricePerKg: money("price_per_kg").notNull(),
  lineTotal: money("line_total").notNull(),
});

export const tillSessions = pgTable("till_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  number: text("number").notNull().unique(),
  cashierId: uuid("cashier_id").notNull().references(() => users.id),
  status: tillStatusEnum("status").default("OPEN").notNull(),
  openingFloat: money("opening_float").notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
  expectedCash: money("expected_cash"),
  closingCount: money("closing_count"),
  variance: money("variance"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const sales = pgTable("sales", {
  id: uuid("id").defaultRandom().primaryKey(),
  number: text("number").notNull().unique(),
  receiptNumber: text("receipt_number").notNull().unique(),
  ticketId: uuid("ticket_id").references(() => butcherTickets.id),
  customerId: uuid("customer_id").references(() => customers.id),
  tillSessionId: uuid("till_session_id").notNull().references(() => tillSessions.id),
  cashierId: uuid("cashier_id").notNull().references(() => users.id),
  status: saleStatusEnum("status").default("COMPLETED").notNull(),
  revenue: money("revenue").notNull(),
  costOfGoods: money("cost_of_goods").notNull(),
  grossProfit: money("gross_profit").notNull(),
  totalWeightKg: weight("total_weight_kg").default("0").notNull(),
  totalUnits: integer("total_units").default(0).notNull(),
  refundReason: text("refund_reason"),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const saleItems = pgTable("sale_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  saleId: uuid("sale_id").notNull().references(() => sales.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  ticketItemId: uuid("ticket_item_id").references(() => butcherTicketItems.id),
  source: text("source").notNull(),
  barcode: text("barcode"),
  weightKg: weight("weight_kg"),
  quantityUnits: integer("quantity_units"),
  unitPrice: money("unit_price").notNull(),
  lineTotal: money("line_total").notNull(),
  costOfGoods: money("cost_of_goods").notNull(),
}, (t) => [index("sale_items_sale_idx").on(t.saleId), index("sale_items_barcode_idx").on(t.barcode)]);

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  saleId: uuid("sale_id").notNull().references(() => sales.id),
  method: paymentMethodEnum("method").notNull(),
  amount: money("amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
