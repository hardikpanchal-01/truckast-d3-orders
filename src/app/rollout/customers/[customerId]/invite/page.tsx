import { notFound } from "next/navigation";
import { getRolloutCustomer } from "@/actions/orderActions";
import { SubHeader } from "@/components/d3-ui";

export const dynamic = "force-dynamic";

const FIELD =
  "h-[34px] w-full rounded-[4px] border border-[#cccccc] bg-white px-3 text-sm text-[#555] shadow-[inset_0_1px_1px_rgba(0,0,0,0.075)] outline-none focus:border-[#66afe9]";

function Row({ label, children, alt }: { label: string; children: React.ReactNode; alt?: boolean }) {
  return (
    <div className={`flex items-center gap-4 border-b border-[#eee] px-1 py-3 ${alt ? "bg-[#f5f5f5]" : ""}`}>
      <label className="w-[150px] shrink-0 text-sm text-[#333]">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const data = await getRolloutCustomer(Number(customerId));
  if (!data) notFound();

  return (
    <div className="space-y-5">
      <SubHeader title="INVITE" backHref={`/rollout/customers/${customerId}`} />

      <form className="max-w-[1080px]">
        <Row label="First Name:">
          <input className={FIELD} />
        </Row>
        <Row label="Last Name:">
          <input className={FIELD} />
        </Row>
        <Row label="Username/Email:">
          <input className={FIELD} placeholder="Enter a valid email address" />
        </Row>
        <Row label="Title:">
          <input className={FIELD} />
        </Row>
        <Row label="Mobile Number:">
          <input className={FIELD} />
        </Row>
        <Row label="Measurement System:" alt>
          <select className={FIELD} defaultValue="STANDARD">
            <option value="STANDARD">STANDARD</option>
            <option value="METRIC">METRIC</option>
          </select>
        </Row>
        <Row label="Invite From:">
          <select className={FIELD} defaultValue="DOLESE">
            <option value="DOLESE">DOLESE</option>
          </select>
        </Row>
        <Row label="Company:">
          <div className="h-[140px] overflow-y-auto rounded-[4px] border border-[#cccccc] bg-white p-2 text-sm text-[#333]">
            <label className="flex items-center gap-2">
              <input type="checkbox" />
              {data.name} ({data.code})
            </label>
          </div>
        </Row>

        <div className="pt-4">
          <button
            type="submit"
            className="h-[34px] w-[150px] rounded-[4px] bg-[#d2322d] text-sm font-semibold text-white hover:bg-[#c12e2a]"
          >
            SUBMIT
          </button>
        </div>
      </form>
    </div>
  );
}
