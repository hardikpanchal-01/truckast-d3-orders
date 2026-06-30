"use client";

import * as React from "react";
import Link from "next/link";
import { FoldCard, SearchBox } from "@/components/d3-ui";
import type { OrderProjectCard } from "@/actions/orderActions";

function NewOrderCard({ customerId, customerName }: { customerId: number; customerName: string | null }) {
  return (
    <Link href={`/order-request/form?customer=${customerId}`} className="block">
      <FoldCard tone="blue" className="h-[90px] w-[274px] cursor-pointer text-white">
        <div className="flex h-full items-center gap-2 p-1">
          <div className="flex h-[80px] w-[72px] shrink-0 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://d3.truckast.com/Images/fill_form64orderwoproject.png"
              alt=""
              style={{ width: 72, height: 80 }}
              className="object-contain"
            />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[12px] opacity-95">{customerName}</p>
            <p className="truncate text-[15px] font-bold leading-tight">NEW ORDER</p>
            <p className="truncate text-[12px] opacity-90">W/O PROJECT</p>
          </div>
        </div>
      </FoldCard>
    </Link>
  );
}

function ProjectCard({ p }: { p: OrderProjectCard }) {
  return (
    <Link href={`/order-request/form?project=${p.project_id}`} className="block">
      <FoldCard tone="green" className="h-[90px] w-[274px] cursor-pointer text-white">
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
            <p className="truncate text-[12px] opacity-95">{p.customer_name}</p>
            <p className="truncate text-[14px] font-bold leading-tight">{p.project_name}</p>
            <p className="truncate text-[11px] opacity-90">Recent Orders {p.recent_orders}</p>
            <p className="truncate text-[11px] opacity-90">
              Project {p.project_code} Customer {p.customer_code}
            </p>
          </div>
        </div>
      </FoldCard>
    </Link>
  );
}

export function OrderProjectResults({
  customers,
  projects,
}: {
  customers: { id: number; name: string | null; code: string | null }[];
  projects: OrderProjectCard[];
}) {
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

  // Only show a "NEW ORDER W/O PROJECT" card for customers that actually have projects.
  const codesWithProjects = React.useMemo(
    () => new Set(projects.map((p) => p.customer_code).filter(Boolean)),
    [projects],
  );
  const blueCustomers = customers.filter((c) => codesWithProjects.has(c.code));

  return (
    <div className="space-y-3">
      <SearchBox value={q} onChange={setQ} placeholder="Search" />
      <div className="flex flex-wrap gap-[10px]">
        {blueCustomers.map((c) => (
          <NewOrderCard key={`c-${c.id}`} customerId={c.id} customerName={c.name} />
        ))}
        {filtered.map((p) => (
          <ProjectCard key={p.project_id} p={p} />
        ))}
      </div>
    </div>
  );
}
