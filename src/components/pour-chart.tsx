"use client";

import * as React from "react";

interface Point {
  time: string;
  ordered: number;
  delivered: number;
}

/** Lightweight responsive SVG chart: cumulative delivered vs ordered line. */
export function PourChart({ series }: { series: Point[] }) {
  if (!series || series.length === 0) {
    return (
      <div className="rounded-md border border-slate-200 bg-white py-10 text-center text-sm text-slate-400">
        No pour data yet for this order.
      </div>
    );
  }

  const W = 700;
  const H = 240;
  const pad = { top: 20, right: 20, bottom: 30, left: 40 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const ordered = series[0]?.ordered || 0;
  const maxY = Math.max(ordered, ...series.map((p) => p.delivered), 1);
  const n = series.length;

  const x = (i: number) => pad.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / maxY) * innerH;

  const deliveredPath = series.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.delivered)}`).join(" ");
  const orderedY = y(ordered);

  const ticks = [0, 0.5, 1].map((f) => Math.round(maxY * f));

  return (
    <div className="space-y-2">
      <p className="text-center text-base font-bold text-slate-700">Pour Speed (CY)</p>
      <div className="w-full overflow-x-auto rounded-md border border-slate-200 bg-white p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet">
          {/* grid + y ticks */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} y1={y(t)} x2={W - pad.right} y2={y(t)} stroke="#e3e3e3" strokeWidth={1} />
              <text x={pad.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#666">
                {t}
              </text>
            </g>
          ))}
          {/* ordered reference line */}
          <line
            x1={pad.left}
            y1={orderedY}
            x2={W - pad.right}
            y2={orderedY}
            stroke="#5aa0e6"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          {/* delivered cumulative */}
          <path d={deliveredPath} fill="none" stroke="#2b2b2b" strokeWidth={2} />
          {series.map((p, i) => (
            <circle key={i} cx={x(i)} cy={y(p.delivered)} r={3} fill="#7ac043" />
          ))}
        </svg>
      </div>
      <div className="flex justify-center gap-5 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#7ac043]" /> Delivered (cumulative)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 bg-[#5aa0e6]" /> Ordered
        </span>
      </div>
    </div>
  );
}
