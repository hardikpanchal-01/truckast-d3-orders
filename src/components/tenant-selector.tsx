"use client";

import { useTransition } from "react";
import { selectTenant } from "@/actions/tenantActions";

interface Tenant {
  uuid: string;
  name: string;
}

const SEL =
  "w-full rounded-[4px] border border-[#cccccc] bg-white px-3 py-2 text-sm text-[#555] outline-none focus:border-[#66afe9]";

export function TenantSelector({
  tenants,
  currentTenant,
}: {
  tenants: Tenant[];
  currentTenant: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tenantName = e.target.value;
    startTransition(() => {
      selectTenant(tenantName);
    });
  };

  return (
    <select
      className={SEL}
      defaultValue={currentTenant}
      onChange={handleChange}
      disabled={isPending}
      style={{ opacity: isPending ? 0.6 : 1 }}
    >
      {tenants.map((tenant) => (
        <option key={tenant.uuid} value={tenant.name}>
          {tenant.name}
        </option>
      ))}
    </select>
  );
}
