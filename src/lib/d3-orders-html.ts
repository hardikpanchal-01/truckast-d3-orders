import { readFile } from "fs/promises";
import { join } from "path";
import type { DoleseOrderListItem, OrderStatus, DoleseAnnouncement } from "@/actions/orderActions";

/* ------------------------------------------------------------------ */
/*  Hybrid renderer: takes the EXACT D3 export (public/d3-static/       */
/*  orders.html + its real JobsForFixedNodeID_files assets) as the      */
/*  shell, and swaps in LIVE data — the order tiles, the plant total    */
/*  and the download date — so the page is byte-faithful to D3 *and*    */
/*  reflects the current database on every request.                     */
/* ------------------------------------------------------------------ */

const TEMPLATE_PATH = join(process.cwd(), "public", "d3-static", "orders.html");
const ASSET = "/d3-static/JobsForFixedNodeID_files";

const STATUS_LABEL: Record<OrderStatus, string> = {
  IN_PROCESS: "IN PROCESS",
  PRE_POUR: "PRE-POUR",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELLED",
};

// D3 gives a held order (dispatch "Hold") its own red "(ON HOLD)" super-title label
// rather than "(PRE-POUR)" — verified against the D3 export (e.g. 22702, 22501, 48302
// all read "… CY (ON HOLD)"). The order still lives in the PRE_POUR bucket (no ticket
// activity yet), so only the tile label differs; colour + calendar icon already match.
function statusLabel(o: DoleseOrderListItem): string {
  if (o.status === "PRE_POUR" && o.dispatch_status === "Hold") return "ON HOLD";
  return STATUS_LABEL[o.status];
}

// D3's exact tile background colours.
const TILE_GREEN = "rgb(69, 139, 0)";
const TILE_YELLOW = "rgb(247, 187, 0)";
const TILE_RED = "rgb(196, 57, 38)";

function tileColor(o: DoleseOrderListItem): string {
  const ds = o.dispatch_status;
  // D3 JOBS HELP colour spec:
  //   Red    — a Cancelled order, or one On Hold.
  //   Green  — a Firm order while Pre-Pour; OR ≥90% of planned poured-speed In Process/Complete.
  //   Yellow — a Will-Call order while Pre-Pour; OR 60–89% of planned poured-speed In Process/Complete.
  //   Red    — <60% of planned poured-speed In Process/Complete.
  if (o.status === "CANCELED" || ds === "Cancelled" || ds === "Hold") return TILE_RED;
  // Pre-Pour: a FIRM (committed) order is green; a WILL-CALL order is yellow.
  // "Active" is a firm/confirmed state too, so it's green alongside "Firm".
  if (o.status === "PRE_POUR") return ds === "Firm" || ds === "Active" ? TILE_GREEN : TILE_YELLOW;
  // In-Process AND Complete: colour by poured speed as a % of the planned delivery rate
  // (o.pour_pct). Before any load has poured out there's no speed yet → on-track (green).
  const pct = o.pour_pct;
  if (pct == null) return TILE_GREEN;
  if (pct >= 90) return TILE_GREEN;
  if (pct >= 60) return TILE_YELLOW;
  return TILE_RED;
}

// Concrete is ordered in half-yard increments, so D3 shows CY to the nearest 0.50
// (e.g. 294.00, 73.50). Round to kill float artifacts like 294.01 / 73.51.
const cyLabel = (cy: number) => (Math.round(cy * 2) / 2).toFixed(2);

// order_date is a CST clock value stored in a UTC field → read UTC parts (same convention
// as startLabel). Using LOCAL getMonth/getDate rolled late-in-the-day orders (e.g. a
// 19:00 UTC order) to the next calendar day on machines ahead of UTC — showing "7/11" for
// a 7/10 order. UTC parts keep the date stable regardless of the server's timezone.
function md(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

// start_time is a CST clock value stored in a UTC field → read UTC parts as HH:MM.
function startLabel(t: string | null): string {
  if (!t) return "";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---- In-Process progress pie (poured ÷ ordered volume) — a Highcharts MOUNT point,
 *      72x80 to match the Scheduled/Cancelled PNGs. D3 draws these pies with
 *      Highcharts, so we do the same: the server only emits an empty container plus
 *      the poured percentage, and the client (orders-live.js) renders a Highcharts
 *      pie into every .d3-pie once the tiles are injected. That gives the native
 *      draw-in animation, D3's two translucent-white slices, a soft drop shadow and
 *      the hover halo ("blur ring") — all configured client-side. Shown for
 *      In-Process orders. ---- */
function pieMount(pct: number): string {
  const used = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  return `<div class="d3-pie" data-pct="${used.toFixed(2)}" style="width:72px;height:80px"></div>`;
}

/* ---- one order tile, in D3's exact markup. Icon by status, per the D3 JOBS
 *      HELP spec: Pre-Pour → calendar, In-Process → pie (poured÷ordered),
 *      Complete → check, Cancelled → circle-with-slash. Only Pre-Pour (not yet
 *      started) shows the scheduled start time in the title. ---- */
function orderTile(o: DoleseOrderListItem): string {
  const isCancelled = o.status === "CANCELED";
  const isPie = o.status === "IN_PROCESS";
  const isComplete = o.status === "COMPLETED";
  const isPrePour = o.status === "PRE_POUR";
  const superTitle = `${o.order_code}-${md(o.order_date)}: ${cyLabel(o.ordered_cy)} CY (${statusLabel(o)})`;
  const start = isPrePour ? startLabel(o.start_time) : "";
  const addr = o.delivery_addr1 || o.project_name || "";
  const title = `${start} ${addr}`.trim().toUpperCase();
  const subTitle = (o.customer_name || "").toUpperCase();
  // D3 shows the project / jobsite name as a 4th tile line under the customer (e.g.
  // "DOLLAR TREE DISTRIBUTION CENTER"). Omit it when empty, or when the title already fell
  // back to the project because delivery_addr1 was blank (avoids showing it twice).
  const projectRaw = (o.project_name || "").trim();
  const project = projectRaw && projectRaw.toUpperCase() !== addr.toUpperCase() ? projectRaw.toUpperCase() : "";
  // Pie fill = volume POURED ÷ volume ordered — D3's definition ("the total volume poured
  // divided by the volume ordered"), NOT delivered/ticketed and NOT the speed %. o.poured_cy
  // already includes the stale-stamp recovery (loads on the job long enough to have poured
  // but missing their pour-out stamp in our mirror), so a fully-delivered-but-still-pouring
  // order like 40502 reads its real poured fraction instead of a misleading 100%.
  const pourFrac = o.ordered_cy > 0 ? (o.poured_cy / o.ordered_cy) * 100 : 0;
  const icon = isCancelled
    ? `<div class="tileIcon"><img src="${ASSET}/Cancelled.png"></div>`
    : isComplete
      ? `<div class="tileIcon"><img src="${ASSET}/Completed.png"></div>`
      : isPie
        ? `<div class="tileIcon">${pieMount(pourFrac)}</div>`
        : `<div class="tileIcon"><img src="${ASSET}/Scheduled.png"></div>`;
  return (
    `<div class="tile" style="position: relative; background-color: ${tileColor(o)}; cursor: pointer; display: block;" ` +
    `onclick="window.top.location.href='/orders/${esc(o.order_id)}'">` +
    `<img src="${ASSET}/dogear.png" style="position: absolute; right: 0px; bottom: 0px; ">` +
    `<div class="tileContainer">${icon}<div class="tileInfoSection"><div class="tileCell">` +
    `<div class="tileSuperTitle">${esc(superTitle)}</div>` +
    `<div class="tileTitle">${esc(title)}</div>` +
    `<div class="tileSubTitle">${esc(subTitle)}</div>` +
    (project ? `<div class="tileSubTitle">${esc(project)}</div>` : "") +
    `</div></div></div></div>`
  );
}

/* ---- fuel-surcharge / announcement promo tile (D3's exact first cell) ----
 * Driven by the live `announcements` row (getActiveAnnouncement). Renders nothing
 * when no promo is published/active today, so the tile is never stale. */
function fuelTile(ann?: DoleseAnnouncement | null): string {
  if (!ann) return "";
  const bg = (ann.color || "red").trim().toLowerCase();
  return (
    `<div class="tile" style="position: relative; background-color: ${esc(bg)}; cursor: pointer; display: block;" ` +
    `onclick="window.top.location.href='/fuel-surcharges'">` +
    `<img src="${ASSET}/dogear.png" style="position: absolute; right: 0px; bottom: 0px; ">` +
    `<div class="tileContainer"><div class="tileIcon"><img src="${ASSET}/DOLESEPUBLISH.PNG"></div>` +
    `<div class="tileInfoSection"><div class="tileCell">` +
    `<div class="tileSuperTitle">${esc(ann.tagline || "")}</div>` +
    `<div class="tileTitle">${esc(ann.title || "")}</div>` +
    `<div class="tileSubTitle">${esc(ann.subtitle || "")}</div>` +
    `</div></div></div></div>`
  );
}

/** The order-tiles markup (fuel promo + one tile per order) — also served
 *  on its own from /api/orders-tiles so the client can re-render it live. */
export function renderTiles(orders: DoleseOrderListItem[], announcement?: DoleseAnnouncement | null): string {
  return fuelTile(announcement) + orders.map(orderTile).join("");
}

export async function buildOrdersHtml(): Promise<string> {
  let html = await readFile(TEMPLATE_PATH, "utf8");

  // The template (public/d3-static/orders.html) is now self-dynamic: it ships an
  // empty tiles container + JS-filled total/date spans + a client script that
  // fetches /api/orders-tiles and /api/orders-summary live. Served at /orders
  // (path "/orders"), the only server-side change needed is to absolutize the
  // relative "./JobsForFixedNodeID_files/" asset paths so the CSS/JS/images
  // resolve. Opened directly at /d3-static/orders.html the relative paths already
  // resolve, so the same file is live either way.
  html = html.split("./JobsForFixedNodeID_files/").join(ASSET + "/");

  return html;
}
