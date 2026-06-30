"use client";

/**
 * Shared UI primitives for the D3 (Dolese / TRUCKAST) screens.
 * Faithful reproduction of the live app's design language (dark TRUCKAST nav,
 * gray sub-header bar, folded-corner colored tiles) — mobile-first with Tailwind
 * so the same components reflow into a desktop browser layout.
 */

import * as React from "react";
import Link from "next/link";
import { type LucideIcon } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Palette (sampled from the live app)                                */
/* ------------------------------------------------------------------ */

export const TONES = {
  blue: { bg: "#2f7ed8", fold: "#1a4f93" },
  green: { bg: "#458b00", fold: "#2f5e00" },
  greenLight: { bg: "#6aa630", fold: "#4d7a1f" },
  red: { bg: "#c43926", fold: "#8a2719" },
  orange: { bg: "#e0a300", fold: "#a87a00" },
  yellow: { bg: "#f7bb00", fold: "#bb8c00" },
  gray: { bg: "#4a4a4a", fold: "#2e2e2e" },
} as const;

export type ToneName = keyof typeof TONES;

/* ------------------------------------------------------------------ */
/*  Top nav — dark "TRUCKAST" bar                                      */
/* ------------------------------------------------------------------ */

const NAV_TABS = [
  "MARKETS",
  "SETTINGS",
  "PUBLISH",
  "ADMIN",
  "ORDER",
  "ROLLOUT",
  "PROJECTS",
  "HELP",
  "LOGOUT",
] as const;

export function TopNav() {
  // First tab is shown as the active/highlighted tab (design matches the live app).
  const active = NAV_TABS[0];
  return (
    <header className="bg-[#1c1c1c] text-[#cfcfcf]">
      <div className="mx-auto flex w-full max-w-[1170px] items-center gap-4 px-3 py-2 sm:px-0">
        <Link href="/" className="text-lg font-light tracking-wide text-[#9a9a9a]">
          TRUCKAST
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-xs font-semibold tracking-wide">
          {NAV_TABS.map((tab) => (
            <span
              key={tab}
              className={[
                "cursor-pointer rounded px-3 py-1.5 hover:text-white",
                tab === active ? "font-bold text-white" : "text-[#8a8a8a]",
              ].join(" ")}
            >
              {tab}
            </span>
          ))}
        </nav>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-header — gray rounded bar with back / title / refresh         */
/* ------------------------------------------------------------------ */

export function SubHeader({
  title,
  subtitle,
  backHref,
  onRefresh,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  onRefresh?: () => void;
}) {
  return (
    <div className="flex h-[46px] items-center justify-between gap-3 rounded-md border border-[#c9c9c9] bg-[#FAFAFA] px-5 text-[14px] text-[#333] shadow-sm">
      <Link
        href={backHref ?? "/"}
        aria-label="Back"
        className="cursor-pointer text-[#1f1f1f]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/arrow-back.png" alt="Back" className="h-8 w-8" />
      </Link>
      <div className="min-w-0 text-center">
        <strong className="block truncate text-[16px] font-bold leading-[19px] text-[#333]">
          {title}
        </strong>
        {subtitle ? <p className="truncate text-xs text-[#555]">{subtitle}</p> : null}
      </div>
      <button
        type="button"
        aria-label="Refresh"
        onClick={onRefresh ?? (() => window.location.reload())}
        className="cursor-pointer text-[#1f1f1f]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/refresh.png" alt="Refresh" className="h-8 w-8" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Folded-corner card                                                 */
/* ------------------------------------------------------------------ */

export function FoldCard({
  tone = "blue",
  className,
  style,
  children,
}: {
  tone?: ToneName;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div
      className={["relative overflow-hidden", className || ""].join(" ")}
      style={{ backgroundColor: t.bg, ...style }}
    >
      {children}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/dogear.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-[19px] w-[19px]"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Icon tile — colored card, left icon column + stacked text lines    */
/* ------------------------------------------------------------------ */

export interface TileLine {
  text: string;
  bold?: boolean;
  size?: number;
  dim?: boolean;
}

function TileBody({
  icon: Icon,
  left,
  lines,
}: {
  icon?: LucideIcon;
  left?: React.ReactNode;
  lines: TileLine[];
}) {
  return (
    <div className="flex h-[90px] items-center py-2 pr-3">
      <div className="mr-[5px] flex h-[80px] w-[72px] shrink-0 items-center justify-center text-white">
        {left ? left : Icon ? <Icon className="h-10 w-10" strokeWidth={1.6} /> : null}
      </div>
      <div className="min-w-0 flex-1 pl-0.5">
        {lines.map((ln, i) => (
          <p
            key={i}
            className="truncate leading-tight"
            style={{
              color: ln.dim ? "rgba(255,255,255,0.9)" : "#fff",
              fontSize: ln.size ?? (ln.bold ? 14 : 12),
              fontWeight: ln.bold ? 700 : 400,
              marginTop: i ? 2 : 0,
            }}
          >
            {ln.text}
          </p>
        ))}
      </div>
    </div>
  );
}

export function IconTile({
  icon,
  left,
  tone = "blue",
  lines,
  href,
  onClick,
}: {
  icon?: LucideIcon;
  left?: React.ReactNode;
  tone?: ToneName;
  lines: TileLine[];
  href?: string;
  onClick?: () => void;
}) {
  const interactive = !!(href || onClick);
  const body = <TileBody icon={icon} left={left} lines={lines} />;
  const cls = [
    "block w-[274px] mb-[5px] mr-[5px]",
    interactive ? "cursor-pointer" : "",
  ].join(" ");

  if (href) {
    return (
      <Link href={href} className={cls}>
        <FoldCard tone={tone} className="h-full">
          {body}
        </FoldCard>
      </Link>
    );
  }
  return (
    <div className={cls} onClick={onClick} role={onClick ? "button" : undefined}>
      <FoldCard tone={tone} className="h-full">
        {body}
      </FoldCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pie gauge (used as the tile's left icon for orders)                */
/* ------------------------------------------------------------------ */

// Highcharts pie palette (matches the live app): used slice vs. remainder.
const PIE_USED = "#7cb5ec";
const PIE_REST = "#434348";

export function PieGauge({
  pct,
  size = 52,
  tinted = false,
}: {
  pct: number;
  size?: number;
  // `tinted` uses translucent shades that blend with the tile colour (order list);
  // the default solid blue/charcoal matches the Market-Summary DOLESE pie.
  tinted?: boolean;
}) {
  const c = size / 2;
  const r = c - 1; // leave room for the 1px white stroke
  const clamped = Math.max(0, Math.min(1, pct));
  // Used slice starts at 12 o'clock and sweeps clockwise.
  const angle = clamped * 2 * Math.PI;
  const x = c + r * Math.sin(angle);
  const y = c - r * Math.cos(angle);
  const large = clamped > 0.5 ? 1 : 0;
  const usedPath =
    clamped <= 0 || clamped >= 1
      ? ""
      : `M ${c} ${c} L ${c} ${c - r} A ${r} ${r} 0 ${large} 1 ${x} ${y} Z`;

  const restFill = tinted ? "rgba(255,255,255,0.85)" : PIE_REST;
  const usedFill = tinted ? "rgba(0,0,0,0.32)" : PIE_USED;
  const stroke = tinted ? "rgba(255,255,255,0.65)" : "#fff";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {/* Base = remainder slice (full circle) */}
      <circle cx={c} cy={c} r={r} fill={clamped >= 1 ? usedFill : restFill} stroke={stroke} strokeWidth="1" />
      {/* Used slice on top */}
      {usedPath ? (
        <path d={usedPath} fill={usedFill} stroke={stroke} strokeWidth="1" strokeLinejoin="round" />
      ) : null}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat tile (order detail: ORDERED / TICKETED / ON JOB …)            */
/* ------------------------------------------------------------------ */

export function StatTile({
  label,
  value,
  sub,
  tone = "blue",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: ToneName;
}) {
  return (
    <FoldCard tone={tone} className="mb-[5px] mr-[5px] h-[90px] w-[88px] text-white">
      <div className="p-[5px]">
        <div className="text-center text-[12px] font-bold uppercase">{label}</div>
        <div className="h-[40px] w-full text-center text-[24px] font-bold leading-[40px]">{value}</div>
        {sub ? <div className="text-center text-[12px] uppercase">{sub}</div> : null}
      </div>
    </FoldCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Search box                                                         */
/* ------------------------------------------------------------------ */

export function SearchBox({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={[
        "w-full rounded-[4px] border border-[#cccccc] border-t-[#bbbbbb] bg-white px-3 py-2 text-sm text-[#555] outline-none transition placeholder:text-[#999] focus:border-[#66afe9] focus:shadow-[0_0_8px_rgba(102,175,233,0.6)]",
        className || "",
      ].join(" ")}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Select (native, styled)                                            */
/* ------------------------------------------------------------------ */

export function Dropdown({
  value,
  onChange,
  children,
  className,
}: {
  value: string;
  onChange?: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className={[
        "w-full rounded-[4px] border border-[#cccccc] bg-white px-3 py-2 text-sm text-[#555] outline-none focus:border-[#2f7ed8]",
        className || "",
      ].join(" ")}
    >
      {children}
    </select>
  );
}
