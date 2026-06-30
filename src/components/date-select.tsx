"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

function mdy(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
}

/**
 * Date filter: quick presets (Today / Yesterday / …) plus a free date picker for
 * any day. Both navigate with ?date=YYYY-MM-DD (preserving other params).
 */
export function DateSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const presets = React.useMemo(() => {
    const today = new Date();
    const days: { value: string; label: string }[] = [];
    for (let offset = -7; offset <= 2; offset++) {
      const d = new Date(today);
      d.setDate(today.getDate() + offset);
      const iso = d.toISOString().slice(0, 10);
      const label =
        offset === 0
          ? `TODAY - ${mdy(iso)}`
          : offset === -1
            ? `YESTERDAY - ${mdy(iso)}`
            : offset === 1
              ? `TOMORROW - ${mdy(iso)}`
              : mdy(iso);
      days.push({ value: iso, label });
    }
    return days;
  }, []);

  const navigate = React.useCallback(
    (date: string) => {
      if (!date) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", date);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  // If the chosen date isn't one of the presets, surface it as a leading option
  const hasPreset = presets.some((p) => p.value === value);

  return (
    <select
      value={value}
      onChange={(e) => navigate(e.target.value)}
      className="h-[30px] w-full rounded-[4px] border border-[#cccccc] bg-white px-3 py-0 text-sm leading-none text-[#333] outline-none focus:border-[#2f7ed8]"
    >
      {!hasPreset && <option value={value}>{mdy(value)}</option>}
      {presets.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
