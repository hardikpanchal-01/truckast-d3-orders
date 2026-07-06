"use client";

import * as React from "react";
import Link from "next/link";

// Animated Pie Gauge - same as d3-ui.tsx PieGauge but standalone
function AnimatedPieGauge({ pct, size = 60 }: { pct: number; size?: number }) {
  const c = size / 2;
  const r = c - 1;
  const clamped = Math.max(0, Math.min(1, pct));
  const angle = clamped * 2 * Math.PI;
  const x = Math.round((c + r * Math.sin(angle)) * 10000) / 10000;
  const y = Math.round((c - r * Math.cos(angle)) * 10000) / 10000;
  const large = clamped > 0.5 ? 1 : 0;
  const usedPath =
    clamped <= 0 || clamped >= 1
      ? ""
      : `M ${c} ${c} L ${c} ${c - r} A ${r} ${r} 0 ${large} 1 ${x} ${y} Z`;

  // D3 colors: Blue = delivered/used, Gray = remaining
  const deliveredFill = "#7cb5ec"; // Blue - delivered/used portion
  const remainingFill = "#434348"; // Gray - remaining portion
  const stroke = "#fff";

  // Animation: sweep 0 → 360° on mount
  const clipId = "pieclip" + React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const [sweep, setSweep] = React.useState(0);
  React.useEffect(() => {
    let raf = 0;
    let start = 0;
    const DUR = 750;
    const step = (ts: number) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / DUR);
      setSweep(1 - Math.pow(1 - t, 3)); // easeOutCubic
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  const swept = sweep >= 0.999;
  const sa = sweep * 2 * Math.PI;
  const sx = Math.round((c + r * Math.sin(sa)) * 10000) / 10000;
  const sy = Math.round((c - r * Math.cos(sa)) * 10000) / 10000;
  const sLarge = sweep > 0.5 ? 1 : 0;
  const clipD = sweep <= 0 ? "M0 0Z" : `M ${c} ${c} L ${c} ${c - r} A ${r} ${r} 0 ${sLarge} 1 ${sx} ${sy} Z`;

  return (
    <span className="pie-hover">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
        <defs>
          <clipPath id={clipId}>
            <path d={clipD} />
          </clipPath>
        </defs>
        <g clipPath={swept ? undefined : `url(#${clipId})`}>
          {/* Base = gray circle (remaining) */}
          <circle cx={c} cy={c} r={r} fill={clamped >= 1 ? deliveredFill : remainingFill} stroke={stroke} strokeWidth="1" />
          {/* Delivered slice on top (blue) */}
          {usedPath ? (
            <path d={usedPath} fill={deliveredFill} stroke={stroke} strokeWidth="1" strokeLinejoin="round" />
          ) : null}
          {/* Radius line at 12 o'clock */}
          <line x1={c} y1={c} x2={c} y2={c - r} stroke={stroke} strokeWidth="1" />
        </g>
      </svg>
    </span>
  );
}

// Market Summary Tile with animated pie chart
export function MarketTile({
  href,
  name,
  usedCY,
  totalCY,
  totalOrders,
  activeOrders,
  cancelledOrders,
}: {
  href: string;
  name: string;
  usedCY: number;
  totalCY: number;
  totalOrders: number;
  activeOrders: number;
  cancelledOrders: number;
}) {
  const usedRatio = totalCY > 0 ? usedCY / totalCY : 0;

  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        className="tile"
        style={{ position: "relative", backgroundColor: "rgb(69, 139, 0)", cursor: "pointer", display: "block" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/dogear.png"
          style={{ position: "absolute", right: 0, bottom: 0, display: "block" }}
          alt=""
        />
        <div className="tileContainer">
          {/* Pie chart container */}
          <div style={{ width: 72, height: 80, marginRight: 5, float: "left", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AnimatedPieGauge pct={usedRatio} size={60} />
          </div>
          <div className="tileInfoSection">
            <div className="tileCell">
              <div className="tileSuperTitle">{name.toUpperCase()}</div>
              <div className="tileTitle">{usedCY.toFixed(2)} OF {totalCY.toFixed(2)} CY</div>
              <div className="tileSubTitle">Tot {totalOrders}, Act {activeOrders}, Can {cancelledOrders}</div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
