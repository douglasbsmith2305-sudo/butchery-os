CREATE TYPE "public"."ticket_status" AS ENUM('OPEN', 'AWAITING_PAYMENT', 'PAID', 'CANCELLED', 'RETURNED', 'PARTIALLY_RETURNED');--> statement-breakpoint
CREATE TABLE "stock_count_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stock_count_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"expected_kg" numeric(14, 3) NOT NULL,
	"counted_kg" numeric(14, 3) NOT NULL,
	"variance_kg" numeric(14, 3) NOT NULL,
	"variance_value" numeric(14, 2) NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"status" text DEFAULT 'COMPLETED' NOT NULL,
	"counted_by" uuid NOT NULL,
	"notes" text,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_counts_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "waste_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"product_id" uuid NOT NULL,
	"batch_id" uuid,
	"weight_kg" numeric(14, 3) NOT NULL,
	"cost_value" numeric(14, 2) NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waste_records_number_unique" UNIQUE("number")
);
--> statement-breakpoint
UPDATE "butcher_tickets" SET "status" = CASE
	WHEN lower("status") = 'open' THEN 'OPEN'
	WHEN lower("status") = 'awaiting payment' THEN 'AWAITING_PAYMENT'
	WHEN lower("status") = 'paid' THEN 'PAID'
	WHEN lower("status") = 'cancelled' THEN 'CANCELLED'
	WHEN lower("status") = 'returned' THEN 'RETURNED'
	WHEN lower("status") = 'partially returned' THEN 'PARTIALLY_RETURNED'
	ELSE 'OPEN'
END;--> statement-breakpoint
ALTER TABLE "butcher_tickets" ALTER COLUMN "status" SET DEFAULT 'AWAITING_PAYMENT'::"public"."ticket_status";--> statement-breakpoint
ALTER TABLE "butcher_tickets" ALTER COLUMN "status" SET DATA TYPE "public"."ticket_status" USING "status"::"public"."ticket_status";--> statement-breakpoint
ALTER TABLE "butcher_tickets" ADD COLUMN "total_weight_kg" numeric(14, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "butcher_tickets" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "butcher_tickets" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_stock_count_id_stock_counts_id_fk" FOREIGN KEY ("stock_count_id") REFERENCES "public"."stock_counts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_counted_by_users_id_fk" FOREIGN KEY ("counted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_records" ADD CONSTRAINT "waste_records_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_records" ADD CONSTRAINT "waste_records_batch_id_delivery_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."delivery_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_records" ADD CONSTRAINT "waste_records_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_count_product_unique" ON "stock_count_items" USING btree ("stock_count_id","product_id");--> statement-breakpoint
CREATE INDEX "waste_product_date_idx" ON "waste_records" USING btree ("product_id","created_at");
