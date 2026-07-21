/**
 * pg-adapter — a drop-in, Supabase-JS-compatible query client backed by a raw
 * PostgreSQL connection (node-postgres).
 *
 * Why this exists: the app's data layer (orderActions et al.) speaks the Supabase
 * / PostgREST query-builder API (`.from().select("a, rel!inner(...)").eq().order()
 * .range().single()`). Our new database (the `dolese` cluster) is reachable ONLY as
 * raw Postgres (no PostgREST gateway), and `@supabase/supabase-js` cannot talk to
 * raw Postgres. This module reimplements the subset of the PostgREST builder the app
 * actually uses, translating each chain into SQL — so every existing call site keeps
 * working unchanged when we point at the new DB.
 *
 * Activated when DOLESE_PG_URL (or DOLESE_PG_HOST/…) is set; otherwise the app keeps
 * using the real Supabase client. See src/supabase/server.ts + getSupabaseClient().
 *
 * Supported surface (verified against the codebase):
 *   from, select (with !inner / !left + nested embeds + alias:col), insert, update,
 *   delete, eq, neq, gt, gte, lt, lte, in, like, ilike, is, or (dot-syntax),
 *   order({ascending,nullsFirst}), range, limit, single, maybeSingle.
 * Embedded joins are resolved from the live foreign-key catalog (introspected once).
 */

import pg, { Pool } from "pg";

// node-postgres and PostgREST/supabase-js disagree on how some column types are
// represented in JS. The app was written against PostgREST's shapes, so we align
// node-pg to match — otherwise the same code that works on Supabase breaks here.
//
//  - int8 (bigint): PostgREST → JSON number; node-pg → string. The app keys a Map by
//    `tickets.order_id` and looks it up with `Number(order_id)`, so a string value never
//    matches and every order looks ticket-less (→ all PRE-POUR, no pies). Parse to Number
//    (order/ticket ids are well within Number's safe-integer range).
//  - timestamptz/timestamp/date: PostgREST → ISO STRING; node-pg → JS Date. The app calls
//    string methods on these (`t.trim()`, `String(s).slice(0,10)`, `.split("-")`), which
//    throw on a Date. Parse to strings matching PostgREST.
//  - numeric: left as node-pg's string — the app already wraps every numeric read in
//    Number()/parseFloat(), so no conversion is needed (and converting risks the reverse).
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v))); // int8 / bigint
pg.types.setTypeParser(1184, (v) => (v === null ? null : new Date(v).toISOString())); // timestamptz → ISO (UTC)
pg.types.setTypeParser(1114, (v) => (v === null ? null : String(v).replace(" ", "T"))); // timestamp (naive)
pg.types.setTypeParser(1082, (v) => v); // date → keep "YYYY-MM-DD" string (node-pg default is a Date)

/* ----------------------------- connection ------------------------------ */

interface PgGlobal {
  pool?: Pool;
  meta?: Promise<Meta>;
}
const g = globalThis as unknown as { __dolesePg?: PgGlobal };
if (!g.__dolesePg) g.__dolesePg = {};

export function isPgAdapterConfigured(): boolean {
  return !!(process.env.DOLESE_PG_URL || process.env.DOLESE_PG_HOST);
}

function getPool(): Pool {
  if (!g.__dolesePg!.pool) {
    let url = process.env.DOLESE_PG_URL;
    // The NodePort endpoint presents a self-signed cert, so we encrypt WITHOUT CA
    // verification (matches DBeaver "require"). Newer pg maps a `sslmode=require`
    // query param to `verify-full`, which would override the `ssl` option below and
    // reject the cert — so strip any ssl* query param and drive SSL from `ssl` only.
    const ssl = { rejectUnauthorized: false };
    if (url) url = url.replace(/([?&])(sslmode|ssl)=[^&]*/gi, "$1").replace(/[?&]+$/g, "").replace(/([?&])&+/g, "$1");
    g.__dolesePg!.pool = url
      ? new Pool({ connectionString: url, ssl, max: 8, idleTimeoutMillis: 30000 })
      : new Pool({
          host: process.env.DOLESE_PG_HOST,
          port: Number(process.env.DOLESE_PG_PORT || 5432),
          database: process.env.DOLESE_PG_DATABASE,
          user: process.env.DOLESE_PG_USER,
          password: process.env.DOLESE_PG_PASSWORD,
          ssl,
          max: 8,
          idleTimeoutMillis: 30000,
        });
  }
  return g.__dolesePg!.pool!;
}

/* --------------------------- introspection ----------------------------- */

interface Fk {
  child_table: string;
  child_column: string;
  parent_table: string;
  parent_column: string;
}
interface Meta {
  fks: Fk[];
}

function ensureMeta(): Promise<Meta> {
  if (!g.__dolesePg!.meta) {
    g.__dolesePg!.meta = getPool()
      .query(
        `select tc.table_name as child_table, kcu.column_name as child_column,
                ccu.table_name as parent_table, ccu.column_name as parent_column
           from information_schema.table_constraints tc
           join information_schema.key_column_usage kcu
             on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
           join information_schema.constraint_column_usage ccu
             on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
          where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'`,
      )
      .then((r) => ({ fks: r.rows as Fk[] }))
      .catch((e) => {
        // Reset so a transient failure doesn't permanently poison the cache.
        g.__dolesePg!.meta = undefined;
        throw e;
      });
  }
  return g.__dolesePg!.meta;
}

/** Resolve an embedded relation `rel` declared under `parentTable`. */
function resolveRel(
  meta: Meta,
  parentTable: string,
  rel: string,
): { target: string; kind: "many" | "one"; join: (childAlias: string, parentAlias: string) => string } {
  // one-to-many: rel is a child table with a FK pointing at parentTable
  const many = meta.fks.find((f) => f.child_table === rel && f.parent_table === parentTable);
  if (many) {
    return {
      target: rel,
      kind: "many",
      join: (c, p) => `${c}."${many.child_column}" = ${p}."${many.parent_column}"`,
    };
  }
  // many-to-one: parentTable has a FK pointing at rel
  const one = meta.fks.find((f) => f.child_table === parentTable && f.parent_table === rel);
  if (one) {
    return {
      target: rel,
      kind: "one",
      join: (c, p) => `${c}."${one.parent_column}" = ${p}."${one.child_column}"`,
    };
  }
  throw new Error(`pg-adapter: no foreign-key relationship found between "${parentTable}" and "${rel}"`);
}

/* ------------------------- select-string parser ------------------------ */

interface Field {
  kind: "column" | "embed";
  name: string;
  alias?: string;
  inner?: boolean; // !inner
  children?: Field[];
}

/** Split a select fragment on top-level commas (ignoring commas inside parens). */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim() !== "") out.push(cur);
  return out;
}

function parseSelect(sel: string): Field[] {
  return splitTop(sel)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((part): Field => {
      const paren = part.indexOf("(");
      if (paren >= 0) {
        // embed: [alias:]rel[!hint]( ...children... )
        const head = part.slice(0, paren).trim();
        const inner = part.slice(paren + 1, part.lastIndexOf(")"));
        let alias: string | undefined;
        let name = head;
        const colon = head.indexOf(":");
        if (colon >= 0) {
          alias = head.slice(0, colon).trim();
          name = head.slice(colon + 1).trim();
        }
        let isInner = false;
        const bang = name.indexOf("!");
        if (bang >= 0) {
          const hint = name.slice(bang + 1).trim().toLowerCase();
          isInner = hint === "inner";
          name = name.slice(0, bang).trim();
        }
        return { kind: "embed", name, alias, inner: isInner, children: parseSelect(inner) };
      }
      // plain column, possibly alias:col
      let alias: string | undefined;
      let name = part;
      const colon = part.indexOf(":");
      if (colon >= 0) {
        alias = part.slice(0, colon).trim();
        name = part.slice(colon + 1).trim();
      }
      return { kind: "column", name, alias };
    });
}

/* --------------------------- SQL generation ---------------------------- */

interface BuiltFields {
  selectList: string[];
  whereExtra: string[]; // EXISTS predicates from !inner embeds at this level
}

let aliasSeq = 0;
function nextAlias(): string {
  aliasSeq = (aliasSeq + 1) % 1_000_000;
  return `t${aliasSeq}`;
}

function buildFields(meta: Meta, fields: Field[], table: string, alias: string): BuiltFields {
  const selectList: string[] = [];
  const whereExtra: string[] = [];
  for (const f of fields) {
    if (f.kind === "column") {
      if (f.name === "*") selectList.push(`${alias}.*`);
      else selectList.push(`${alias}."${f.name}" as "${f.alias || f.name}"`);
      continue;
    }
    const rel = resolveRel(meta, table, f.name);
    const ca = nextAlias();
    const inner = buildFields(meta, f.children || [], rel.target, ca);
    const cond = [rel.join(ca, alias), ...inner.whereExtra].join(" and ");
    const label = f.alias || f.name;
    if (rel.kind === "many") {
      selectList.push(
        `coalesce((select json_agg(row_to_json(_j)) from ` +
          `(select ${inner.selectList.join(", ")} from "${rel.target}" ${ca} where ${cond}) _j), '[]'::json) as "${label}"`,
      );
    } else {
      selectList.push(
        `(select row_to_json(_j) from ` +
          `(select ${inner.selectList.join(", ")} from "${rel.target}" ${ca} where ${cond} limit 1) _j) as "${label}"`,
      );
    }
    if (f.inner) {
      const ex = nextAlias();
      whereExtra.push(`exists (select 1 from "${rel.target}" ${ex} where ${rel.join(ex, alias)})`);
    }
  }
  return { selectList, whereExtra };
}

/* ---------------------------- query builder ---------------------------- */

type Op = "select" | "insert" | "update" | "delete";
interface Filter {
  col: string;
  op: string;
  val: unknown;
}
interface OrderBy {
  col: string;
  asc: boolean;
  nullsFirst?: boolean;
}
interface Result<T> {
  data: T;
  error: { message: string } | null;
}

const OP_SQL: Record<string, string> = {
  eq: "=",
  neq: "<>",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "like",
  ilike: "ilike",
};

class PgQueryBuilder implements PromiseLike<Result<unknown>> {
  private op: Op = "select";
  private selectStr = "*";
  private selectRequested = false; // for mutations: RETURNING
  private filters: Filter[] = [];
  private orExpr: string | null = null;
  private orders: OrderBy[] = [];
  private limitN: number | null = null;
  private offsetN: number | null = null;
  private payload: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private singleMode: "single" | "maybe" | null = null;
  private table: string;

  constructor(table: string) {
    this.table = table;
  }

  select(sel?: string): this {
    if (this.op === "select") this.selectStr = sel && sel.trim() ? sel : "*";
    else this.selectRequested = true;
    return this;
  }
  insert(values: Record<string, unknown> | Record<string, unknown>[]): this {
    this.op = "insert";
    this.payload = values;
    return this;
  }
  update(values: Record<string, unknown>): this {
    this.op = "update";
    this.payload = values;
    return this;
  }
  delete(): this {
    this.op = "delete";
    return this;
  }
  eq(col: string, val: unknown): this { return this.push(col, "eq", val); }
  neq(col: string, val: unknown): this { return this.push(col, "neq", val); }
  gt(col: string, val: unknown): this { return this.push(col, "gt", val); }
  gte(col: string, val: unknown): this { return this.push(col, "gte", val); }
  lt(col: string, val: unknown): this { return this.push(col, "lt", val); }
  lte(col: string, val: unknown): this { return this.push(col, "lte", val); }
  like(col: string, val: unknown): this { return this.push(col, "like", val); }
  ilike(col: string, val: unknown): this { return this.push(col, "ilike", val); }
  in(col: string, vals: unknown[]): this { return this.push(col, "in", vals); }
  is(col: string, val: unknown): this { return this.push(col, "is", val); }
  private push(col: string, op: string, val: unknown): this {
    this.filters.push({ col, op, val });
    return this;
  }
  /** PostgREST dot-syntax OR: "name.ilike.%x%,code.ilike.%x%" */
  or(expr: string): this {
    this.orExpr = expr;
    return this;
  }
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this.orders.push({ col, asc: opts?.ascending !== false, nullsFirst: opts?.nullsFirst });
    return this;
  }
  range(from: number, to: number): this {
    this.offsetN = from;
    this.limitN = to - from + 1;
    return this;
  }
  limit(n: number): this {
    this.limitN = n;
    return this;
  }
  single(): this {
    this.singleMode = "single";
    return this;
  }
  maybeSingle(): this {
    this.singleMode = "maybe";
    return this;
  }

  /* ------- WHERE assembly (shared by select + update + delete) ------- */
  private buildWhere(params: unknown[], extra: string[] = []): string {
    const parts: string[] = [...extra];
    for (const f of this.filters) {
      const c = `"${f.col}"`;
      if (f.op === "in") {
        params.push(f.val);
        parts.push(`${c} = any($${params.length})`);
      } else if (f.op === "is") {
        if (f.val === null) parts.push(`${c} is null`);
        else parts.push(`${c} is ${f.val === true ? "true" : f.val === false ? "false" : "not null"}`);
      } else {
        params.push(f.val);
        parts.push(`${c} ${OP_SQL[f.op] || "="} $${params.length}`);
      }
    }
    if (this.orExpr) {
      const ors = splitTop(this.orExpr).map((tok) => {
        const t = tok.trim();
        const d1 = t.indexOf(".");
        const d2 = t.indexOf(".", d1 + 1);
        const col = t.slice(0, d1);
        const op = t.slice(d1 + 1, d2);
        const val = t.slice(d2 + 1);
        if (op === "is") return `"${col}" is ${val === "null" ? "null" : val}`;
        params.push(val);
        return `"${col}" ${OP_SQL[op] || "="} $${params.length}`;
      });
      if (ors.length) parts.push(`(${ors.join(" or ")})`);
    }
    return parts.length ? ` where ${parts.join(" and ")}` : "";
  }

  private tail(): string {
    let s = "";
    if (this.orders.length) {
      s +=
        " order by " +
        this.orders
          .map((o) => `"${o.col}" ${o.asc ? "asc" : "desc"}${o.nullsFirst != null ? (o.nullsFirst ? " nulls first" : " nulls last") : ""}`)
          .join(", ");
    }
    if (this.limitN != null) s += ` limit ${this.limitN}`;
    if (this.offsetN != null) s += ` offset ${this.offsetN}`;
    return s;
  }

  private async run(): Promise<Result<unknown>> {
    const meta = await ensureMeta();
    const params: unknown[] = [];
    let sql: string;

    if (this.op === "select") {
      const alias = nextAlias();
      const built = buildFields(meta, parseSelect(this.selectStr), this.table, alias);
      const where = this.buildWhere(params, built.whereExtra);
      sql = `select ${built.selectList.join(", ")} from "${this.table}" ${alias}${where}${this.tail()}`;
    } else if (this.op === "insert") {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload || {}];
      const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
      const valuesSql = rows
        .map((r) => `(${cols.map((c) => { params.push(r[c] ?? null); return `$${params.length}`; }).join(", ")})`)
        .join(", ");
      sql = `insert into "${this.table}" (${cols.map((c) => `"${c}"`).join(", ")}) values ${valuesSql} returning *`;
    } else if (this.op === "update") {
      const obj = (this.payload || {}) as Record<string, unknown>;
      const sets = Object.keys(obj).map((c) => { params.push(obj[c] ?? null); return `"${c}" = $${params.length}`; });
      const where = this.buildWhere(params);
      sql = `update "${this.table}" set ${sets.join(", ")}${where} returning *`;
    } else {
      // delete
      const where = this.buildWhere(params);
      sql = `delete from "${this.table}"${where} returning *`;
    }

    let rows: Record<string, unknown>[];
    try {
      const res = await getPool().query(sql, params as unknown[]);
      rows = res.rows;
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }

    if (this.singleMode === "single") {
      if (rows.length !== 1) return { data: null, error: { message: `Expected 1 row, got ${rows.length}` } };
      return { data: rows[0], error: null };
    }
    if (this.singleMode === "maybe") {
      if (rows.length > 1) return { data: null, error: { message: `Expected 0 or 1 rows, got ${rows.length}` } };
      return { data: rows[0] ?? null, error: null };
    }
    // Mutations with no explicit .select() return null data in supabase-js v2.
    if (this.op !== "select" && !this.selectRequested) return { data: null, error: null };
    return { data: rows, error: null };
  }

  then<TR1 = Result<unknown>, TR2 = never>(
    onF?: ((v: Result<unknown>) => TR1 | PromiseLike<TR1>) | null,
    onR?: ((r: unknown) => TR2 | PromiseLike<TR2>) | null,
  ): Promise<TR1 | TR2> {
    return this.run().then(onF, onR);
  }
  catch<TR = never>(onR?: ((r: unknown) => TR | PromiseLike<TR>) | null): Promise<Result<unknown> | TR> {
    return this.run().catch(onR);
  }
}

/* ------------------------------- client -------------------------------- */

export interface PgAdapterClient {
  from(table: string): PgQueryBuilder;
  rpc(fn: string, args?: Record<string, unknown>): Promise<Result<unknown>>;
}

export function createPgAdapterClient(): PgAdapterClient {
  return {
    from(table: string) {
      return new PgQueryBuilder(table);
    },
    async rpc(fn: string, args: Record<string, unknown> = {}) {
      // Not used by the app today; provide a best-effort named-arg call.
      const keys = Object.keys(args);
      const params = keys.map((k) => args[k]);
      const argSql = keys.map((k, i) => `"${k}" => $${i + 1}`).join(", ");
      try {
        const res = await getPool().query(`select * from "${fn}"(${argSql})`, params);
        return { data: res.rows, error: null };
      } catch (e) {
        return { data: null, error: { message: (e as Error).message } };
      }
    },
  };
}

let _client: PgAdapterClient | null = null;
/** Cached singleton adapter (or null when the Postgres env isn't configured). */
export function getPgAdapterClient(): PgAdapterClient | null {
  if (!isPgAdapterConfigured()) return null;
  if (!_client) _client = createPgAdapterClient();
  return _client;
}
