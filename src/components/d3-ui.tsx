"use client";

/**
 * Shared UI primitives for the D3 (Dolese / TRUCKAST) screens.
 * Faithful reproduction of the live app's design language (dark TRUCKAST nav,
 * gray sub-header bar, folded-corner colored tiles) — mobile-first with Tailwind
 * so the same components reflow into a desktop browser layout.
 */

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, type LucideIcon } from "lucide-react";

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

export function TopNav() {
  return (
    <header className="bg-[#1c1c1c] text-[#cfcfcf]">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 sm:px-6">
        <Link href="/" className="text-lg font-light tracking-wide text-white">
          TRUCKAST
        </Link>
        {/* Top nav tabs hidden for now — not yet functional */}
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
    <div className="flex items-center justify-between gap-3 rounded-md border border-[#c9c9c9] bg-gradient-to-b from-[#fbfbfb] to-[#e9e9e9] px-4 py-3 shadow-sm">
      {backHref ? (
        <Link href={backHref} aria-label="Back" className="text-[#1f1f1f]">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      ) : (
        <span className="w-5" />
      )}
      <div className="min-w-0 text-center">
        <p className="truncate text-sm font-bold uppercase tracking-wide text-[#1f1f1f] sm:text-base">
          {title}
        </p>
        {subtitle ? <p className="truncate text-xs text-[#555]">{subtitle}</p> : null}
      </div>
      <button
        type="button"
        aria-label="Refresh"
        onClick={onRefresh}
        className="text-[#1f1f1f] disabled:opacity-30"
        disabled={!onRefresh}
      >
        <RefreshCw className="h-5 w-5" />
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
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute bottom-0 right-0"
        aria-hidden
      >
        <polygon points="0,16 16,16 16,0" fill={t.fold} />
      </svg>
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
    <div className="flex min-h-[84px] items-center gap-1 py-2 pr-3">
      <div className="flex w-[72px] shrink-0 items-center justify-center px-1 text-white">
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
    "block h-full",
    interactive ? "transition-transform hover:-translate-y-0.5 hover:brightness-110" : "",
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

export function PieGauge({ pct, size = 52 }: { pct: number; size?: number }) {
  const r = size / 2;
  const clamped = Math.max(0, Math.min(1, pct));
  const angle = clamped * 2 * Math.PI;
  const x = r + r * Math.sin(angle);
  const y = r - r * Math.cos(angle);
  const large = clamped > 0.5 ? 1 : 0;
  const d =
    clamped <= 0
      ? ""
      : clamped >= 1
        ? `M ${r} ${r} m 0 ${-r} a ${r} ${r} 0 1 1 -0.01 0 Z`
        : `M ${r} ${r} L ${r} 0 A ${r} ${r} 0 ${large} 1 ${x} ${y} Z`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={r} cy={r} r={r} fill="rgba(0,0,0,0.18)" />
      {d ? <path d={d} fill="rgba(255,255,255,0.95)" /> : null}
      <circle cx={r} cy={r} r={r - 1} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
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
    <FoldCard tone={tone} className="text-center text-white">
      <div className="px-2 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wide opacity-90">{label}</p>
        <p className="my-0.5 text-2xl font-bold leading-tight">{value}</p>
        {sub ? <p className="text-[11px] uppercase opacity-90">{sub}</p> : null}
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
        "w-full rounded-[4px] border border-[#cccccc] border-t-[#bbbbbb] bg-white px-3 py-2 text-sm text-[#555] outline-none placeholder:text-[#999] focus:border-[#2f7ed8]",
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
