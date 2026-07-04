"use client";

import { useTransition } from "react";
import { selectTenant } from "@/actions/tenantActions";

interface Tenant {
  uuid: string;
  name: string;
}

// Bootstrap 2.2.2 select metrics — matches the settings form controls (30px tall).
const SEL =
  "block h-[30px] w-full rounded-[4px] border border-[#ccc] bg-white px-[6px] py-[4px] text-[14px] leading-[20px] text-[#555] " +
  "shadow-[inset_0_1px_1px_rgba(0,0,0,0.075)] outline-none transition " +
  "focus:border-[#66afe9] focus:shadow-[inset_0_1px_1px_rgba(0,0,0,0.075),0_0_8px_rgba(102,175,233,0.6)]";

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
