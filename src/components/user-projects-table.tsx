"use client";

import * as React from "react";
import type { RolloutProjectRow } from "@/actions/orderActions";

export function UserProjectsTable({
  projects,
  customerName,
}: {
  projects: RolloutProjectRow[];
  customerName: string | null;
}) {
  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter((p) =>
      [p.name, p.code, p.owner, p.customer].filter(Boolean).some((s) => String(s).toLowerCase().includes(needle)),
    );
  }, [projects, q]);

  const th = "border border-[#ddd] px-3 py-2 text-left align-bottom font-bold text-[#333]";
  const td = "border border-[#ddd] px-3 py-2 align-top text-[#333]";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <label className="flex items-center gap-2 text-sm text-[#333]">
          Search:
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-[30px] w-[240px] rounded-[4px] border border-[#cccccc] bg-white px-2 text-sm text-[#555] shadow-[inset_0_1px_1px_rgba(0,0,0,0.075)] outline-none focus:border-[#66afe9]"
          />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#f5f5f5]">
              <th className={th}>Add</th>
              <th className={th}>Remove</th>
              <th className={th}>Project Name</th>
              <th className={th}>Project Number</th>
              <th className={th}>Project Owner</th>
              <th className={th}>User Assigned Customer</th>
              <th className={th}>Customer Number</th>
              <th className={th}>ORDER</th>
            </tr>
          </thead>
          <tbody>
            {/* Special pseudo-row that always appears in the live app */}
            <tr className="odd:bg-white even:bg-[#f9f9f9]">
              <td className={td} />
              <td className={`${td} text-center`}>
                <input type="checkbox" />
              </td>
              <td className={td}>ORDERS NOT ASSIGNED TO A PROJECT</td>
              <td className={td}>N/A</td>
              <td className={td}>N/A</td>
              <td className={td}>{customerName || ""}</td>
              <td className={td} />
              <td className={td} />
            </tr>

            {filtered.map((p) => (
              <tr key={p.id} className="odd:bg-white even:bg-[#f9f9f9]">
                <td className={`${td} text-center`}>{p.assigned ? null : <input type="checkbox" />}</td>
                <td className={`${td} text-center`}>{p.assigned ? <input type="checkbox" /> : null}</td>
                <td className={td}>
                  <span className="cursor-pointer text-[#2f7ed8] hover:underline">{p.name}</span>
                </td>
                <td className={td}>{p.code}</td>
                <td className={td}>{p.owner}</td>
                <td className={td}>{p.customer}</td>
                <td className={td} />
                <td className={`${td} text-center`}>
                  <input type="checkbox" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        className="rounded-[4px] bg-[#5cb85c] px-6 py-2 text-sm font-semibold text-white hover:bg-[#4cae4c]"
      >
        SUBMIT
      </button>
    </div>
  );
}
