# Monthly costs and production inputs

Open **Manager → Costs** or **Back office → Costs**. The same monthly view is
available under **Reports → Monthly costs**. Sand-box → Costs uses a read-only
snapshot and keeps all simulated entries in browser memory.

## Recording overheads

Fixed and variable sections contain reusable cost items. Add or edit their names,
category, active state and monthly planning budget. Each expenditure is a separate
dated entry with an optional invoice/reference and note. For example, two R400
electricity top-ups produce R800 of variable expenditure for the selected month.

Amounts are stored in integer cents. Enter costs excluding recoverable VAT.
Budgets are separate from actual expenditure. The pricing engine uses the largest
of the existing overhead allowance, item budgets and recorded expenditure as its
monthly planning allowance; it does not add these three figures together.
Actual costs feed the current margin once costs are recorded. Payroll is not
automatically added again: record the relevant salary expense under Costs.

An incorrect entry can be reversed with a reason, and replaced. Its original
amount, category, name and reversal reason remain in history. Retried submissions
with the same request key do not create duplicate entries.

## Production-input department

Use Stock master bulk assignment to put additional ingredients and packaging in
**Cost of goods**. Receive them normally: their delivery-date quantities and
invoice costs automatically populate the monthly worksheet. These inputs do not
receive retail-price proposals or scale exports and cannot be sold through POS.
Carcass inputs retain their existing meat departments and automatic block tests.

The monthly equation is:

    opening input value + purchases − unused closing input value = inputs consumed

Enter the first opening quantity and its total cost value, then enter the unused
closing quantity. Weighted average cost values the closing balance. Saved closing
quantities and values carry into the next consecutive month. Corrected historical
receipts or counts recalculate later carry-forward valuations from their source
data. Missing or impossible counts remain provisional rather than silently charging
all purchases to profit.

Tick **Already in unit cost** for ingredients already included in finished-product
unit costs; consumption remains visible but is not added to COGS twice. The material
component of unfinished/unsold finished goods can be carried separately:

    additional material COGS = additional inputs consumed
                             + opening deferred material cost
                             − closing deferred material cost

Do not enter the full retail value of finished goods in these fields. This is a
periodic cost worksheet, not a recipe/production ledger. It does not alter physical
stock balances: continue using Manager → Stock count for operational quantities.

The monthly report shows VAT-exclusive paid sales, estimated sold product costs
(using current unit costs), additional material COGS, recorded overheads and
recorded non-input waste/count losses. Input losses are already within input
consumption and are not charged again. Unrecorded costs and returns not allocated
to original sale lines can still affect the eventual accounting result. The UI
labels the result as an estimate rather than a completed set of accounts.

## Verification

- `npm test`: production build, existing regression checks and behavioural cost math tests.
- `node --env-file=.env.local tests/costs-integration.mjs`: real HTTP/API tests in a
  temporary schema, scoped with SET LOCAL in each database transaction. Connection
  string search_path options are not sufficient with the Neon HTTP driver.
  The script removes only its own generated schema after testing.

Tables are documented in `drizzle/0019_monthly_costs.sql`; route setup is idempotent.
No existing product is automatically reassigned and no demo expenditure is seeded.

Accounting basis: [IAS 2 inventories](https://www.ifrs.org/issued-standards/list-of-standards/ias-2-inventories/).
