import { SubHeader } from "@/components/d3-ui";
import { searchOrderProjects } from "@/actions/orderActions";
import { OrderProjectResults } from "@/components/order-project-results";

export const dynamic = "force-dynamic";

export default async function OrderByProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const { customer } = await searchParams;
  const q = (customer || "").trim();
  const res = q ? await searchOrderProjects(q) : null;

  return (
    <div className="space-y-5">
      <SubHeader title="ORDER BY PROJECT" backHref="/" />

      <h2 className="text-lg font-bold uppercase text-[#333]">Order: Project Search</h2>

      <form className="space-y-4 border-y border-[#eee] py-4">
        <input
          name="customer"
          defaultValue={q}
          placeholder="Enter a Customer Name or Number"
          className="block h-[40px] w-full rounded-[4px] border border-[#cccccc] bg-white px-3 text-sm text-[#555] shadow-[inset_0_1px_1px_rgba(0,0,0,0.075)] outline-none transition placeholder:text-[#999] focus:border-[#66afe9] focus:shadow-[inset_0_1px_1px_rgba(0,0,0,0.075),0_0_8px_rgba(102,175,233,0.6)]"
        />
        <button
          type="submit"
          className="h-[34px] w-[150px] rounded-[4px] bg-[#d2322d] text-sm font-semibold text-white hover:bg-[#c12e2a]"
        >
          SEARCH
        </button>
      </form>

      {res ? (
        res.projects.length || res.customers.length ? (
          <OrderProjectResults customers={res.customers} projects={res.projects} />
        ) : (
          <p className="text-sm text-[#777]">No projects found for “{q}”.</p>
        )
      ) : (
        <div className="pt-2">
          <input
            placeholder="Search"
            className="h-[30px] w-[274px] max-w-full rounded-[4px] border border-[#cccccc] border-t-[#bbbbbb] bg-white px-3 py-1 text-sm text-[#555] outline-none placeholder:text-[#999] focus:border-[#66afe9]"
          />
        </div>
      )}
    </div>
  );
}
