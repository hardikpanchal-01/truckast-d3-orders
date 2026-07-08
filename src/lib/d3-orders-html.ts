import { readFile } from "fs/promises";
import { join } from "path";
import type { DoleseOrderListItem, OrderStatus } from "@/actions/orderActions";

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
  // Cancelled / On-Hold → red (per the D3 JOBS HELP).
  if (o.status === "CANCELED" || ds === "Cancelled" || ds === "Hold") return TILE_RED;
  // Pre-Pour: a FIRM (committed) order is green; a WILL-CALL order is yellow.
  // "Active" is a firm/confirmed state too, so it's green alongside "Firm".
  if (o.status === "PRE_POUR") return ds === "Firm" || ds === "Active" ? TILE_GREEN : TILE_YELLOW;
  // Completed orders are always green in D3 (a finished pour, regardless of the speed
  // it ran at) — verified against the JobsForFixedNodeID export.
  if (o.status === "COMPLETED") return TILE_GREEN;
  // In-Process: by poured speed vs planned (≥90 green, 60–89 yellow, <60 red).
  const pct = o.pour_pct;
  if (pct == null) return TILE_GREEN;
  if (pct >= 90) return TILE_GREEN;
  if (pct >= 60) return TILE_YELLOW;
  return TILE_RED;
}

// Concrete is ordered in half-yard increments, so D3 shows CY to the nearest 0.50
// (e.g. 294.00, 73.50). Round to kill float artifacts like 294.01 / 73.51.
const cyLabel = (cy: number) => (Math.round(cy * 2) / 2).toFixed(2);

function md(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()}`;
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
  // Pie fill = volume delivered ÷ volume ordered (per the D3 JOBS HELP), NOT the
  // speed % (that only drives the colour).
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
    `</div></div></div></div>`
  );
}

/* ---- fuel-surcharge promo tile (D3's exact first cell) ---- */
function fuelTile(): string {
  return (
    `<div class="tile" style="position: relative; background-color: red; cursor: pointer; display: block;" ` +
    `onclick="window.top.location.href='/fuel-surcharges'">` +
    `<img src="${ASSET}/dogear.png" style="position: absolute; right: 0px; bottom: 0px; ">` +
    `<div class="tileContainer"><div class="tileIcon"><img src="${ASSET}/DOLESEPUBLISH.PNG"></div>` +
    `<div class="tileInfoSection"><div class="tileCell">` +
    `<div class="tileSuperTitle">June 29th thru July 3rd, 2026</div>` +
    `<div class="tileTitle">Current Fuel Surcharge</div>` +
    `<div class="tileSubTitle">$25.00 per load *Click for Details</div>` +
    `</div></div></div></div>`
  );
}

/** The order-tiles markup (fuel promo + one tile per order) — also served
 *  on its own from /api/orders-tiles so the client can re-render it live. */
export function renderTiles(orders: DoleseOrderListItem[]): string {
  return fuelTile() + orders.map(orderTile).join("");
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
