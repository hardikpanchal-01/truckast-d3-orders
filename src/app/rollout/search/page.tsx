import Link from "next/link";
import { searchRolloutCustomers, type RolloutCustomerItem } from "@/actions/orderActions";
import { SubHeader, FoldCard } from "@/components/d3-ui";

export const dynamic = "force-dynamic";

function CustomerResultCard({ c }: { c: RolloutCustomerItem }) {
  return (
    <Link href={`/rollout/customers/${c.id}`} className="block">
      <FoldCard tone="green" className="h-[90px] w-[274px] cursor-pointer text-white">
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
            <p className="truncate text-[14px] opacity-95">#{c.code}</p>
            <p className="truncate text-[16px] font-bold leading-tight">{c.name}</p>
            <p className="truncate text-[12px] opacity-90">{c.user_count} USERS</p>
          </div>
        </div>
      </FoldCard>
    </Link>
  );
}

export default async function RolloutSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const { customer } = await searchParams;
  const q = (customer || "").trim();
  const results = q ? await searchRolloutCustomers(q) : [];

  return (
    <div className="space-y-6">
      <SubHeader title="SEARCH" backHref="/" />

      <form action="/rollout/search" method="get" className="space-y-4 pt-2">
        <input
          name="customer"
          defaultValue={q}
          placeholder="Enter Invitee's Company Name"
          className="block h-[40px] w-full rounded-[4px] border border-[#cccccc] bg-white px-3 text-sm text-[#555] shadow-[inset_0_1px_1px_rgba(0,0,0,0.075)] outline-none transition placeholder:text-[#999] focus:border-[#66afe9] focus:shadow-[inset_0_1px_1px_rgba(0,0,0,0.075),0_0_8px_rgba(102,175,233,0.6)]"
        />
        <button
          type="submit"
          className="h-[30px] w-[150px] rounded-[4px] bg-[#d2322d] text-sm font-semibold text-white hover:bg-[#c12e2a]"
        >
          Search
        </button>
      </form>

      {q ? (
        results.length ? (
          <div className="flex flex-wrap gap-[10px]">
            {results.map((c) => (
              <CustomerResultCard key={c.id} c={c} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#777]">No customers found for “{q}”.</p>
        )
      ) : null}
    </div>
  );
}
