"use client";

import * as React from "react";
import Link from "next/link";
import { FoldCard, SearchBox } from "@/components/d3-ui";
import type { RolloutUser } from "@/actions/orderActions";

/** "2026-06-29T..." -> "6/29" */
function loginMd(ts: string | null): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function UserCard({ u }: { u: RolloutUser }) {
  const md = loginMd(u.last_login);
  return (
    <Link href={`/rollout/users/${u.id}`} className="block">
    <FoldCard tone="green" className="h-[90px] w-full cursor-pointer text-white sm:w-[274px]">
      <div className="flex h-full items-center gap-2 p-1">
        <div className="flex h-[82px] w-[72px] shrink-0 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://d3.truckast.com/Images/Tiles/Completed.png"
            alt=""
            className="h-[82px] w-[72px] object-contain"
          />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[14px] opacity-95">{md ? `LOGGED IN ON ${md}` : "NOT LOGGED IN"}</p>
          <p className="truncate text-[16px] font-bold leading-tight">{(u.full_name || "—").toUpperCase()}</p>
          <p className="truncate text-[12px] opacity-90">{u.email}</p>
        </div>
      </div>
    </FoldCard>
    </Link>
  );
}

export function RolloutUserList({ users }: { users: RolloutUser[] }) {
  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((u) =>
      [u.full_name, u.email].filter(Boolean).some((s) => String(s).toLowerCase().includes(needle)),
    );
  }, [users, q]);

  return (
    <div className="space-y-3">
      <SearchBox value={q} onChange={setQ} placeholder="Search" />
      {filtered.length === 0 ? (
        <p className="text-sm text-[#777]">No users for this customer.</p>
      ) : (
        <div className="flex flex-wrap gap-[10px]">
          {filtered.map((u) => (
            <UserCard key={u.id} u={u} />
          ))}
        </div>
      )}
    </div>
  );
}
