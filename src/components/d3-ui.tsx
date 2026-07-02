"use client";

/**
 * Shared UI primitives for the D3 (Dolese / TRUCKAST) screens.
 * Faithful reproduction of the live app's design language (dark TRUCKAST nav,
 * gray sub-header bar, folded-corner colored tiles) — mobile-first with Tailwind
 * so the same components reflow into a desktop browser layout.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

const MARKETS_TABS = [
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

// The Rollout (customer-invite) section uses its own brand + tab set.
const ROLLOUT_TABS = [
  "DASHBOARD",
  "INVITE",
  "PUBLISH",
  "ADMIN",
  "TRUCKAST",
  "ORDER",
  "PROJECTS",
  "HELP",
  "LOGOUT",
] as const;

// The Order Request (order concrete) section uses its own brand + tab set.
const ORDER_TABS = ["DASHBOARD", "ORDER FORM", "SETTINGS", "PUBLISH", "ADMIN", "TRUCKAST", "LOGOUT"] as const;

// The Projects section uses its own brand + tab set.
const PROJECTS_TABS = [
  "PUBLISH",
  "ADMIN",
  "TRUCKAST",
  "ROLLOUT",
  "HELP",
  "SETTINGS",
  "LOGOUT",
] as const;

// Routes wired so far; tabs without an entry render as inert labels.
const TAB_HREF: Record<string, string> = {
  MARKETS: "/",
  TRUCKAST: "/",
  SETTINGS: "/settings",
  ADMIN: "/admin",
  PROJECTS: "/projects",
  ROLLOUT: "/rollout/search",
  ORDER: "/order-request",
};

export function TopNav() {
  const pathname = usePathname();
  const isRollout = pathname?.startsWith("/rollout") ?? false;
  const isOrder = pathname?.startsWith("/order-request") ?? false;
  const isProjects = pathname?.startsWith("/projects") ?? false;
  const brand = isRollout ? "ROLLOUT" : isOrder ? "ORDER REQUEST" : isProjects ? "PROJECTS" : "TRUCKAST";
  const tabs: readonly string[] = isRollout ? ROLLOUT_TABS : isOrder ? ORDER_TABS : isProjects ? PROJECTS_TABS : MARKETS_TABS;
  // First tab is the active/highlighted tab in the markets nav; the others have none.
  const active = isRollout || isOrder || isProjects ? "" : MARKETS_TABS[0];
  return (
    <header
      style={{
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        fontSize: "14px",
        lineHeight: "20px",
        minHeight: "40px",
        border: "1px solid #d4d4d4",
        borderWidth: "0 0 1px",
        borderColor: "#252525",
        borderRadius: "0",
        paddingRight: "0",
        paddingLeft: "0",
        backgroundColor: "#1b1b1b",
        backgroundImage: "linear-gradient(to bottom, #222, #111)",
        backgroundRepeat: "repeat-x",
        boxShadow: "0 1px 10px rgba(0, 0, 0, 0.1)",
        color: "#333",
      }}
    >
      <div className="flex min-h-[40px] items-center" style={{ width: 1170, margin: "0 auto" }}>
        <Link
          href="/"
          style={{
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            lineHeight: "20px",
            textDecoration: "none",
            display: "block",
            padding: "10px 0px 10px",
            marginRight: "20px",
            fontSize: "20px",
            fontWeight: 200,
            textShadow: "0 -1px 0 rgba(0, 0, 0, 0.25)",
            color: "#999",
          }}
        >
          {brand}
        </Link>
        <nav className="flex items-center text-[14px] font-normal uppercase tracking-wide" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
          {tabs.map((tab) => {
            const href = TAB_HREF[tab];
            const cls = [
              "cursor-pointer px-[15px] py-[10px] hover:text-white",
              tab === active ? "text-white" : "text-[#999]",
            ].join(" ");
            return href ? (
              <Link key={tab} href={href} className={cls}>
                {tab}
              </Link>
            ) : (
              <span key={tab} className={cls}>
                {tab}
              </span>
            );
          })}
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
  heightClass = "h-[46px]",
}: {
  title: string;
  subtitle?: React.ReactNode;
  backHref?: string;
  onRefresh?: () => void;
  /** Override the bar height (e.g. "h-[76px]" for multi-line subtitles). */
  heightClass?: string;
}) {
  return (
    <div
      className={[
        "flex items-center justify-between gap-3 rounded-md border border-[#c9c9c9] bg-[#FAFAFA] px-5 text-[14px] text-[#333] shadow-sm",
        heightClass,
      ].join(" ")}
    >
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
        {subtitle ? <div className="text-xs leading-tight text-[#555]">{subtitle}</div> : null}
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
  noFold = false,
}: {
  tone?: ToneName;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  /** Hide the folded-corner (dogear) accent. */
  noFold?: boolean;
}) {
  const t = TONES[tone];
  return (
    <div
      className={["relative overflow-hidden cursor-pointer text-white", className || ""].join(" ")}
      style={{
        position: "relative",
        backgroundColor: t.bg,
        display: "block",
        ...style,
      }}
    >
      {children}
      {noFold ? null : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/icons/dogear.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 h-[19px] w-[19px]"
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Completed checkmark (for completed orders)                         */
/* ------------------------------------------------------------------ */

export function CompletedCheckmark({
  size = 48,
}: {
  size?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icons/checkmark.png"
      alt="Completed"
      style={{
        width: size,
        height: size,
      }}
    />
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
    <div className="flex h-full w-full items-center">
      {/* tileIcon */}
      <div className="flex h-[82px] w-[72px] shrink-0 items-center justify-center text-white">
        {left ? left : Icon ? <Icon className="h-10 w-10" strokeWidth={1.6} /> : null}
      </div>
      {/* tileInfoSection */}
      <div className="flex min-w-0 flex-1 items-center pr-3">
        {/* tileCell */}
        <div className="min-w-0 flex-1">
          {lines.map((ln, i) => (
            <div
              key={i}
              className="truncate leading-[1.2]"
              style={{
                color: ln.dim ? "rgba(255,255,255,0.9)" : "#fff",
                fontSize: ln.size ?? (ln.bold ? 14 : 12),
                fontWeight: ln.bold ? 700 : 400,
              }}
            >
              {ln.text}
            </div>
          ))}
        </div>
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
  completed = false,
}: {
  icon?: LucideIcon;
  left?: React.ReactNode;
  tone?: ToneName;
  lines: TileLine[];
  href?: string;
  onClick?: () => void;
  /** Show a completed checkmark icon instead of the regular icon */
  completed?: boolean;
}) {
  // If completed, show checkmark; otherwise use the provided left/icon
  const leftContent = completed ? <CompletedCheckmark size={48} /> : left;
  const body = <TileBody icon={icon} left={leftContent} lines={lines} />;

  // Match D3 .tile CSS exactly
  const tileClass = "relative block cursor-pointer text-white";
  const tileStyle: React.CSSProperties = {
    position: "relative",
    width: 274,
    height: 90,
    marginRight: 5,
    marginBottom: 5,
    float: "left",
    color: "white",
    cursor: "pointer",
    display: "block",
  };

  if (href) {
    return (
      <Link href={href} className={tileClass} style={tileStyle}>
        <FoldCard tone={tone} className="h-full w-full">
          {body}
        </FoldCard>
      </Link>
    );
  }
  return (
    <div
      className={tileClass}
      style={tileStyle}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <FoldCard tone={tone} className="h-full w-full">
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
  // Round to 4 decimal places to avoid server/client hydration mismatch from floating-point precision differences
  const x = Math.round((c + r * Math.sin(angle)) * 10000) / 10000;
  const y = Math.round((c - r * Math.cos(angle)) * 10000) / 10000;
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
  href,
  newTab,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: ToneName;
  href?: string;
  newTab?: boolean;
}) {
  const card = (
    <FoldCard
      tone={tone}
      noFold={!href}
      className={["mb-[5px] mr-[5px] h-[90px] w-[88px] text-white", href ? "cursor-pointer" : ""].join(" ")}
    >
      <div className="p-[5px]">
        <div className="text-center text-[12px] font-bold uppercase">{label}</div>
        <div className="h-[40px] w-full text-center text-[24px] font-bold leading-[40px]">{value}</div>
        {sub ? <div className="text-center text-[12px] uppercase">{sub}</div> : null}
      </div>
    </FoldCard>
  );

  if (href) {
    return (
      <Link
        href={href}
        {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="block"
      >
        {card}
      </Link>
    );
  }
  return card;
}

/* ------------------------------------------------------------------ */
/*  Load-status icon (target ring + dispatch arrow)                    */
/* ------------------------------------------------------------------ */

export function LoadStatusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden
      stroke="#fff"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="21" cy="27" r="13" />
      <circle cx="21" cy="27" r="3.5" fill="#fff" stroke="none" />
      <line x1="30" y1="18" x2="42" y2="6" />
      <polyline points="33 6 42 6 42 15" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Evaporation-rate icon (water surface + rising vapor arrows)        */
/* ------------------------------------------------------------------ */

export function EvapIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      {/* three rising vapor arrows */}
      {[12, 24, 36].map((x, i) => (
        <g key={x} stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <line x1={x} y1={i === 1 ? 6 : 12} x2={x} y2={24} />
          <polyline points={`${x - 4},${i === 1 ? 11 : 17} ${x},${i === 1 ? 6 : 12} ${x + 4},${i === 1 ? 11 : 17}`} />
        </g>
      ))}
      {/* two water-surface waves */}
      {[33, 41].map((y) => (
        <path
          key={y}
          d={`M4 ${y} q5 -4 10 0 t10 0 t10 0 t10 0`}
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
      ))}
    </svg>
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
        "h-[30px] w-[274px] max-w-full rounded-[4px] border border-[#cccccc] border-t-[#bbbbbb] bg-white px-3 py-1 text-sm text-[#555] outline-none transition placeholder:text-[#999] focus:border-[#66afe9] focus:shadow-[0_0_8px_rgba(102,175,233,0.6)]",
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
