"use client";

import * as React from "react";

type XY = { t: number; v: number };

export interface ChartData {
  tMin: number;
  tMax: number;
  ordered: number;
  delivered: XY[];
  poured: XY[];
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
      <p className="text-center text-xs text-[#2f7ed8]">Click and drag in the plot area to zoom in</p>
      <div className="w-full overflow-x-auto bg-white">{children}</div>
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

/* ------------------------------------------------------------------ */
/*  Pour Speed (CY/HR): Delivered / Poured / Ordered                   */
/* ------------------------------------------------------------------ */

export function PourChart({ data }: { data: ChartData }) {
  const hasData = data.delivered.length > 0 || data.poured.length > 0;
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

  const tMin = data.tMin;
  const tSpan = Math.max(1, data.tMax - data.tMin);
  const dataMax = Math.max(data.ordered, ...data.delivered.map((p) => p.v), ...data.poured.map((p) => p.v), 1);
  const maxY = niceMax(dataMax);

  const x = (t: number) => pad.left + ((t - tMin) / tSpan) * innerW;
  const y = (v: number) => pad.top + innerH - (v / maxY) * innerH;

  const linePath = (pts: XY[]) => pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.t)} ${y(p.v)}`).join(" ");

  const yTicks = [0, maxY / 2, maxY];
  const xTickCount = 8;
  const xTicks = Array.from({ length: xTickCount + 1 }, (_, k) => tMin + (k / xTickCount) * tSpan);

  return (
    <>
      <ChartFrame title="Pour Speed (CY/HR)">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet">
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

          {/* Ordered: flat blue line + square markers */}
          <line x1={pad.left} y1={y(data.ordered)} x2={W - pad.right} y2={y(data.ordered)} stroke={COL.ordered} strokeWidth={2} />
          {data.delivered.map((p, i) => (
            <rect key={i} x={x(p.t) - 3} y={y(data.ordered) - 3} width={6} height={6} fill={COL.ordered} />
          ))}

          {/* Poured: green */}
          <path d={linePath(data.poured)} fill="none" stroke={COL.poured} strokeWidth={2} />
          {data.poured.map((p, i) => (
            <circle key={i} cx={x(p.t)} cy={y(p.v)} r={3} fill={COL.poured} />
          ))}

          {/* Delivered: black */}
          <path d={linePath(data.delivered)} fill="none" stroke={COL.delivered} strokeWidth={2} />
          {data.delivered.map((p, i) => (
            <circle key={i} cx={x(p.t)} cy={y(p.v)} r={3} fill={COL.delivered} />
          ))}
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

  return (
    <>
      <ChartFrame title="Trucks on the Job">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet">
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
