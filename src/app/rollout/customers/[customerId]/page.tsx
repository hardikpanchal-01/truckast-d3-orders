import Link from "next/link";
import { notFound } from "next/navigation";
import { getRolloutCustomer } from "@/actions/orderActions";
import { SubHeader } from "@/components/d3-ui";
import { RolloutUserList } from "@/components/rollout-user-list";

export const dynamic = "force-dynamic";

export default async function RolloutCustomerPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const data = await getRolloutCustomer(Number(customerId));
  if (!data) notFound();

  return (
    <div className="space-y-4">
      <SubHeader title={data.name || "—"} backHref="/rollout/search" />

      <Link
        href={`/rollout/customers/${customerId}/invite`}
        className="inline-flex h-[30px] w-[150px] items-center justify-center rounded-[4px] bg-[#d2322d] text-sm font-semibold text-white hover:bg-[#c12e2a]"
      >
        Invite
      </Link>

      <RolloutUserList users={data.users} />
    </div>
  );
}
