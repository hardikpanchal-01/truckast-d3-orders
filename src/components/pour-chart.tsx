"use client";

import * as React from "react";
import { useState } from "react";

type XY = { t: number; v: number; ts?: string };

export interface ChartData {
  tMin: number;
  tMax: number;
  ordered: number; // Scheduled delivery rate (CY/HR)
  orderedPoints: XY[]; // Points at each scheduled truck arrival
  delivered: XY[]; // Delivered rate (CY/HR) at each arrival
  poured: XY[]; // Poured rate (CY/HR) at each pour completion
  trucks: { t: number; waiting: number; pouring: number; ts?: string }[];
}

/** minutes-of-day -> "H:MM" (matches the live app's axis labels). */
function fmtT(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Tooltip header like the live app: "Thursday, Jul 2, 02:42:42".
 *  ts is a CST-clock value stored in a UTC field, so read UTC parts. Falls back to H:MM. */
function fmtTooltipTime(ts: string | undefined, t: number): string {
  if (ts) {
    const d = new Date(ts);
    if (!Number.isNaN(d.getTime())) {
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const mm = String(d.getUTCMinutes()).padStart(2, "0");
      const ss = String(d.getUTCSeconds()).padStart(2, "0");
      return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${hh}:${mm}:${ss}`;
    }
  }
  return fmtT(t);
}

/** Number formatting that trims trailing zeros, like Highcharts (79, 61.8, 38.73). */
function fmtVal(v: number): string {
  return String(Math.round(v * 100) / 100);
}

/* ------------------------------------------------------------------ */
/*  Dynamic x-axis ticks (mirrors Highcharts' datetime auto-ticking)   */
/* ------------------------------------------------------------------ */

// Allowed "nice" step sizes in MINUTES, from seconds up to days, so the gap adapts
// dynamically at every zoom level: 1/2/5/10/15/30 sec → 1/2/5/10/15/30 min →
// 1/2/3/4/6/8/12 hr → days.
const SEC = 1 / 60;
const NICE_MIN_STEPS = [
  SEC, 2 * SEC, 5 * SEC, 10 * SEC, 15 * SEC, 30 * SEC,
  1, 2, 5, 10, 15, 30,
  60, 120, 180, 240, 360, 480, 720, 1440,
];
// Denser than Highcharts' 100px default (~one tick per 70px) so the gap matches D3 for
// these spans: ~15-min for a ~3.5h pour, ~30-min for a ~6h pour (instead of jumping to 60).
const TICK_PIXEL_INTERVAL = 70;

/**
 * Choose x-axis tick times the way Highcharts does, dynamically for any span:
 *   targetTicks = widthPx / TICK_PIXEL_INTERVAL  →  rough = span / targetTicks  →
 *   snap UP to a nice step. Returns the chosen step too so labels know whether to show
 *   seconds. Ticks are aligned to nice clock boundaries for that step.
 */
function buildTimeTicks(tMin: number, tMax: number, widthPx: number): { ticks: number[]; step: number } {
  const span = Math.max(SEC, tMax - tMin);
  const target = Math.max(2, Math.round(widthPx / TICK_PIXEL_INTERVAL));
  const rough = span / target;
  const step = NICE_MIN_STEPS.find((s) => s >= rough) ?? NICE_MIN_STEPS[NICE_MIN_STEPS.length - 1];
  const first = Math.ceil(tMin / step - 1e-6) * step;
  const ticks: number[] = [];
  for (let t = first; t <= tMax + step * 1e-6; t += step) ticks.push(t);
  return { ticks, step };
}

/** Format a minutes-of-day tick, including seconds only when the step is sub-minute. */
function fmtTick(min: number, step: number): string {
  const totalSec = Math.round(min * 60);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return step < 1 ? `${hh}:${mm}:${String(s).padStart(2, "0")}` : `${hh}:${mm}`;
}

/** Track an SVG element's rendered pixel width (for pixel-accurate tick density). */
function useRenderedWidth(ref: React.RefObject<SVGSVGElement | null>): number {
  // Default matches the viewBox so SSR and first client render agree (no hydration mismatch).
  const [w, setW] = React.useState(900);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(el.getBoundingClientRect().width || 900);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** Round a max value up to a "nice" axis maximum (1/2/5 × 10ⁿ), like Highcharts. */
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

/** Snap a rough interval to a "nice" number (1/2/2.5/5/10 × 10ⁿ) — Highcharts' allowed
 *  y-axis steps. The 2.5 case is why the live Trucks chart shows 0/2.5/5/7.5. */
function niceTickInterval(rough: number): number {
  if (rough <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * pow;
}

const COL = {
  delivered: "#2b2b2b",
  poured: "#7ac043",
  ordered: "#5aa0e6",
  grid: "#e3e3e3",
  axis: "#606060", // matches D3's axis label colour
};

// The exact font stack the live D3 charts use (Highcharts 4.x default).
const FONT = '"Lucida Grande", "Lucida Sans Unicode", Arial, Helvetica, sans-serif';

interface TooltipData {
  x: number;
  y: number;
  align: Align;
  type: "ordered" | "delivered" | "poured";
  time: string;
  value: number;
  index: number;
}

interface TruckTooltipData {
  x: number;
  y: number;
  align: Align;
  t: number; // hovered point's x-value (minutes-of-day) — drives the crosshair + marker
  stack: number; // stacked value at the marker (pouring top, or total for Waiting)
  time: string;
  label: "Waiting" | "Pouring"; // a single series per tooltip, like D3 (never merged)
  value: number;
  color: string;
}

/* ------------------------------------------------------------------ */
/*  Click-and-drag horizontal zoom (mirrors Highcharts zoomType: 'x')  */
/* ------------------------------------------------------------------ */

interface Zoom {
  vMin: number;
  vMax: number;
  zoomed: boolean;
  sel: { x0: number; x1: number } | null; // active drag selection, in SVG x coords
  dragging: React.RefObject<boolean>;
  onDown: (e: React.MouseEvent) => void;
  onMove: (e: React.MouseEvent) => void;
  onUp: () => void;
  reset: () => void;
}

function useZoom(
  svgRef: React.RefObject<SVGSVGElement | null>,
  fullMin: number,
  fullMax: number,
  W: number,
  padLeft: number,
  innerW: number,
): Zoom {
  const [zoom, setZoom] = React.useState<{ min: number; max: number } | null>(null);
  const [sel, setSel] = React.useState<{ x0: number; x1: number } | null>(null);
  const dragging = React.useRef(false);

  const vMin = zoom ? zoom.min : fullMin;
  const vMax = zoom ? zoom.max : fullMax;

  const toSvgX = (clientX: number): number | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const raw = ((clientX - rect.left) / rect.width) * W;
    return Math.max(padLeft, Math.min(padLeft + innerW, raw));
  };
  const toTime = (sx: number) => vMin + ((sx - padLeft) / innerW) * (vMax - vMin);

  const onDown = (e: React.MouseEvent) => {
    const sx = toSvgX(e.clientX);
    if (sx == null) return;
    dragging.current = true;
    setSel({ x0: sx, x1: sx });
  };
  const onMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    const sx = toSvgX(e.clientX);
    if (sx == null) return;
    setSel((s) => (s ? { ...s, x1: sx } : null));
  };
  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (sel && Math.abs(sel.x1 - sel.x0) > 4) {
      const a = toTime(Math.min(sel.x0, sel.x1));
      const b = toTime(Math.max(sel.x0, sel.x1));
      if (b - a > 0.001) setZoom({ min: a, max: b });
    }
    setSel(null);
  };
  const reset = () => setZoom(null);

  return { vMin, vMax, zoomed: zoom != null, sel, dragging, onDown, onMove, onUp, reset };
}

function ChartFrame({
  title,
  subtitle = "Click and drag in the plot area to zoom in",
  onReset,
  children,
}: {
  title: string;
  subtitle?: string;
  onReset?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1" style={{ fontFamily: FONT }}>
      {/* Match D3's Highcharts SVG: title 18px normal #333, subtitle 12px #555. */}
      <p className="text-center text-[18px] font-normal text-[#333]">{title}</p>
      <p className="text-center text-xs text-[#555]">{subtitle}</p>
      {/* overflow-visible so a tooltip near an edge is never clipped by the frame. */}
      <div className="relative w-full overflow-visible bg-white">
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="absolute right-2 top-1 z-40 rounded border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs text-gray-700 shadow-sm hover:bg-gray-200"
          >
            Reset zoom
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

type Align = "left" | "center" | "right";

/** Tooltip caret: points down when the box is above the point, up when below, and sits
 *  at the horizontal spot that lines up with the data point for the box's alignment.
 *  Border colour = the series colour (like D3), front = the box background. */
function TooltipCaret({
  below,
  align = "center",
  color = "#d1d5db",
  bg = "rgba(249,249,249,0.85)",
}: {
  below: boolean;
  align?: Align;
  color?: string;
  bg?: string;
}) {
  const side = below ? "bottom-full" : "top-full";
  const edge = below ? "borderBottom" : "borderTop";
  // Matches the box transform offsets (12px = left-3 / right-3) so it points at the point.
  const hpos = align === "left" ? "left-3" : align === "right" ? "right-3" : "left-1/2 -translate-x-1/2";
  return (
    <>
      <span className={`absolute h-0 w-0 ${side} ${hpos}`} style={{ borderLeft: "7px solid transparent", borderRight: "7px solid transparent", [edge]: `7px solid ${color}` }} />
      <span
        className={`absolute h-0 w-0 ${side} ${hpos}`}
        style={{ [below ? "marginBottom" : "marginTop"]: -1, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", [edge]: `6px solid ${bg}` }}
      />
    </>
  );
}

/** Horizontal transform that keeps the box on-screen: centered, or anchored 12px past
 *  the point when near an edge (so the caret still lines up with the point). */
function alignTransform(align: Align, below: boolean): string {
  const xf = align === "left" ? "translateX(-12px)" : align === "right" ? "translateX(calc(-100% + 12px))" : "translateX(-50%)";
  return `${xf} ${below ? "translateY(0)" : "translateY(-100%)"}`;
}

function Legend({
  items,
  hidden,
  onToggle,
}: {
  items: { label: string; color: string; box?: boolean }[];
  hidden?: Set<string>;
  onToggle?: (label: string) => void;
}) {
  return (
    <div className="flex justify-center gap-5 pt-1 text-xs font-bold text-[#333]" style={{ fontFamily: FONT }}>
      {items.map((it) => {
        const off = hidden?.has(it.label) ?? false;
        return (
          <button
            type="button"
            key={it.label}
            onClick={() => onToggle?.(it.label)}
            // Click to toggle the series (like Highcharts); hidden items dim + strike through.
            className={[
              "flex items-center gap-1",
              onToggle ? "cursor-pointer" : "cursor-default",
              off ? "text-slate-400 line-through" : "",
            ].join(" ")}
          >
            <span
              className={it.box ? "inline-block h-2 w-3" : "inline-block h-2 w-2 rounded-full"}
              style={{ backgroundColor: off ? "#c4c4c4" : it.color }}
            />
            &quot;{it.label}&quot;
          </button>
        );
      })}
    </div>
  );
}

function Tooltip({ data }: { data: TooltipData | null }) {
  if (!data) return null;

  // Matches the live app's Highcharts tooltip: series name in quotes, raw value, no unit.
  const typeLabels = {
    ordered: "Ordered",
    delivered: "Delivered",
    poured: "Poured",
  };

  const colors = {
    ordered: COL.ordered,
    delivered: COL.delivered,
    poured: COL.poured,
  };

  // Flip below the point when there isn't room above (keeps it from clipping the top).
  const below = data.y < 90;
  return (
    <div
      className="pointer-events-none absolute z-50"
      style={{
        left: data.x,
        top: below ? data.y + 12 : data.y - 12,
        transform: alignTransform(data.align, below),
      }}
    >
      <div
        className="relative whitespace-nowrap rounded border px-2 py-1.5 shadow-md"
        style={{ backgroundColor: "rgba(249,249,249,0.85)", borderColor: colors[data.type] }}
      >
        <div className="text-[10px] text-[#333]">{data.time}</div>
        <div className="mt-0.5 flex items-center gap-1 text-[12px] text-[#333]">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: colors[data.type] }} />
          <span>
            &quot;{typeLabels[data.type]}&quot;: <span className="font-bold">{fmtVal(data.value)}</span>
          </span>
        </div>
        <TooltipCaret below={below} align={data.align} color={colors[data.type]} />
      </div>
    </div>
  );
}

function TruckTooltip({ data }: { data: TruckTooltipData | null }) {
  if (!data) return null;

  // Flip below the point when there isn't room above (keeps it from clipping the top).
  const below = data.y < 90;
  // Dot colour: the darker readable green for Pouring so it stays legible on white.
  const dot = data.label === "Pouring" ? "#90ed7d" : "#434348";
  return (
    <div
      className="pointer-events-none absolute z-50"
      style={{
        left: data.x,
        top: below ? data.y + 12 : data.y - 12,
        transform: alignTransform(data.align, below),
      }}
    >
      <div
        className="relative whitespace-nowrap rounded border px-2 py-1.5 shadow-md"
        style={{ backgroundColor: "rgba(249,249,249,0.85)", borderColor: dot }}
      >
        <div className="text-[10px] text-[#333]">{data.time}</div>
        <div className="mt-0.5 flex items-center gap-1 text-[12px] text-[#333]">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />
          <span>&quot;{data.label}&quot;: <span className="font-bold">{data.value}</span></span>
        </div>
        <TooltipCaret below={below} align={data.align} color={dot} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pour Speed (CY/HR): Delivered / Poured / Ordered                   */
/* ------------------------------------------------------------------ */

export function PourChart({ data }: { data: ChartData }) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const svgRef = React.useRef<SVGSVGElement>(null);
  const chartW = useRenderedWidth(svgRef);
  const clipId = React.useId();
  const toggle = (label: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(label)) n.delete(label);
      else n.add(label);
      return n;
    });
  // Fade a series in/out on toggle (and stop it capturing hover when hidden).
  const fade = (label: string): React.CSSProperties => ({
    transition: "opacity 550ms ease",
    opacity: hidden.has(label) ? 0 : 1,
    pointerEvents: hidden.has(label) ? "none" : "auto",
  });

  const W = 900;
  // Short/wide plot (~10:1) so it looks stretched horizontally like the D3 chart.
  const H = 122;
  const pad = { top: 16, right: 20, bottom: 26, left: 40 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  // X-axis spans only the actual pour window (delivered/poured + the server's
  // scheduled-start anchor in data.tMin/tMax). We deliberately DO NOT stretch the
  // axis to the last scheduled "Ordered" point — the live app clips those to the
  // data window instead of leaving a large empty right margin.
  const dataTimes = [
    ...data.delivered.map((p) => p.t),
    ...data.poured.map((p) => p.t),
  ];
  const tMin = dataTimes.length > 0 ? Math.min(data.tMin, ...dataTimes) : data.tMin;
  const tMax = dataTimes.length > 0 ? Math.max(data.tMax, ...dataTimes) : data.tMax;

  // Drag-to-zoom on the x-axis (all hooks must run before the early return).
  const zoom = useZoom(svgRef, tMin, tMax, W, pad.left, innerW);

  const hasData = data.delivered.length > 0 || data.poured.length > 0 || data.orderedPoints.length > 0;
  if (!hasData) {
    return (
      <ChartFrame title="Pour Speed (CY/HR)">
        <p className="py-10 text-center text-sm text-slate-400">No pour data yet for this order.</p>
      </ChartFrame>
    );
  }

  // Visible x-window = the current zoom range (or the full data range).
  const vMin = zoom.vMin;
  const vMax = zoom.vMax;
  const tSpan = Math.max(1, vMax - vMin);

  // Only render scheduled "Ordered" markers that fall inside the full window; the
  // clipPath trims anything outside the zoomed viewport.
  const visibleOrdered = data.orderedPoints.filter((p) => p.t >= tMin && p.t <= tMax);

  const dataMax = Math.max(
    data.ordered,
    ...data.delivered.map((p) => p.v),
    ...data.poured.map((p) => p.v),
    1
  );
  const maxY = niceMax(dataMax);

  // Inset the data by a few px on each side (like Highcharts' axis padding) so the first
  // and last points aren't flush against the plot edge / clipped. Gridlines stay full width.
  const XPAD = 12;
  const x = (t: number) => pad.left + XPAD + ((t - vMin) / tSpan) * (innerW - 2 * XPAD);
  const y = (v: number) => pad.top + innerH - (v / maxY) * innerH;

  // Smooth (monotone cubic) curve through the points — no overshoot at sharp dips/peaks.
  const linePath = (pts: XY[]) => {
    const P = pts.map((p) => ({ x: x(p.t), y: y(p.v) }));
    const n = P.length;
    if (n < 3) return P.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const dx: number[] = [];
    const slope: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      dx[i] = P[i + 1].x - P[i].x;
      slope[i] = dx[i] !== 0 ? (P[i + 1].y - P[i].y) / dx[i] : 0;
    }
    const m: number[] = new Array(n);
    m[0] = slope[0];
    m[n - 1] = slope[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (slope[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / slope[i];
      const b = m[i + 1] / slope[i];
      const s = a * a + b * b;
      if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * slope[i]; m[i + 1] = t * b * slope[i]; }
    }
    let d = `M ${P[0].x} ${P[0].y}`;
    for (let i = 0; i < n - 1; i++) {
      d += ` C ${P[i].x + dx[i] / 3} ${P[i].y + (m[i] * dx[i]) / 3}, ${P[i + 1].x - dx[i] / 3} ${P[i + 1].y - (m[i + 1] * dx[i]) / 3}, ${P[i + 1].x} ${P[i + 1].y}`;
    }
    return d;
  };

  const yTicks = [0, maxY / 2, maxY];
  // Dynamic "nice" ticks (sec/min/hr) based on span + rendered width, like Highcharts.
  const { ticks: xTicks, step: xStep } = buildTimeTicks(vMin, vMax, chartW);

  const handleMouseEnter = (type: "ordered" | "delivered" | "poured", point: XY, index: number) => {
    if (!svgRef.current || zoom.dragging.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = x(point.t);
    const svgY = y(point.v);
    // Convert SVG coordinates to DOM coordinates
    const domX = (svgX / W) * rect.width;
    const domY = (svgY / H) * rect.height;
    // Near an edge, anchor the box left/right so it never overflows or shrink-wraps.
    const align: Align = domX > rect.width - 120 ? "right" : domX < 120 ? "left" : "center";

    setTooltip({
      x: domX,
      y: domY,
      align,
      type,
      time: fmtTooltipTime(point.ts, point.t),
      value: point.v,
      index,
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  return (
    <>
      <ChartFrame title="Pour Speed (CY/HR)" onReset={zoom.zoomed ? zoom.reset : undefined}>
        <Tooltip data={tooltip} />
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full cursor-crosshair select-none"
          preserveAspectRatio="xMidYMid meet"
          onMouseDown={(e) => { setTooltip(null); zoom.onDown(e); }}
          onMouseMove={zoom.onMove}
          onMouseUp={zoom.onUp}
          onMouseLeave={() => { zoom.onUp(); handleMouseLeave(); }}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={pad.left} y={pad.top} width={innerW} height={innerH} />
            </clipPath>
          </defs>
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={pad.left} y1={y(t)} x2={W - pad.right} y2={y(t)} stroke={COL.grid} />
              <text x={pad.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill={COL.axis}>
                {t}
              </text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <text key={i} x={x(t)} y={H - 8} textAnchor="middle" fontSize="11" fill={COL.axis}>
              {fmtTick(t, xStep)}
            </text>
          ))}

          <g clipPath={`url(#${clipId})`}>
          {/* Each series stays mounted and fades via opacity so toggling animates.
              Hidden series also drop pointer events so they're not hoverable. */}
          {/* Poured: green line with circle markers */}
          <g style={fade("Poured")}>
            {data.poured.length > 0 && (
              <>
                <path d={linePath(data.poured)} fill="none" stroke={COL.poured} strokeWidth={2} />
                {data.poured.map((p, i) => (
                  <g key={`pour-${i}`}>
                    <circle cx={x(p.t)} cy={y(p.v)} r={3} fill={COL.poured} />
                    <circle
                      cx={x(p.t)}
                      cy={y(p.v)}
                      r={10}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => handleMouseEnter("poured", p, i)}
                      onMouseLeave={handleMouseLeave}
                    />
                  </g>
                ))}
              </>
            )}
          </g>

          {/* Delivered: black line with circle markers */}
          <g style={fade("Delivered")}>
            {data.delivered.length > 0 && (
              <>
                <path d={linePath(data.delivered)} fill="none" stroke={COL.delivered} strokeWidth={2} />
                {data.delivered.map((p, i) => (
                  <g key={`del-${i}`}>
                    <circle cx={x(p.t)} cy={y(p.v)} r={3} fill={COL.delivered} />
                    <circle
                      cx={x(p.t)}
                      cy={y(p.v)}
                      r={10}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => handleMouseEnter("delivered", p, i)}
                      onMouseLeave={handleMouseLeave}
                    />
                  </g>
                ))}
              </>
            )}
          </g>

          {/* Ordered drawn LAST so the blue line + squares sit ON TOP of the Delivered
              dots (where the black line touches the ordered rate). */}
          <g style={fade("Ordered")}>
            {visibleOrdered.length > 0 && (
              <line
                x1={x(visibleOrdered[0].t)}
                y1={y(data.ordered)}
                x2={x(visibleOrdered[visibleOrdered.length - 1].t)}
                y2={y(data.ordered)}
                stroke={COL.ordered}
                strokeWidth={2}
              />
            )}
            {visibleOrdered.map((p, i) => (
              <g key={`ord-${i}`}>
                <rect x={x(p.t) - 3} y={y(p.v) - 3} width={6} height={6} fill={COL.ordered} />
                <rect
                  x={x(p.t) - 10}
                  y={y(p.v) - 10}
                  width={20}
                  height={20}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => handleMouseEnter("ordered", p, i)}
                  onMouseLeave={handleMouseLeave}
                />
              </g>
            ))}
          </g>
          </g>

          {/* Drag selection rectangle while zooming */}
          {zoom.sel && (
            <rect
              x={Math.min(zoom.sel.x0, zoom.sel.x1)}
              y={pad.top}
              width={Math.abs(zoom.sel.x1 - zoom.sel.x0)}
              height={innerH}
              fill="#5aa0e6"
              fillOpacity={0.2}
            />
          )}
        </svg>
      </ChartFrame>
      <Legend
        items={[
          { label: "Delivered", color: COL.delivered },
          { label: "Poured", color: COL.poured },
          { label: "Ordered", color: COL.ordered, box: true },
        ]}
        hidden={hidden}
        onToggle={toggle}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Trucks on the Job: Waiting (gray) + Pouring (green) step areas      */
/* ------------------------------------------------------------------ */

export function TrucksChart({ data }: { data: ChartData }) {
  const [tooltip, setTooltip] = useState<TruckTooltipData | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const svgRef = React.useRef<SVGSVGElement>(null);
  const chartW = useRenderedWidth(svgRef);
  const clipId = React.useId();
  const toggle = (label: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(label)) n.delete(label);
      else n.add(label);
      return n;
    });

  const W = 900;
  // Shorter than the Pour chart so the 0/2.5/5/7.5 gridlines sit closer together
  // (a compact height like the live app), instead of tall, widely-spaced bands.
  const H = 165;
  const pad = { top: 16, right: 20, bottom: 26, left: 40 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  // Drag-to-zoom on the x-axis (all hooks must run before the early return).
  const zoom = useZoom(svgRef, data.tMin, data.tMax, W, pad.left, innerW);

  const pts = data.trucks;
  if (pts.length === 0) {
    return (
      <ChartFrame title="Trucks on the Job">
        <p className="py-10 text-center text-sm text-slate-400">No truck activity yet for this order.</p>
      </ChartFrame>
    );
  }

  // Visible x-window = current zoom range (or the full data range).
  const vMin = zoom.vMin;
  const vMax = zoom.vMax;
  const tMin = vMin;
  const tSpan = Math.max(1, vMax - vMin);
  const rawMax = Math.max(1, ...pts.map((p) => p.waiting + p.pouring));
  // Nice y-axis like Highcharts: pick a nice step from the rough interval (range /
  // ~one tick per 72px of height) then extend the top to a whole tick. For a max of
  // 6 this yields step 2.5 → 0 / 2.5 / 5 / 7.5, matching the live chart.
  // Aim for ~2.5 tick intervals, independent of pixel height, so shrinking the chart
  // keeps the 0/2.5/5/7.5 gridlines (just closer together) instead of dropping to 0/5/10.
  const yStep = niceTickInterval(rawMax / 2.5);
  const maxY = Math.max(yStep, Math.ceil(rawMax / yStep) * yStep);

  // Inset the data by a few px on each side (like Highcharts' axis padding) so the first
  // and last points aren't flush against the plot edge / clipped. Gridlines stay full width.
  const XPAD = 12;
  const x = (t: number) => pad.left + XPAD + ((t - tMin) / tSpan) * (innerW - 2 * XPAD);
  const y = (v: number) => pad.top + innerH - (v / maxY) * innerH;

  // Width (in viewBox px) of the diagonal slope on internal transitions (risers/drops);
  // small = steeper. The two OUTER edges (lead-in from the baseline, and the trailing
  // drop to the baseline) use a wider ramp so their angle is clearly visible.
  // ONE consistent small ramp on every transition (lead-in, risers, drops, trailing) —
  // a faithful copy of D3, whose step transitions are a ~2.6px diagonal on a 1118px plot.
  // In our 900-wide viewBox that's ~2px. Internal ramps clamp to 60% of the gap to the
  // next event so tightly-spaced points never overlap.
  const RAMP = 2;

  const areaToZero = (val: (p: (typeof pts)[number]) => number) => {
    const d: string[] = [];
    d.push(`M ${x(pts[0].t)} ${y(0)}`); // baseline at the first event
    d.push(`L ${x(pts[0].t) + RAMP} ${y(val(pts[0]))}`); // lead-in slope from the baseline
    for (let i = 1; i < pts.length; i++) {
      const xi = x(pts[i].t);
      // The last point has no "next" to clamp against — always give it a full RAMP so its
      // final value change slopes instead of dropping vertically (it has room in the margin).
      const ramp =
        i + 1 < pts.length
          ? Math.max(0, Math.min(RAMP, (x(pts[i + 1].t) - xi) * 0.6))
          : RAMP;
      d.push(`L ${xi} ${y(val(pts[i - 1]))}`);    // hold previous value up to this event
      d.push(`L ${xi + ramp} ${y(val(pts[i]))}`); // sloped transition to this value
    }
    const last = pts[pts.length - 1];
    // Trailing edge: hold the last value to the data edge, then slope down to the
    // baseline over RAMP (into the XPAD margin) — same small angle as every other step.
    const endX = x(data.tMax);
    d.push(`L ${endX} ${y(val(last))}`, `L ${endX + RAMP} ${y(0)}`);
    // No "Z": fill auto-closes along the baseline, and the same open path is reused as
    // the top-edge stroke (like D3, which draws a 1px line over the filled area).
    return d.join(" ");
  };

  // Precompute each stacked-area path so it can be used for both fill and top stroke.
  const dTotal = areaToZero((p) => p.pouring + p.waiting);
  const dWaiting = areaToZero((p) => p.waiting);
  const dPouring = areaToZero((p) => p.pouring);
  const areaAnim = { transition: "opacity 550ms ease" } as const;

  const yTicks = Array.from({ length: Math.round(maxY / yStep) + 1 }, (_, i) => i * yStep);
  // Dynamic "nice" ticks (15/30/5-min etc.) based on span + rendered width, like Highcharts.
  const { ticks: xTicks, step: xStep } = buildTimeTicks(vMin, vMax, chartW);

  const showWaiting = !hidden.has("Waiting");
  const showPouring = !hidden.has("Pouring");

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    zoom.onMove(e);
    // While drag-zooming, show the selection rect instead of a tooltip.
    if (zoom.dragging.current) {
      setTooltip(null);
      return;
    }
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const svgX = (mouseX / rect.width) * W;
    const svgY = (mouseY / rect.height) * H;

    // Convert SVG x coordinate back to time
    const t = tMin + ((svgX - pad.left) / innerW) * tSpan;

    // Find the closest data point
    let closest = pts[0];
    for (const p of pts) {
      if (p.t <= t) closest = p;
      else break;
    }

    // Pick a SINGLE series based on which stacked band the cursor is over — like D3,
    // where Waiting and Pouring have their own tooltips and are never merged.
    // Green (Pouring) fills 0→pouring; gray (Waiting) sits on top, pouring→total.
    const total = closest.waiting + closest.pouring;
    const inGreen = svgY >= y(closest.pouring); // at/below the green top = in the green band
    const label: "Waiting" | "Pouring" = inGreen ? "Pouring" : "Waiting";
    const value = inGreen ? closest.pouring : closest.waiting;
    const color = inGreen ? "#5aa02c" : "#434348";
    const stack = inGreen ? closest.pouring : total; // marker sits on the hovered series' top

    const domX = (x(closest.t) / W) * rect.width;
    const align: Align = domX > rect.width - 120 ? "right" : domX < 120 ? "left" : "center";
    setTooltip({
      x: domX,
      y: (y(stack) / H) * rect.height,
      align,
      t: closest.t,
      stack,
      time: fmtTooltipTime(closest.ts, closest.t),
      label,
      value,
      color,
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  return (
    <>
      <ChartFrame title="Trucks on the Job" onReset={zoom.zoomed ? zoom.reset : undefined}>
        <TruckTooltip data={tooltip} />
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full cursor-crosshair select-none"
          preserveAspectRatio="xMidYMid meet"
          onMouseDown={(e) => { setTooltip(null); zoom.onDown(e); }}
          onMouseMove={handleMouseMove}
          onMouseUp={zoom.onUp}
          onMouseLeave={() => { zoom.onUp(); handleMouseLeave(); }}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={pad.left} y={pad.top} width={innerW} height={innerH} />
            </clipPath>
          </defs>
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={pad.left} y1={y(t)} x2={W - pad.right} y2={y(t)} stroke={COL.grid} />
              <text x={pad.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill={COL.axis}>
                {t}
              </text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <text key={i} x={x(t)} y={H - 8} textAnchor="middle" fontSize="11" fill={COL.axis}>
              {fmtTick(t, xStep)}
            </text>
          ))}

          <g clipPath={`url(#${clipId})`}>
            {/* Stacked areas that crossfade on toggle (opacity animated). Each is a
                0.75-opacity fill plus a 1px top-edge stroke, exactly like D3:
                  total(dark)        — shown when BOTH series are on
                  waiting-only(dark) — shown when only Waiting is on
                  pouring(green)     — shown whenever Pouring is on
                Pouring green (bottom layer) is drawn last so it sits over the dark. */}
            <path d={dTotal} fill="#434348" fillOpacity={0.75} style={{ ...areaAnim, opacity: showWaiting && showPouring ? 1 : 0 }} />
            <path d={dTotal} fill="none" stroke="#434348" strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" style={{ ...areaAnim, opacity: showWaiting && showPouring ? 1 : 0 }} />

            <path d={dWaiting} fill="#434348" fillOpacity={0.75} style={{ ...areaAnim, opacity: showWaiting && !showPouring ? 1 : 0 }} />
            <path d={dWaiting} fill="none" stroke="#434348" strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" style={{ ...areaAnim, opacity: showWaiting && !showPouring ? 1 : 0 }} />

            <path d={dPouring} fill="#90ed7d" fillOpacity={0.75} style={{ ...areaAnim, opacity: showPouring ? 1 : 0 }} />
            <path d={dPouring} fill="none" stroke="#90ed7d" strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" style={{ ...areaAnim, opacity: showPouring ? 1 : 0 }} />

            {/* Vertical crosshair + point marker on the hovered series. */}
            {tooltip && (
              <>
                <line
                  x1={x(tooltip.t)}
                  y1={pad.top}
                  x2={x(tooltip.t)}
                  y2={H - pad.bottom}
                  stroke="#999"
                  strokeWidth={1}
                  strokeDasharray="4,4"
                />
                <circle
                  cx={x(tooltip.t)}
                  cy={y(tooltip.stack)}
                  r={4}
                  fill={tooltip.label === "Pouring" ? "#90ed7d" : "#434348"}
                  stroke="#fff"
                  strokeWidth={1.5}
                />
              </>
            )}
          </g>

          {/* Drag selection rectangle while zooming */}
          {zoom.sel && (
            <rect
              x={Math.min(zoom.sel.x0, zoom.sel.x1)}
              y={pad.top}
              width={Math.abs(zoom.sel.x1 - zoom.sel.x0)}
              height={innerH}
              fill="#5aa0e6"
              fillOpacity={0.2}
            />
          )}
        </svg>
      </ChartFrame>
      <Legend
        items={[
          { label: "Waiting", color: "#434348", box: true },
          { label: "Pouring", color: "#90ed7d", box: true },
        ]}
        hidden={hidden}
        onToggle={toggle}
      />
    </>
  );
}
