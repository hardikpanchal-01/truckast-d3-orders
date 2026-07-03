"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

function mdy(iso: string) {
  // Zero-padded MM/DD/YYYY like D3 ("07/03/2026"); the ISO parts are already padded.
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

function formatMonthYear(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase();
}

function getISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

interface DateOption {
  value: string;
  label: string;
  type: "single" | "range";
}

/**
 * Date filter: quick presets (Today / Yesterday / …) plus date ranges
 * matching D3 production layout.
 */
export function DateSelect({ value, valueTo }: { value: string; valueTo?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const options = React.useMemo(() => {
    const today = new Date();
    const items: DateOption[] = [];

    // TODAY
    const todayISO = getISODate(today);
    items.push({ value: todayISO, label: `TODAY - ${mdy(todayISO)}`, type: "single" });

    // TOMORROW
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowISO = getISODate(tomorrow);
    items.push({ value: tomorrowISO, label: `TOMORROW - ${mdy(tomorrowISO)}`, type: "single" });

    // YESTERDAY
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayISO = getISODate(yesterday);
    items.push({ value: yesterdayISO, label: "YESTERDAY", type: "single" });

    // Next 5 individual days (day after tomorrow + 4 more)
    for (let i = 2; i <= 6; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = getISODate(d);
      items.push({ value: iso, label: mdy(iso), type: "single" });
    }

    // Current month date range (first day to last day)
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    items.push({
      value: `range:${getISODate(firstOfMonth)}:${getISODate(lastOfMonth)}`,
      label: `${mdy(getISODate(firstOfMonth))} - ${mdy(getISODate(lastOfMonth))}`,
      type: "range",
    });

    // LAST 7 DAYS (D3 production: day - 6 to day, 7 days inclusive)
    const last7Start = new Date(today);
    last7Start.setDate(today.getDate() - 6);  // today - 6 = 7 days inclusive
    items.push({
      value: `range:${getISODate(last7Start)}:${todayISO}`,
      label: "LAST 7 DAYS",
      type: "range",
    });

    // LAST 30 DAYS (D3 production: day - 29 to day, 30 days inclusive)
    const last30Start = new Date(today);
    last30Start.setDate(today.getDate() - 29);  // today - 29 = 30 days inclusive
    items.push({
      value: `range:${getISODate(last30Start)}:${todayISO}`,
      label: "LAST 30 DAYS",
      type: "range",
    });

    // Next 3 months (starting from next month since current month is already added above)
    for (let i = 1; i <= 3; i++) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const monthStart = getISODate(monthDate);
      const monthEnd = getISODate(new Date(today.getFullYear(), today.getMonth() + i + 1, 0));
      items.push({
        value: `range:${monthStart}:${monthEnd}`,
        label: formatMonthYear(monthDate),
        type: "range",
      });
    }

    // FUTURE (tomorrow onwards for 30 days)
    const future30 = new Date(today);
    future30.setDate(today.getDate() + 30);
    items.push({
      value: `range:${tomorrowISO}:${getISODate(future30)}`,
      label: "FUTURE",
      type: "range",
    });

    // SEARCH (placeholder - opens date picker)
    items.push({
      value: "search",
      label: "SEARCH",
      type: "single",
    });

    return items;
  }, []);

  const navigate = React.useCallback(
    (selectedValue: string) => {
      if (!selectedValue || selectedValue === "search") {
        // For SEARCH, prompt for a date
        const input = prompt("Enter date (YYYY-MM-DD or MM/DD/YYYY):");
        if (input) {
          let iso = input;
          // Convert MM/DD/YYYY to YYYY-MM-DD if needed
          if (input.includes("/")) {
            const parts = input.split("/");
            if (parts.length === 3) {
              iso = `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
            }
          }
          const params = new URLSearchParams(searchParams.toString());
          params.set("date", iso);
          params.delete("dateTo");
          router.push(`${pathname}?${params.toString()}`);
        }
        return;
      }

      const params = new URLSearchParams(searchParams.toString());

      // Handle range selections
      if (selectedValue.startsWith("range:")) {
        const [, startDate, endDate] = selectedValue.split(":");
        params.set("date", startDate);
        params.set("dateTo", endDate);
      } else {
        // Single date
        params.set("date", selectedValue);
        params.delete("dateTo");
      }

      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  // Find current selection or show custom date
  const currentOption = options.find((o) => {
    // Single date match
    if (!valueTo && o.value === value && o.type === "single") return true;
    // Range match - check if both start and end dates match
    if (valueTo && o.value.startsWith("range:")) {
      const [, start, end] = o.value.split(":");
      if (start === value && end === valueTo) return true;
    }
    return false;
  });

  const displayValue = currentOption?.value || (valueTo ? `range:${value}:${valueTo}` : value);
  const displayLabel = valueTo ? `${mdy(value)} - ${mdy(valueTo)}` : mdy(value);

  return (
    <select
      value={displayValue}
      onChange={(e) => navigate(e.target.value)}
      className="block h-[30px] w-full cursor-pointer rounded-[4px] border border-[#ccc] bg-white px-[6px] py-[4px] align-middle text-[14px] font-normal leading-[30px] text-[#555] outline-none focus:border-[#2f7ed8]"
      style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
    >
      {/* Show custom date/range if not in presets */}
      {!currentOption && <option value={displayValue}>{displayLabel}</option>}

      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
