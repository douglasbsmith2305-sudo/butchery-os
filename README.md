# Butchery OS

Butchery OS is a kilogram-first operating system for retail butcheries. Phase 1 and Phase 2 implement the traceability foundation from supplier delivery through theoretical block testing, physical processing, finished Cooler inventory, and an immutable stock ledger.

## What is implemented

- Responsive industrial operations UI for desktop, tablet, and mobile
- Supplier receiving with invoice/scale variance and ZAR purchase totals
- Unique delivery batches and configurable database-driven block-test profiles
- Strict separation of projected yield from physical finished inventory
- Processing/block-out capture with actual vs expected variance warnings
- Reconciliation gate: inputs must equal outputs plus an explicit loss category
- Batch-linked raw and finished inventory lots
- Immutable ledger entries and audit logging
- Weighted-average-ready inventory costing with retained batch provenance
- Server-side RBAC foundation for ADMIN, MANAGER, WAREHOUSE, BUTCHER, and CASHIER
- Schema scaffolding for butcher tickets, reservations, POS sales, and payments
- Automated critical stock and financial calculation tests

The live interface contains realistic seeded demo data. Database mutations activate when a PostgreSQL connection is configured.

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS, shadcn-compatible components, Drizzle ORM, PostgreSQL, Vitest, and Vercel-compatible server actions/services.

## Local setup

1. Install Node.js 22 and dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

3. Create a PostgreSQL database (Supabase, Neon, or Vercel Marketplace Postgres are suitable) and set `DATABASE_URL`.

4. Generate and run the migration:

   ```bash
   npm run db:generate
   npm run db:migrate
   ```

5. Seed products, the demo supplier, admin user, and Standard Beef profile:

   ```bash
   npm run db:seed
   ```

6. Start development:

   ```bash
   npm run dev
   ```

## Testing and build

```bash
npm test
npm run build
```

The core test suite covers yield calculation and profile validation, processing reconciliation, negative-stock prevention, butcher reservation/cancellation, POS reservation-to-sale movement, sale reversal, weighted average cost, and gross margin.

## Vercel deployment

1. Import the GitHub repository into Vercel.
2. Add `DATABASE_URL`, `AUTH_SECRET`, and `NEXT_PUBLIC_APP_URL` in project environment variables.
3. Run the generated Drizzle migration against the production PostgreSQL database.
4. Deploy. Next.js is detected automatically.

Database clients are lazily initialized so builds do not require runtime credentials.

## Architecture

The relational model preserves the chain:

`Supplier → Delivery → Batch → Projected Yield → Processing → Inventory Lot → Stock Ledger → Booking → Sale → Reconciliation`

The database uses fixed-precision numeric columns for weights, percentages, cost, and currency. Completed commercial or inventory events are not deleted. Corrections are modeled as reversals or ledger adjustments.

Stock changes belong in `src/lib/services/stock.ts`, where receiving and processing execute as database transactions with server-side permission checks. Pure, decimal-rounded stock rules are kept in `src/lib/inventory.ts` and covered by tests.

## Phase roadmap

Phase 3 adds the operational butcher-ticket and reservation screens. Phase 4 completes payment, sale, refund, and till workflows. Phase 5 activates profitability, supplier analytics, daily reconciliation, and variance management over the schema and ledger already established here.
