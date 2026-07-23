"use client";

import { useEffect, useRef, useState } from "react";
import { INP } from "./styles";

/**
 * "Date of pour" field for the Hercules order form.
 *
 * NOT <input type="date">: that renders the browser's own calendar glyph inside the
 * field and formats the placeholder from the OS locale (ours showed "dd-mm-yyyy"),
 * neither of which can be styled. This is a plain text field with an "mm/dd/yyyy"
 * placeholder plus a month grid that opens on click — matching the live board, which
 * shows Su..Sa columns under a month header with prev/next arrows.
 */
const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const two = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${two(d.getMonth() + 1)}/${two(d.getDate())}/${d.getFullYear()}`;

export default function DateOfPourField({
  name = "date_of_pour",
  className,
}: {
  name?: string;
  /** Field styling — pass the tenant's INP variant so the focus ring matches. */
  className?: string;
}) {
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const box = useRef<HTMLDivElement>(null);

  // Close when clicking away.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const first = new Date(view.y, view.m, 1);
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const lead = first.getDay(); // 0 = Sunday, matching the Su-first column order
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const step = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  // Live disables everything up to and including today — on 07/22 the 23rd onward are
  // selectable and 1..22 render as plain grey text. Concrete can't be poured same-day.
  const midnightToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const isPast = (day: number) => new Date(view.y, view.m, day) <= midnightToday;

  return (
    <div className="relative" ref={box}>
      <input
        type="text"
        name={name}
        value={value}
        readOnly
        onClick={() => setOpen((o) => !o)}
        placeholder="mm/dd/yyyy"
        className={`${className || INP} cursor-pointer`}
      />
      {open ? (
        <div className="absolute left-0 top-[46px] z-20 w-[260px] border border-[#ccc] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
          {/* Title bar #E9E9E9, sampled from live; the day-name row below it is white. */}
          <div className="flex items-center justify-between bg-[#e9e9e9] px-2 py-2">
            <button type="button" onClick={() => step(-1)} aria-label="Previous month"
              className="flex h-[20px] w-[20px] items-center justify-center rounded-full bg-[#8a8a8a] text-[9px] text-white">
              ◀
            </button>
            <span className="text-sm font-bold text-[#333]">
              {MONTHS[view.m]} {view.y}
            </span>
            <button type="button" onClick={() => step(1)} aria-label="Next month"
              className="flex h-[20px] w-[20px] items-center justify-center rounded-full bg-[#333] text-[9px] text-white">
              ▶
            </button>
          </div>
          {/* border-spacing (not collapse) gives the gap between day cells that live has. */}
          <table
            className="w-full text-center text-[12px]"
            style={{ borderCollapse: "separate", borderSpacing: "2px" }}
          >
            <thead>
              <tr>
                {DOW.map((d) => (
                  <th key={d} className="py-1 font-normal text-[#666]">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: cells.length / 7 }, (_, r) => (
                <tr key={r}>
                  {cells.slice(r * 7, r * 7 + 7).map((day, i) => (
                    <td key={i} className="p-0">
                      {day == null ? (
                        <span className="block h-[26px] w-full" />
                      ) : isPast(day) ? (
                        // Past / today: boxed like every other cell, but WHITE with grey
                        // text and not clickable — live fills only the SELECTABLE dates.
                        <span className="block h-[26px] w-full border border-[#e3e3e3] bg-white leading-[26px] text-[#c9c9c9]">
                          {day}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setValue(fmt(new Date(view.y, view.m, day)));
                            setOpen(false);
                          }}
                          className="h-[26px] w-full border border-[#c8c8c8] bg-[#ededed] text-[#333] hover:bg-[#e0e0e0]"
                        >
                          {day}
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
