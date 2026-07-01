import { SubHeader } from "@/components/d3-ui";
import { getTenants, getSelectedTenant, saveSelectedTenant } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

const SEL =
  "w-full rounded-[4px] border border-[#cccccc] bg-white px-3 py-2 text-sm text-[#555] outline-none focus:border-[#66afe9]";

const NOTIF: { label: string; email: boolean }[] = [
  { label: "New Order", email: false },
  { label: "Updated Order", email: false },
  { label: "First Truck", email: false },
  { label: "Last Truck", email: false },
  { label: "Late Truck", email: false },
  { label: "Plus Load", email: false },
  { label: "Will Call Order Reminder", email: false },
  { label: "New Post", email: true },
  { label: "New Comment", email: true },
];

const ORDER_NOTIF = ["New Order Request", "Order Request Accepted\\Rejected", "New Post", "New Comment"];

const TIMEZONES = [
  "(UTC-10:00) Hawaii",
  "(UTC-07:00) Mountain Time (US & Canada)",
  "(UTC-05:00) Eastern Time (US & Canada)",
  "(UTC-06:00) Central Time (US & Canada)",
  "(UTC-07:00) Arizona",
  "(UTC-08:00) Pacific Time (US & Canada)",
];

const OPTIONS = [
  "Loads Tile",
  "On Time Tile",
  "Volume Tile",
  "Pour Rate Tile",
  "Producer Delay Tile",
  "Customer Delay Tile",
  "Pour Speed Chart",
  "Trucks On Job Chart",
  "Tickets With Status Times Table",
  "Delay Details Button",
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[#eee] py-3">
      <label className="w-[170px] shrink-0 text-sm text-[#333]">{label}</label>
      <div className="min-w-[240px] flex-1">{children}</div>
    </div>
  );
}

const TH = "border border-[#e3e3e3] bg-[#f5f5f5] px-3 py-2 text-left text-[12px] font-bold uppercase text-[#333]";
const TD = "border border-[#e3e3e3] px-3 py-2 text-[13px] text-[#333]";
const TDC = "border border-[#e3e3e3] px-3 py-2 text-center";

export default async function SettingsPage() {
  const [tenants, selectedTenant] = await Promise.all([
    getTenants(),
    getSelectedTenant(),
  ]);

  // Default to first tenant if none selected
  const currentTenant = selectedTenant || tenants[0]?.name || "";

  return (
    <form action={saveSelectedTenant} className="space-y-5">
      <SubHeader title="SETTINGS" backHref="/" />

      <p className="text-sm text-[#333]">Welcome, Kurt!</p>

      <select name="tenant" className={SEL} defaultValue={currentTenant}>
        {tenants.map((tenant) => (
          <option key={tenant.uuid} value={tenant.name}>
            {tenant.name}
          </option>
        ))}
      </select>

      <div>
        <Row label="Mobile Number:">
          <input className={SEL} defaultValue="(310)555-5555" />
        </Row>
        <Row label="Time Format:">
          <select className={SEL}>
            <option>Friendly (Based on timing, makes it easy to understand)</option>
            <option>Timestamp (mm/dd @ hh:mm)</option>
          </select>
        </Row>
        <Row label="Measurement System:">
          <select className={SEL}>
            <option>STANDARD</option>
            <option>METRIC</option>
          </select>
        </Row>
        <Row label="Time Zone:">
          <select className={SEL} defaultValue="(UTC-06:00) Central Time (US & Canada)">
            {TIMEZONES.map((tz) => (
              <option key={tz}>{tz}</option>
            ))}
          </select>
        </Row>
        <Row label="Market Summary View:">
          <select className={SEL}>
            <option>COMPANY</option>
            <option>PROJECT</option>
          </select>
        </Row>
      </div>

      {/* Notifications */}
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={TH}>Notifications</th>
            <th className={`${TH} w-[120px] text-center`}>Email</th>
            <th className={`${TH} w-[120px] text-center`}>SMS</th>
          </tr>
        </thead>
        <tbody>
          {NOTIF.map((n) => (
            <tr key={n.label} className="odd:bg-[#f7f7f7]">
              <td className={TD}>{n.label}</td>
              <td className={TDC}>{n.email ? <input type="checkbox" /> : null}</td>
              <td className={TDC}>
                <input type="checkbox" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Order request notifications */}
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={TH}>Order Request Notifications</th>
            <th className={`${TH} w-[120px] text-center`}>Email</th>
            <th className={`${TH} w-[120px] text-center`}>SMS</th>
          </tr>
        </thead>
        <tbody>
          {ORDER_NOTIF.map((label) => (
            <tr key={label} className="odd:bg-[#f7f7f7]">
              <td className={TD}>{label}</td>
              <td className={TDC}>
                <input type="checkbox" />
              </td>
              <td className={TDC}>
                <input type="checkbox" />
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={3} className="border border-[#e3e3e3] px-3 py-3 text-[13px] leading-relaxed text-[#333]">
              Truckast Order Requests are monitored Monday through Friday, from 7:30 AM to 5:00 PM. Dolese will respond
              to all order submissions received during normal business hours within 30 minutes of the request being
              submitted. Any order submitted outside of normal business hours will be reviewed and followed up on by 8:00
              AM on the next business day. An order will be considered valid and confirmed once the requested delivery
              time and order details have been acknowledged and confirmed by Dolese, either through Truckast
              communication or direct phone contact.
            </td>
          </tr>
        </tbody>
      </table>

      {/* Option / hide tiles */}
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={TH}>Option</th>
            <th className={`${TH} w-[120px] text-center`}>Hide</th>
          </tr>
        </thead>
        <tbody>
          {OPTIONS.map((label) => (
            <tr key={label} className="odd:bg-[#f7f7f7]">
              <td className={TD}>{label}</td>
              <td className={TDC}>
                <input type="checkbox" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex gap-3 pb-4">
        <button
          type="button"
          className="rounded-[4px] bg-[#5cb85c] px-5 py-2 text-sm font-semibold text-white hover:bg-[#4cae4c]"
        >
          ADMIN Settings
        </button>
        <button
          type="submit"
          className="rounded-[4px] bg-[#d2322d] px-6 py-2 text-sm font-semibold text-white hover:bg-[#c12e2a]"
        >
          Save
        </button>
      </div>
    </form>
  );
}
