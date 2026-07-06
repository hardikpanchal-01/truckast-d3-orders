import { SubHeader } from "@/components/d3-ui";
import { getTenants, getSelectedTenant } from "@/actions/tenantActions";
import { TenantSelector } from "@/components/tenant-selector";
import { SettingsForm } from "@/components/settings-form";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  Bootstrap 2.2.2 form-control metrics (faithful to the live D3 app) */
/*  height 30px · padding 4px 6px · 14px/20px · #555 · border #ccc     */
/*  radius 4px · inset shadow · #66afe9 focus glow                     */
/* ------------------------------------------------------------------ */
const CTRL =
  "block h-[30px] w-full rounded-[4px] border border-[#ccc] bg-white px-[6px] py-[4px] text-[14px] leading-[20px] text-[#555] " +
  "shadow-[inset_0_1px_1px_rgba(0,0,0,0.075)] outline-none transition " +
  "focus:border-[#66afe9] focus:shadow-[inset_0_1px_1px_rgba(0,0,0,0.075),0_0_8px_rgba(102,175,233,0.6)]";

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

const ORDER_NOTIF = ["New Order Request", "Order Request Accepted\\Rejected", "New Post / New Comment"];

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

/* ---- .table.table-hover field row (30% label / 70% control) ------- */
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="transition-colors hover:bg-[#f5f5f5]">
      <td className="w-[30%] border-t border-[#ddd] px-2 py-2 align-middle text-[14px] leading-[20px] text-[#333]">
        {label}
      </td>
      <td className="w-[70%] border-t border-[#ddd] px-2 py-2 align-middle">{children}</td>
    </tr>
  );
}

/* ---- .table.table-striped.table-bordered cell classes ------------- */
// Header: white fill, bold uppercase 14px (matches d3); vertical rule via border-l on non-first cells.
// font-bold! (important) — the plain utility was being lost to a th weight reset, so force it.
const TH =
  "bg-white px-2 py-2 text-left align-middle text-[14px] font-bold! uppercase leading-[20px] text-[#333] [font-weight:700]";
const THL = `${TH} border-l border-[#ddd]`;
// Body: horizontal rule via border-t; vertical rule via border-l on non-first cells.
const TD = "border-t border-[#ddd] px-2 py-2 align-middle text-[14px] leading-[20px] text-[#333]";
const TDL = `${TD} border-l border-[#ddd]`;
// Striped odd rows (#f9f9f9), hover (#f5f5f5) — BS2 .table-striped/.table-hover.
const TR = "bg-white odd:bg-[#f9f9f9] transition-colors hover:bg-[#f5f5f5]";

function Check() {
  return <input type="checkbox" className="align-middle" />;
}

export default async function SettingsPage() {
  const [tenants, selectedTenant] = await Promise.all([getTenants(), getSelectedTenant()]);

  // Default to first tenant if none selected
  const currentTenant = selectedTenant || tenants[0]?.name || "";

  // 8px rhythm between sections — matches D3's .table { margin-bottom: 8px }.
  // The top cluster sets its own spacing (Welcome mt/mb-[18px]), so it stays put.
  return (
    <div
      className="space-y-2"
      style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: 14, color: "#333" }}
    >
      <SubHeader title="SETTINGS" backHref="/" />

      {/* Everything below the title bar lives in a client form that tracks unsaved
          changes and wires the Save button + Ctrl/Cmd+S to one save() path. */}
      <SettingsForm>
      {/* Top cluster — kept tight like the live app: "Welcome" sits just above the
          tenant select (small 8px gap), and the select has margin-bottom:0 so the
          field table hugs it. Grouping them removes the container's 16px gap here.
          mb-1 (4px) + the section's 8px = 12px, matching D3's gap before the
          notifications table (the wrapper's overflow-hidden stops margin-collapse,
          so these add instead of overlapping). */}
      <div className="mb-1">
        <p className="mt-[18px] mb-[18px] text-[14px] leading-[20px] text-[#333]">Welcome, Kurt!</p>

        <TenantSelector tenants={tenants} currentTenant={currentTenant} />

        {/* User preferences — like D3, each group is a separate .table.table-hover
            with an 8px bottom margin (mb-2), so Mobile and Time Format each get a
            little space beneath them. 30/70 columns. */}
        <table className="mb-2 w-full border-collapse">
          <tbody>
            <FieldRow label="Mobile Number:">
              <input className={CTRL} defaultValue="(310)555-5555" />
            </FieldRow>
          </tbody>
        </table>

        <table className="mb-2 w-full border-collapse">
          <tbody>
            <FieldRow label="Time Format:">
              <select className={CTRL}>
                <option>Friendly (Based on timing, makes it easy to understand)</option>
                <option>Timestamp (mm/dd @ hh:mm)</option>
              </select>
            </FieldRow>
          </tbody>
        </table>

        <table className="w-full border-collapse">
          <tbody>
            <FieldRow label="Measurement System:">
              <select className={CTRL}>
                <option>STANDARD</option>
                <option>METRIC</option>
              </select>
            </FieldRow>
            <FieldRow label="Time Zone:">
              <select className={CTRL} defaultValue="(UTC-06:00) Central Time (US & Canada)">
                {TIMEZONES.map((tz) => (
                  <option key={tz}>{tz}</option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Market Summary View:">
              <select className={CTRL}>
                <option>COMPANY</option>
                <option>PROJECT</option>
              </select>
            </FieldRow>
          </tbody>
        </table>
      </div>

      {/* Notifications — BS2 .table-striped.table-bordered (rounded corners) */}
      <div className="overflow-hidden rounded-[4px] border border-[#ddd]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={TH}>Notifications</th>
              <th className={`${THL} w-[110px]`}>Email</th>
              <th className={`${THL} w-[110px]`}>SMS</th>
            </tr>
          </thead>
          <tbody>
            {NOTIF.map((n) => (
              <tr key={n.label} className={TR}>
                <td className={TD}>{n.label}</td>
                <td className={`${TDL}`}>{n.email ? <Check /> : null}</td>
                <td className={`${TDL}`}>
                  <Check />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Order request notifications */}
      <div className="overflow-hidden rounded-[4px] border border-[#ddd]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={TH}>
                <span className="align-middle">Order Request Notifications</span>
                <span className="ml-4 inline-flex items-center gap-1 align-middle normal-case">
                  <span className="text-[12px] font-bold text-[#333]">Requests:</span>
                  <select className="h-[24px] rounded-[3px] border border-[#ccc] bg-white px-1 text-[12px] font-normal text-[#555] outline-none">
                    <option>My</option>
                    <option>Company</option>
                  </select>
                </span>
              </th>
              <th className={`${THL} w-[110px]`}>Email</th>
              <th className={`${THL} w-[110px]`}>SMS</th>
            </tr>
          </thead>
          <tbody>
            {ORDER_NOTIF.map((label) => (
              <tr key={label} className={TR}>
                <td className={TD}>{label}</td>
                <td className={`${TDL}`}>
                  <Check />
                </td>
                <td className={`${TDL}`}>
                  <Check />
                </td>
              </tr>
            ))}
            <tr className="bg-white">
              <td colSpan={3} className="border-t border-[#ddd] px-2 py-2 text-[13px] leading-[20px] text-[#333]">
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
      </div>

      {/* Option / hide tiles */}
      <div className="overflow-hidden rounded-[4px] border border-[#ddd]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={TH}>Option</th>
              <th className={`${THL} w-[110px]`}>Hide</th>
            </tr>
          </thead>
          <tbody>
            {OPTIONS.map((label) => (
              <tr key={label} className={TR}>
                <td className={TD}>{label}</td>
                <td className={`${TDL}`}>
                  <Check />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      </SettingsForm>
    </div>
  );
}
