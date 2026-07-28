CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'CARD', 'EFT', 'CUSTOMER_ACCOUNT');--> statement-breakpoint
CREATE TYPE "public"."product_sale_mode" AS ENUM('WEIGHT', 'UNIT');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('COMPLETED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."till_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
CREATE TABLE "retail_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"physical_units" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retail_inventory_product_id_unique" UNIQUE("product_id")
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"ticket_item_id" uuid,
	"source" text NOT NULL,
	"barcode" text,
	"weight_kg" numeric(14, 3),
	"quantity_units" integer,
	"unit_price" numeric(14, 2) NOT NULL,
	"line_total" numeric(14, 2) NOT NULL,
	"cost_of_goods" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "till_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"cashier_id" uuid NOT NULL,
	"status" "till_status" DEFAULT 'OPEN' NOT NULL,
	"opening_float" numeric(14, 2) NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expected_cash" numeric(14, 2),
	"closing_count" numeric(14, 2),
	"variance" numeric(14, 2),
	"closed_at" timestamp with time zone,
	CONSTRAINT "till_sessions_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "method" SET DATA TYPE "public"."payment_method" USING upper(replace("method", ' ', '_'))::"public"."payment_method";--> statement-breakpoint
ALTER TABLE "sales" ALTER COLUMN "ticket_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sale_mode" "product_sale_mode" DEFAULT 'WEIGHT' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "barcode" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "scale_plu" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "unit_selling_price" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "unit_cost" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "receipt_number" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "till_session_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "status" "sale_status" DEFAULT 'COMPLETED' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "total_weight_kg" numeric(14, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "total_units" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "refund_reason" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
INSERT INTO "till_sessions" ("id", "number", "cashier_id", "status", "opening_float", "opened_at", "closed_at")
SELECT gen_random_uuid(), 'TILL-MIG-' || row_number() OVER (ORDER BY "cashier_id"), "cashier_id", 'CLOSED', 0, min("created_at"), max("created_at")
FROM "sales"
GROUP BY "cashier_id";--> statement-breakpoint
UPDATE "sales" AS "sale"
SET "receipt_number" = 'RCP-' || "sale"."number",
    "till_session_id" = "till"."id"
FROM "till_sessions" AS "till"
WHERE "till"."number" LIKE 'TILL-MIG-%'
  AND "till"."cashier_id" = "sale"."cashier_id";--> statement-breakpoint
ALTER TABLE "sales" ALTER COLUMN "receipt_number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ALTER COLUMN "till_session_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "retail_inventory" ADD CONSTRAINT "retail_inventory_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_ticket_item_id_butcher_ticket_items_id_fk" FOREIGN KEY ("ticket_item_id") REFERENCES "public"."butcher_ticket_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "till_sessions" ADD CONSTRAINT "till_sessions_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sale_items_sale_idx" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_items_barcode_idx" ON "sale_items" USING btree ("barcode");--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_till_session_id_till_sessions_id_fk" FOREIGN KEY ("till_session_id") REFERENCES "public"."till_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_barcode_unique" UNIQUE("barcode");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_scale_plu_unique" UNIQUE("scale_plu");--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_receipt_number_unique" UNIQUE("receipt_number");
