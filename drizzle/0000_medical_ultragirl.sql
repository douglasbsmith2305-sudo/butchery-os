CREATE TYPE "public"."batch_status" AS ENUM('RAW', 'PARTIALLY_PROCESSED', 'PROCESSED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."movement_direction" AS ENUM('IN', 'OUT', 'RESERVE', 'RELEASE');--> statement-breakpoint
CREATE TYPE "public"."inventory_location" AS ENUM('RAW_COOLER', 'FINISHED_COOLER', 'RESERVED', 'SOLD', 'WASTE');--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('SUPPLIER_RECEIPT', 'PROCESSING_INPUT', 'PROCESSING_OUTPUT', 'PROCESSING_LOSS', 'BUTCHER_BOOKING', 'BOOKING_CANCELLATION', 'POS_SALE', 'CUSTOMER_RETURN', 'WASTE', 'STOCK_ADJUSTMENT', 'TRANSFER', 'PHYSICAL_COUNT_ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ADMIN', 'MANAGER', 'WAREHOUSE', 'BUTCHER', 'CASHIER');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "block_test_profile_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"yield_percent" numeric(7, 4) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "block_test_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "butcher_ticket_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"batch_id" uuid,
	"weight_kg" numeric(14, 3) NOT NULL,
	"price_per_kg" numeric(14, 2) NOT NULL,
	"line_total" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "butcher_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"status" text NOT NULL,
	"butcher_id" uuid NOT NULL,
	"customer_id" uuid,
	"total" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "butcher_tickets_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"account_code" text,
	CONSTRAINT "customers_account_code_unique" UNIQUE("account_code")
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"delivery_date" date NOT NULL,
	"meat_type" text NOT NULL,
	"unit_count" integer,
	"invoice_weight_kg" numeric(14, 3) NOT NULL,
	"actual_weight_kg" numeric(14, 3) NOT NULL,
	"cost_per_kg" numeric(14, 2) NOT NULL,
	"total_cost" numeric(14, 2) NOT NULL,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"delivery_id" uuid NOT NULL,
	"raw_product_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"received_weight_kg" numeric(14, 3) NOT NULL,
	"remaining_raw_kg" numeric(14, 3) NOT NULL,
	"status" "batch_status" DEFAULT 'RAW' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_batches_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "inventory_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"batch_id" uuid,
	"location" "inventory_location" NOT NULL,
	"physical_kg" numeric(14, 3) DEFAULT '0' NOT NULL,
	"reserved_kg" numeric(14, 3) DEFAULT '0' NOT NULL,
	"unit_cost_kg" numeric(14, 2) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"method" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"expected_weight_kg" numeric(14, 3) NOT NULL,
	"actual_weight_kg" numeric(14, 3) NOT NULL,
	"cost_allocated" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"input_weight_kg" numeric(14, 3) NOT NULL,
	"status" text DEFAULT 'COMPLETED' NOT NULL,
	"reconciliation_difference_kg" numeric(14, 3) DEFAULT '0' NOT NULL,
	"loss_reason" text,
	"completed_by" uuid NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "product_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"category_id" uuid,
	"is_raw" boolean DEFAULT false NOT NULL,
	"saleable" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"selling_price_kg" numeric(14, 2) DEFAULT '0' NOT NULL,
	"average_cost_kg" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "projected_yields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"profile_percent" numeric(7, 4) NOT NULL,
	"expected_weight_kg" numeric(14, 3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"ticket_id" uuid NOT NULL,
	"cashier_id" uuid NOT NULL,
	"revenue" numeric(14, 2) NOT NULL,
	"cost_of_goods" numeric(14, 2) NOT NULL,
	"gross_profit" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "stock_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"batch_id" uuid,
	"quantity_kg" numeric(14, 3) NOT NULL,
	"direction" "movement_direction" NOT NULL,
	"movement_type" "movement_type" NOT NULL,
	"source" text NOT NULL,
	"destination" text NOT NULL,
	"reason" text NOT NULL,
	"related_entity_type" text,
	"related_entity_id" uuid,
	"user_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "role" NOT NULL,
	"password_hash" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_test_profile_items" ADD CONSTRAINT "block_test_profile_items_profile_id_block_test_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."block_test_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_test_profile_items" ADD CONSTRAINT "block_test_profile_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "butcher_ticket_items" ADD CONSTRAINT "butcher_ticket_items_ticket_id_butcher_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."butcher_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "butcher_ticket_items" ADD CONSTRAINT "butcher_ticket_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "butcher_ticket_items" ADD CONSTRAINT "butcher_ticket_items_batch_id_delivery_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."delivery_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "butcher_tickets" ADD CONSTRAINT "butcher_tickets_butcher_id_users_id_fk" FOREIGN KEY ("butcher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "butcher_tickets" ADD CONSTRAINT "butcher_tickets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_batches" ADD CONSTRAINT "delivery_batches_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_batches" ADD CONSTRAINT "delivery_batches_raw_product_id_products_id_fk" FOREIGN KEY ("raw_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_batches" ADD CONSTRAINT "delivery_batches_profile_id_block_test_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."block_test_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_batch_id_delivery_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."delivery_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_outputs" ADD CONSTRAINT "processing_outputs_session_id_processing_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."processing_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_outputs" ADD CONSTRAINT "processing_outputs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_sessions" ADD CONSTRAINT "processing_sessions_batch_id_delivery_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."delivery_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_sessions" ADD CONSTRAINT "processing_sessions_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projected_yields" ADD CONSTRAINT "projected_yields_batch_id_delivery_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."delivery_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projected_yields" ADD CONSTRAINT "projected_yields_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_ticket_id_butcher_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."butcher_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_ledger_entries" ADD CONSTRAINT "stock_ledger_entries_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_ledger_entries" ADD CONSTRAINT "stock_ledger_entries_batch_id_delivery_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."delivery_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_ledger_entries" ADD CONSTRAINT "stock_ledger_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "profile_product_unique" ON "block_test_profile_items" USING btree ("profile_id","product_id");--> statement-breakpoint
CREATE INDEX "inventory_product_location_idx" ON "inventory_lots" USING btree ("product_id","location");--> statement-breakpoint
CREATE UNIQUE INDEX "batch_projection_unique" ON "projected_yields" USING btree ("batch_id","product_id");--> statement-breakpoint
CREATE INDEX "ledger_product_date_idx" ON "stock_ledger_entries" USING btree ("product_id","occurred_at");--> statement-breakpoint
CREATE INDEX "ledger_batch_idx" ON "stock_ledger_entries" USING btree ("batch_id");