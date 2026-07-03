"use client";

import * as React from "react";
import Link from "next/link";
import { FoldCard, SearchBox } from "@/components/d3-ui";
import type { OrderProjectCard } from "@/actions/orderActions";

function ProjectCard({ p }: { p: OrderProjectCard }) {
  return (
    <Link href={`/order-request/form?project=${p.project_id}`} className="block">
      <FoldCard tone="green" className="h-[90px] w-full cursor-pointer text-white sm:w-[274px]">
        <div className="flex h-full items-center gap-2 p-1">
          <div className="flex h-[80px] w-[72px] shrink-0 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://d3.truckast.com/Images/fill_form64-restricted.png"
              alt=""
              style={{ width: 64, height: 64 }}
              className="object-contain"
            />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] opacity-95">{p.customer_name}</p>
            <p className="truncate text-[15px] font-bold leading-tight">{p.project_name}</p>
          </div>
        </div>
      </FoldCard>
    </Link>
  );
}

export function ProjectList({ projects }: { projects: OrderProjectCard[] }) {
  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter((p) =>
      [p.project_name, p.project_code, p.customer_name, p.customer_code]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle)),
    );
  }, [projects, q]);

  return (
    <div className="space-y-3">
      <SearchBox value={q} onChange={setQ} placeholder="Search" />
      {filtered.length === 0 ? (
        <p className="text-sm text-[#777]">No projects found.</p>
      ) : (
        <div className="flex flex-wrap gap-[10px]">
          {filtered.map((p) => (
            <ProjectCard key={p.project_id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
