"use client";

import * as React from "react";
import { useState } from "react";

type XY = { t: number; v: number };

export interface ChartData {
  tMin: number;
  tMax: number;
  ordered: number; // Scheduled delivery rate (CY/HR)
  orderedPoints: XY[]; // Points at each scheduled truck arrival
  delivered: XY[]; // Delivered rate (CY/HR) at each arrival
  poured: XY[]; // Poured rate (CY/HR) at each pour completion
  trucks: { t: number; waiting: number; pouring: number }[];
}

/** minutes-of-day -> "H:MM" (matches the live app's axis labels). */
function fmtT(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** Round a max value up to a "nice" axis maximum (1/2/5 × 10ⁿ), like Highcharts. */
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

const COL = {
  delivered: "#2b2b2b",
  poured: "#7ac043",
  ordered: "#5aa0e6",
  grid: "#e3e3e3",
  axis: "#666",
};

interface TooltipData {
  x: number;
  y: number;
  type: "ordered" | "delivered" | "poured";
  time: string;
  value: number;
  index: number;
}

interface TruckTooltipData {
  x: number;
  y: number;
  time: string;
  waiting: number;
  pouring: number;
  total: number;
}

function ChartFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-center text-base font-bold text-slate-700">{title}</p>
      <p className="text-center text-xs text-[#2f7ed8]">Hover over points for details</p>
      <div className="relative w-full overflow-x-auto bg-white">{children}</div>
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string; box?: boolean }[] }) {
  return (
    <div className="flex justify-center gap-5 pt-1 text-xs text-slate-600">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1">
          <span
            className={it.box ? "inline-block h-2 w-3" : "inline-block h-2 w-2 rounded-full"}
            style={{ backgroundColor: it.color }}
          />
          &quot;{it.label}&quot;
        </span>
      ))}
    </div>
  );
}

function Tooltip({ data }: { data: TooltipData | null }) {
  if (!data) return null;

  const typeLabels = {
    ordered: "Scheduled",
    delivered: "Delivered",
    poured: "Poured",
  };

  const colors = {
    ordered: COL.ordered,
    delivered: COL.delivered,
    poured: COL.poured,
  };

  return (
    <div
      className="pointer-events-none absolute z-50 rounded bg-white px-3 py-2 text-xs shadow-lg border border-gray-200"
      style={{
        left: data.x,
        top: data.y - 60,
        transform: "translateX(-50%)",
      }}
    >
      <div className="font-semibold text-gray-700">{data.time}</div>
      <div className="flex items-center gap-2 mt-1">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: colors[data.type] }}
        />
        <span style={{ color: colors[data.type] }}>
          {typeLabels[data.type]}: {data.value.toFixed(2)} CY/HR
        </span>
      </div>
      {data.type === "ordered" && (
        <div className="text-gray-500 mt-1">Load #{data.index + 1}</div>
      )}
    </div>
  );
}

function TruckTooltip({ data }: { data: TruckTooltipData | null }) {
  if (!data) return null;

  return (
    <div
      className="pointer-events-none absolute z-50 rounded bg-white px-3 py-2 text-xs shadow-lg border border-gray-200"
      style={{
        left: data.x,
        top: data.y - 80,
        transform: "translateX(-50%)",
      }}
    >
      <div className="font-semibold text-gray-700">{data.time}</div>
      <div className="mt-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-3" style={{ backgroundColor: "#434348" }} />
          <span>Waiting: {data.waiting}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-3" style={{ backgroundColor: "#90ed7d" }} />
          <span>Pouring: {data.pouring}</span>
        </div>
        <div className="border-t pt-1 font-semibold">
          Total on Job: {data.total}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pour Speed (CY/HR): Delivered / Poured / Ordered                   */
/* ------------------------------------------------------------------ */

export function PourChart({ data }: { data: ChartData }) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const hasData = data.delivered.length > 0 || data.poured.length > 0 || data.orderedPoints.length > 0;
  if (!hasData) {
    return (
      <ChartFrame title="Pour Speed (CY/HR)">
        <p className="py-10 text-center text-sm text-slate-400">No pour data yet for this order.</p>
      </ChartFrame>
    );
  }

  const W = 900;
  const H = 240;
  const pad = { top: 20, right: 20, bottom: 30, left: 40 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  // Include orderedPoints in time range calculation
  const allTimes = [
    ...data.delivered.map((p) => p.t),
    ...data.poured.map((p) => p.t),
    ...data.orderedPoints.map((p) => p.t),
  ];
  const tMin = allTimes.length > 0 ? Math.min(data.tMin, ...allTimes) : data.tMin;
  const tMax = allTimes.length > 0 ? Math.max(data.tMax, ...allTimes) : data.tMax;
  const tSpan = Math.max(1, tMax - tMin);

  const dataMax = Math.max(
    data.ordered,
    ...data.delivered.map((p) => p.v),
    ...data.poured.map((p) => p.v),
    1
  );
  const maxY = niceMax(dataMax);

  const x = (t: number) => pad.left + ((t - tMin) / tSpan) * innerW;
  const y = (v: number) => pad.top + innerH - (v / maxY) * innerH;

  const linePath = (pts: XY[]) => pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.t)} ${y(p.v)}`).join(" ");

  const yTicks = [0, maxY / 2, maxY];
  const xTickCount = 8;
  const xTicks = Array.from({ length: xTickCount + 1 }, (_, k) => tMin + (k / xTickCount) * tSpan);

  const handleMouseEnter = (type: "ordered" | "delivered" | "poured", point: XY, index: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = x(point.t);
    const svgY = y(point.v);
    // Convert SVG coordinates to DOM coordinates
    const domX = (svgX / W) * rect.width;
    const domY = (svgY / H) * rect.height;

    setTooltip({
      x: domX,
      y: domY,
      type,
      time: fmtT(point.t),
      value: point.v,
      index,
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  return (
    <>
      <ChartFrame title="Pour Speed (CY/HR)">
        <Tooltip data={tooltip} />
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={pad.left} y1={y(t)} x2={W - pad.right} y2={y(t)} stroke={COL.grid} />
              <text x={pad.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill={COL.axis}>
                {t}
              </text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <text key={i} x={x(t)} y={H - 8} textAnchor="middle" fontSize="10" fill={COL.axis}>
              {fmtT(t)}
            </text>
          ))}

          {/* Ordered: horizontal blue line at scheduled rate + square markers at scheduled times */}
          <line x1={pad.left} y1={y(data.ordered)} x2={W - pad.right} y2={y(data.ordered)} stroke={COL.ordered} strokeWidth={2} />
          {data.orderedPoints.map((p, i) => (
            <g key={`ord-${i}`}>
              <rect
                x={x(p.t) - 3}
                y={y(p.v) - 3}
                width={6}
                height={6}
                fill={COL.ordered}
              />
              {/* Larger invisible hit area for hover */}
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

          {/* Poured: green line with circle markers */}
          {data.poured.length > 0 && (
            <>
              <path d={linePath(data.poured)} fill="none" stroke={COL.poured} strokeWidth={2} />
              {data.poured.map((p, i) => (
                <g key={`pour-${i}`}>
                  <circle cx={x(p.t)} cy={y(p.v)} r={3} fill={COL.poured} />
                  {/* Larger invisible hit area for hover */}
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

          {/* Delivered: black line with circle markers */}
          {data.delivered.length > 0 && (
            <>
              <path d={linePath(data.delivered)} fill="none" stroke={COL.delivered} strokeWidth={2} />
              {data.delivered.map((p, i) => (
                <g key={`del-${i}`}>
                  <circle cx={x(p.t)} cy={y(p.v)} r={3} fill={COL.delivered} />
                  {/* Larger invisible hit area for hover */}
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
        </svg>
      </ChartFrame>
      <Legend
        items={[
          { label: "Delivered", color: COL.delivered },
          { label: "Poured", color: COL.poured },
          { label: "Ordered", color: COL.ordered, box: true },
        ]}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Trucks on the Job: Waiting (gray) + Pouring (green) step areas      */
/* ------------------------------------------------------------------ */

export function TrucksChart({ data }: { data: ChartData }) {
  const [tooltip, setTooltip] = useState<TruckTooltipData | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const pts = data.trucks;
  if (pts.length === 0) {
    return (
      <ChartFrame title="Trucks on the Job">
        <p className="py-10 text-center text-sm text-slate-400">No truck activity yet for this order.</p>
      </ChartFrame>
    );
  }

  const W = 900;
  const H = 240;
  const pad = { top: 20, right: 20, bottom: 30, left: 40 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const tMin = data.tMin;
  const tSpan = Math.max(1, data.tMax - data.tMin);
  const rawMax = Math.max(1, ...pts.map((p) => p.waiting + p.pouring));
  // Round up to an even number with headroom (matches the live app: 0,2,4,6 …).
  const maxY = Math.max(2, Math.ceil((rawMax + 0.5) / 2) * 2);

  const x = (t: number) => pad.left + ((t - tMin) / tSpan) * innerW;
  const y = (v: number) => pad.top + innerH - (v / maxY) * innerH;

  // Step-after area from a value down to the zero baseline.
  const areaToZero = (val: (p: (typeof pts)[number]) => number) => {
    const d: string[] = [];
    pts.forEach((p, i) => {
      const px = x(p.t);
      if (i === 0) d.push(`M ${px} ${y(val(p))}`);
      else d.push(`L ${px} ${y(val(pts[i - 1]))}`, `L ${px} ${y(val(p))}`);
    });
    const last = pts[pts.length - 1];
    d.push(`L ${x(data.tMax)} ${y(val(last))}`, `L ${x(data.tMax)} ${y(0)}`, `L ${x(pts[0].t)} ${y(0)}`, "Z");
    return d.join(" ");
  };

  const yTicks = Array.from({ length: maxY / 2 + 1 }, (_, i) => i * 2);
  const xTickCount = 8;
  const xTicks = Array.from({ length: xTickCount + 1 }, (_, k) => tMin + (k / xTickCount) * tSpan);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgX = (mouseX / rect.width) * W;

    // Convert SVG x coordinate back to time
    const t = tMin + ((svgX - pad.left) / innerW) * tSpan;

    // Find the closest data point
    let closest = pts[0];
    for (const p of pts) {
      if (p.t <= t) closest = p;
      else break;
    }

    const domX = (x(closest.t) / W) * rect.width;
    const total = closest.waiting + closest.pouring;
    const domY = (y(total) / H) * rect.height;

    setTooltip({
      x: domX,
      y: domY,
      time: fmtT(closest.t),
      waiting: closest.waiting,
      pouring: closest.pouring,
      total,
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  return (
    <>
      <ChartFrame title="Trucks on the Job">
        <TruckTooltip data={tooltip} />
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full cursor-crosshair"
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={pad.left} y1={y(t)} x2={W - pad.right} y2={y(t)} stroke={COL.grid} />
              <text x={pad.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill={COL.axis}>
                {t}
              </text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <text key={i} x={x(t)} y={H - 8} textAnchor="middle" fontSize="10" fill={COL.axis}>
              {fmtT(t)}
            </text>
          ))}

          {/* Stacked: Waiting (dark) on the bottom, Pouring (green) on top — matches Highcharts. */}
          <path d={areaToZero((p) => p.pouring + p.waiting)} fill="#90ed7d" fillOpacity={0.75} />
          <path d={areaToZero((p) => p.waiting)} fill="#434348" fillOpacity={0.75} />

          {/* Vertical crosshair line when hovering */}
          {tooltip && (
            <line
              x1={x(pts.find(p => fmtT(p.t) === tooltip.time)?.t ?? tMin)}
              y1={pad.top}
              x2={x(pts.find(p => fmtT(p.t) === tooltip.time)?.t ?? tMin)}
              y2={H - pad.bottom}
              stroke="#999"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          )}
        </svg>
      </ChartFrame>
      <Legend
        items={[
          { label: "Waiting", color: "#434348", box: true },
          { label: "Pouring", color: "#90ed7d", box: true },
        ]}
      />
    </>
  );
}
