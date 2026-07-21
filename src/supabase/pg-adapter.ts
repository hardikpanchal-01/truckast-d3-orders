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

/** One tenant's Postgres connection, read from env (URL form or discrete fields). */
interface TenantConn {
  url?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}

interface Fk {
  child_table: string;
  child_column: string;
  parent_table: string;
  parent_column: string;
}
interface Meta {
  fks: Fk[];
  cols: Map<string, Set<string>>; // table_name -> column names, for convention joins
}

// Everything is keyed by tenant so we can hold connections to several tenant
// databases (dolese, concretesupply, …) at once and route each query to the one
// the caller selected. Cached on globalThis to survive Next.js hot reloads.
interface PgGlobal {
  registry?: Map<string, TenantConn>;
  pools: Map<string, Pool>;
  metas: Map<string, Promise<Meta>>;
  clients: Map<string, PgAdapterClient>;
}
const g = globalThis as unknown as { __dolesePg?: PgGlobal };
if (!g.__dolesePg) g.__dolesePg = { pools: new Map(), metas: new Map(), clients: new Map() };

/**
 * Discover the configured tenant databases from the environment. A tenant is a
 * `<TENANT>_PG_URL` (preferred) or a `<TENANT>_PG_HOST` (+`_PG_PORT`/`_PG_DATABASE`/
 * `_PG_USER`/`_PG_PASSWORD`) group; the tenant key is the lower-cased prefix, which
 * matches the `selected_tenant` cookie / `auth_tenant.tenants.name`. So adding a
 * tenant is just adding one env var — no code change:
 *   DOLESE_PG_URL=...          ->  tenant "dolese"
 *   CONCRETESUPPLY_PG_URL=...   ->  tenant "concretesupply"
 */
function getRegistry(): Map<string, TenantConn> {
  if (g.__dolesePg!.registry) return g.__dolesePg!.registry;
  const reg = new Map<string, TenantConn>();
  for (const [k, v] of Object.entries(process.env)) {
    if (!v) continue;
    // Tenant keys may contain underscores (e.g. CRH_HARRISON_PG_URL -> "crh_harrison",
    // VCNA_CBM_PG_URL -> "vcna_cbm"); the trailing _PG_URL anchor splits them correctly.
    const m = k.match(/^([A-Z0-9_]+)_PG_URL$/);
    if (m) reg.set(m[1].toLowerCase(), { url: v });
  }
  for (const [k, v] of Object.entries(process.env)) {
    if (!v) continue;
    const m = k.match(/^([A-Z0-9_]+)_PG_HOST$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (reg.has(key)) continue; // a matching *_PG_URL wins over discrete fields
    const P = m[1];
    reg.set(key, {
      host: v,
      port: Number(process.env[`${P}_PG_PORT`] || 5432),
      database: process.env[`${P}_PG_DATABASE`],
      user: process.env[`${P}_PG_USER`],
      password: process.env[`${P}_PG_PASSWORD`],
    });
  }
  g.__dolesePg!.registry = reg;
  return reg;
}

/** The tenant used when a caller doesn't name one (keeps existing single-tenant behavior). */
function defaultTenantKey(): string | null {
  const reg = getRegistry();
  const explicit = process.env.DEFAULT_PG_TENANT?.toLowerCase();
  if (explicit && reg.has(explicit)) return explicit;
  if (reg.has("dolese")) return "dolese"; // historical default
  const first = reg.keys().next();
  return first.done ? null : first.value;
}

// The settings dropdown / `selected_tenant` cookie holds the tenant DISPLAY name
// (auth_tenant.tenants.name, e.g. "Concrete Supply", "Canada Building Materials"),
// which doesn't always equal the database/registry key. Map the ones that differ.
// Keyed by the alphanumeric-normalized display name -> registry key.
const TENANT_ALIASES: Record<string, string> = {
  canadabuildingmaterials: "vcna_cbm",
  concretesupply: "concretesupply",
  deltaindustries: "delta",
  dolesereadymix: "dolese",
  hercules: "hercules",
  preferredmaterials: "pm",
  stevensonweir: "stevensonweir",
  sunrise: "sunrise",
  superiormaterials: "vcna_superior",
};

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Resolve any tenant identifier (registry key, DB name, or the settings display
 * name) to a configured registry key. Returns null when the input doesn't map to
 * a configured tenant; undefined input yields the default tenant.
 * Match order: exact key -> alphanumeric-normalized key -> display-name alias.
 */
function resolveTenantKey(input?: string | null): string | null {
  const reg = getRegistry();
  if (input == null || input === "") return defaultTenantKey();
  const lc = input.toLowerCase();
  if (reg.has(lc)) return lc;
  const norm = normalize(input);
  for (const k of reg.keys()) if (normalize(k) === norm) return k;
  const alias = TENANT_ALIASES[norm];
  if (alias && reg.has(alias)) return alias;
  return null;
}

export function isPgAdapterConfigured(): boolean {
  return getRegistry().size > 0;
}

function getPool(tenant: string): Pool {
  const existing = g.__dolesePg!.pools.get(tenant);
  if (existing) return existing;
  const cfg = getRegistry().get(tenant);
  if (!cfg) throw new Error(`pg-adapter: no Postgres connection configured for tenant "${tenant}"`);
  // The NodePort endpoint presents a self-signed cert, so we encrypt WITHOUT CA
  // verification (matches DBeaver "require"). Newer pg maps a `sslmode=require`
  // query param to `verify-full`, which would override the `ssl` option below and
  // reject the cert — so strip any ssl* query param and drive SSL from `ssl` only.
  const ssl = { rejectUnauthorized: false };
  // Fail fast on an unreachable DB (e.g. a firewalled host from Vercel) instead of
  // hanging on the OS TCP timeout (~2 min) and blowing the serverless function limit —
  // so a blocked deploy surfaces a clear ETIMEDOUT quickly rather than an opaque 504.
  const CONNECT_TIMEOUT_MS = 8000;
  let pool: Pool;
  if (cfg.url) {
    const url = cfg.url.replace(/([?&])(sslmode|ssl)=[^&]*/gi, "$1").replace(/[?&]+$/g, "").replace(/([?&])&+/g, "$1");
    pool = new Pool({ connectionString: url, ssl, max: 8, idleTimeoutMillis: 30000, connectionTimeoutMillis: CONNECT_TIMEOUT_MS });
  } else {
    pool = new Pool({
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password,
      ssl,
      max: 8,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    });
  }
  g.__dolesePg!.pools.set(tenant, pool);
  return pool;
}

/* --------------------------- introspection ----------------------------- */

// FK catalog is per-database, so cache one Meta per tenant.
function ensureMeta(tenant: string): Promise<Meta> {
  const cached = g.__dolesePg!.metas.get(tenant);
  if (cached) return cached;
  const pool = getPool(tenant);
  const p = Promise.all([
    pool.query(
      `select tc.table_name as child_table, kcu.column_name as child_column,
              ccu.table_name as parent_table, ccu.column_name as parent_column
         from information_schema.table_constraints tc
         join information_schema.key_column_usage kcu
           on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
         join information_schema.constraint_column_usage ccu
           on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
        where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'`,
    ),
    // Column catalog — used to resolve embeds by naming convention when a tenant DB
    // has the tables but no declared FKs (the pm-postgres tenant DBs ship no FKs).
    pool.query(
      `select table_name, column_name from information_schema.columns where table_schema = 'public'`,
    ),
  ])
    .then(([fkRes, colRes]) => {
      const cols = new Map<string, Set<string>>();
      for (const r of colRes.rows as { table_name: string; column_name: string }[]) {
        let set = cols.get(r.table_name);
        if (!set) cols.set(r.table_name, (set = new Set()));
        set.add(r.column_name);
      }
      return { fks: fkRes.rows as Fk[], cols };
    })
    .catch((e) => {
      // Reset so a transient failure doesn't permanently poison the cache.
      g.__dolesePg!.metas.delete(tenant);
      throw e;
    });
  g.__dolesePg!.metas.set(tenant, p);
  return p;
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

  // Convention fallback — for tenant DBs that have the tables but NO declared FKs
  // (the pm-postgres cluster ships none). Infer the join from column names, which
  // follow a consistent pattern verified against the old FK-bearing Dolese cluster:
  //   child.<singular(parent)>_id = parent.(<singular(parent)>_id | id)
  // e.g. order_products.order_id = orders.order_id,
  //      order_product_schedules.order_product_id = order_products.id,
  //      ticket_products.ticket_id = tickets.ticket_id
  const singular = (t: string) => t.replace(/s$/, "");
  const has = (t: string, c: string) => meta.cols.get(t)?.has(c) ?? false;
  // parent key column: prefer "<singular>_id" (e.g. orders.order_id), else "id".
  const keyCol = (t: string) => (has(t, `${singular(t)}_id`) ? `${singular(t)}_id` : "id");

  // one-to-many: rel is the child; it carries "<singular(parentTable)>_id".
  const manyFk = `${singular(parentTable)}_id`;
  if (has(rel, manyFk)) {
    const parentKey = keyCol(parentTable);
    return {
      target: rel,
      kind: "many",
      join: (c, p) => `${c}."${manyFk}" = ${p}."${parentKey}"`,
    };
  }
  // many-to-one: parentTable is the child; it carries "<singular(rel)>_id".
  const oneFk = `${singular(rel)}_id`;
  if (has(parentTable, oneFk)) {
    const relKey = keyCol(rel);
    return {
      target: rel,
      kind: "one",
      join: (c, p) => `${c}."${relKey}" = ${p}."${oneFk}"`,
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
  private tenant: string;

  constructor(table: string, tenant: string) {
    this.table = table;
    this.tenant = tenant;
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
    const meta = await ensureMeta(this.tenant);
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
      const res = await getPool(this.tenant).query(sql, params as unknown[]);
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

export function createPgAdapterClient(tenant: string): PgAdapterClient {
  return {
    from(table: string) {
      return new PgQueryBuilder(table, tenant);
    },
    async rpc(fn: string, args: Record<string, unknown> = {}) {
      // Not used by the app today; provide a best-effort named-arg call.
      const keys = Object.keys(args);
      const params = keys.map((k) => args[k]);
      const argSql = keys.map((k, i) => `"${k}" => $${i + 1}`).join(", ");
      try {
        const res = await getPool(tenant).query(`select * from "${fn}"(${argSql})`, params);
        return { data: res.rows, error: null };
      } catch (e) {
        return { data: null, error: { message: (e as Error).message } };
      }
    },
  };
}

/** List the tenant keys that have a Postgres connection configured. */
export function getConfiguredPgTenants(): string[] {
  return [...getRegistry().keys()];
}

/**
 * Cached adapter client for a tenant's Postgres database.
 *  - `getPgAdapterClient()`              -> the default tenant (backward compatible).
 *  - `getPgAdapterClient("concretesupply")` -> that tenant, or `null` if it has no
 *    connection configured (so the caller can fall back).
 * Returns `null` when no tenant Postgres is configured at all.
 */
export function getPgAdapterClient(tenant?: string): PgAdapterClient | null {
  const reg = getRegistry();
  if (reg.size === 0) return null;
  const key = resolveTenantKey(tenant); // accepts registry key, DB name, or display name
  if (!key) return null; // named tenant isn't configured -> caller can fall back
  let client = g.__dolesePg!.clients.get(key);
  if (!client) {
    client = createPgAdapterClient(key);
    g.__dolesePg!.clients.set(key, client);
  }
  return client;
}
