import { notFound } from "next/navigation";
import { getRolloutUser } from "@/actions/orderActions";
import { SubHeader } from "@/components/d3-ui";

export const dynamic = "force-dynamic";

export default async function AddProjectsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const u = await getRolloutUser(userId);
  if (!u) notFound();

  return (
    <div className="space-y-5">
      <SubHeader title="Projects" subtitle={u.full_name || undefined} backHref={`/rollout/users/${userId}`} />

      <h2 className="text-lg font-bold text-[#333]">Give User Company Project Access</h2>

      <form className="space-y-4 border-y border-[#eee] py-4">
        <input
          name="customer"
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
    </div>
  );
}
