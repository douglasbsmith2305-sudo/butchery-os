import { neon } from "@neondatabase/serverless";

type QueryResult<T> = { results: T[] };
type RunResult = { meta: { last_row_id: number } };

function placeholders(sql: string) {
  let index = 0;
  let quote = "";
  let output = "";
  for (let cursor = 0; cursor < sql.length; cursor += 1) {
    const character = sql[cursor];
    if ((character === "'" || character === '"') && sql[cursor - 1] !== "\\") {
      if (!quote) quote = character;
      else if (quote === character) {
        if (sql[cursor + 1] === character) {
          output += character + character;
          cursor += 1;
          continue;
        }
        quote = "";
      }
    }
    if (character === "?" && !quote) output += `$${++index}`;
    else output += character;
  }
  return output;
}

function postgresSql(source: string) {
  let sql = source
    .replace(/`([^`]+)`/g, '"$1"')
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, "SERIAL PRIMARY KEY")
    .replace(/\bREAL\b/gi, "DOUBLE PRECISION")
    .replace(/\bMAX\(0\s*,/gi, "GREATEST(0,")
    .replace(/datetime\('now'\)/gi, "CURRENT_TIMESTAMP")
    .replace(/date\('now'\)/gi, "CURRENT_DATE")
    .replace(/\bAS\s+([a-z][a-z0-9]*[A-Z][A-Za-z0-9]*)/g, 'AS "$1"');

  const ignore = /^\s*INSERT\s+OR\s+IGNORE\s+INTO\s+/i.test(sql);
  if (ignore) {
    sql = sql.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO\s+/i, "INSERT INTO ");
    if (!/\bON\s+CONFLICT\b/i.test(sql)) sql = `${sql.replace(/;\s*$/, "")} ON CONFLICT DO NOTHING`;
  }
  return placeholders(sql);
}

class Statement {
  private values: unknown[] = [];

  constructor(private readonly source: string) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async all<T = Record<string, unknown>>(): Promise<QueryResult<T>> {
    const rows = await client().query(postgresSql(this.source), this.values);
    return { results: rows as T[] };
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const { results } = await this.all<T>();
    return results[0] ?? null;
  }

  async run(): Promise<RunResult> {
    let sql = postgresSql(this.source);
    const insertTable = sql.match(/^\s*INSERT\s+INTO\s+["`]?([a-z_][a-z0-9_]*)/i)?.[1]?.toLowerCase();
    const returnsId = new Set(["pos_sales", "pos_sale_items", "customer_purchases", "butcher_orders", "payroll_runs", "scale_sync_jobs", "stock_receipts", "commission_staff", "commission_entries"]);
    if (insertTable && returnsId.has(insertTable) && !/\bRETURNING\b/i.test(sql)) sql = `${sql.replace(/;\s*$/, "")} RETURNING id`;
    const rows = (await client().query(sql, this.values)) as unknown as Array<{ id?: number }>;
    const id = Number(rows[0]?.id ?? 0);
    return { meta: { last_row_id: id } };
  }
}

let sqlClient: ReturnType<typeof neon> | undefined;
function client() {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  sqlClient ??= neon(databaseUrl);
  return sqlClient;
}

export const env = {
  DB: {
    prepare(sql: string) {
      return new Statement(sql);
    },
    async batch(statements: Statement[]) {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    },
  },
};
