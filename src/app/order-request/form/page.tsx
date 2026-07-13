import { getRolloutCustomer, getProjectBasic, getReferencedOrders } from "@/actions/orderActions";
import JobAddressField from "./JobAddressField";

export const dynamic = "force-dynamic";

// Matches D3's .form-control: grey fill, 4px left accent bar, square corners, 42px tall.
const INP =
  "block h-[42px] w-full rounded-none border border-[#f6f6f6] border-l-4 border-l-[#cfcfcf] bg-[#f6f6f6] px-3 py-1 text-sm text-[#555] outline-none focus:border-[#ffcb05] focus:border-l-[#ffcb05]";

// Matches D3's <li class="form-group badge-li"> + absolute .number-badge (25px yellow circle
// in the left gutter). The gutter itself comes from the <ol> content-box margin below.
function Field({
  n,
  label,
  required,
  children,
}: {
  n: number;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="relative mb-5 pl-[25px]">
      <span className="absolute left-[-30px] top-[-1px] flex h-[25px] w-[25px] items-center justify-center rounded-full bg-[#ffcb05] text-[14px] font-bold text-black">
        {n}
      </span>
      {/* D3 .wizard-form-text-label: inline, 15px/500/#575757, no margin (block input drops below). */}
      <label className="text-[15px] font-medium text-[#575757]">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
    </li>
  );
}

export default async function OrderRequestFormPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; project?: string }>;
}) {
  const { customer, project } = await searchParams;

  let companyName = "";
  let jobName = "";
  if (project) {
    const p = await getProjectBasic(Number(project));
    companyName = p?.customer_name || "";
    jobName = p?.name || "";
  } else if (customer) {
    const cust = await getRolloutCustomer(Number(customer));
    companyName = cust?.name || "";
  }

  // Referenced Order (#2) options — the customer's recent orders, newest first.
  const referencedOrders = await getReferencedOrders({
    projectId: project ? Number(project) : undefined,
    customerId: customer ? Number(customer) : undefined,
  });

  // On Job Date — the next 30 days starting today, e.g. "TUE, JUN 30".
  const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const today = new Date();
  const dateOptions = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return `${DAYS[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
  });

  // On Job Time — every 15 minutes across the day, "HH:MM".
  const timeOptions: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      timeOptions.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }

  return (
    <div className="space-y-4">
      {/* D3 .header-banner: yellow bar, 5px slate top border, 30px title (left-aligned on
          narrow widths), logo pinned right. */}
      <div className="relative mx-auto w-full min-[768px]:max-w-[750px] min-[992px]:max-w-[970px] min-[1200px]:max-w-[1170px] border-t-[5px] border-[#44525d] bg-[#ffcb05] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.12)]">
        <span className="block text-center text-[30px] font-bold text-[#00502f] max-[980px]:text-left max-[631px]:text-[25px] max-[431px]:text-[15px]">
          Order Request Form
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://d3.truckast.com/images/logos/dolese-logo.svg"
          alt="DOLESE"
          className="absolute right-[10px] top-[3px] h-[35px] w-auto"
        />
      </div>

      {/* D3 .order-request-form--wrapper: 40px padding, soft shadow, square-ish card. */}
      <form className="mx-auto w-full min-[768px]:max-w-[750px] min-[992px]:max-w-[970px] min-[1200px]:max-w-[1170px] rounded-[10px] bg-white p-10 shadow-[0_0_12px_2px_rgba(0,0,0,0.16)]">
        {/* D3 .order-form-content-box: 3em side inset (1em on ≤600px) — the field gutter. */}
        <ol className="mx-12 list-none p-0 max-[600px]:mx-4">
        <Field n={1} label="Company">
          {/* Read-only: the company is fixed by the customer/project the form was opened for. */}
          <select className={`${INP} cursor-not-allowed opacity-90`} defaultValue={companyName} disabled>
            <option>{companyName || "Select Company"}</option>
          </select>
        </Field>
        <Field n={2} label="Referenced Order">
          <select className={INP} defaultValue="">
            <option value="">SELECT RECENT ORDERS</option>
            {referencedOrders.map((o) => (
              <option key={o.order_id} value={o.order_id}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field n={3} label="Job Name">
          {/* Read-only: the job name comes from the selected project. */}
          <input className={`${INP} cursor-not-allowed`} readOnly value={jobName} placeholder="Enter Job Name" />
        </Field>
        <Field n={4} label="Customer Job Number">
          <input className={INP} placeholder="Enter Customer Job Number" />
        </Field>
        <Field n={5} label="P.O. Number">
          <input className={INP} placeholder="Enter PO Number" />
        </Field>
        <Field n={6} label="Order Verification Contact Name" required>
          <input className={INP} defaultValue="Kurt Kratchman" />
        </Field>
        <Field n={7} label="Order Verification Contact Phone Number" required>
          <input className={INP} defaultValue="(310)555-5555" />
        </Field>
        <Field n={8} label="Add a Job Site Contact">
          <div className="flex items-center gap-4 text-sm text-[#333]">
            <label className="flex items-center gap-1">
              <input type="radio" name="jobsite" /> Yes
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" name="jobsite" defaultChecked /> No
            </label>
          </div>
        </Field>
        <Field n={9} label="On Job Date" required>
          <select className={INP} defaultValue={dateOptions[0]}>
            {dateOptions.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field n={10} label="On Job Time" required>
          <select className={INP} defaultValue="00:00">
            {timeOptions.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field n={11} label="Job Address" required>
          <JobAddressField />
        </Field>
        <Field n={12} label="Usage" required>
          <select className={INP}>
            <option>Pick a Usage</option>
          </select>
        </Field>
        <Field n={13} label="Do You Know The Mix Code?" required>
          <div className="flex items-center gap-4 text-sm text-[#333]">
            <label className="flex items-center gap-1">
              <input type="radio" name="mixcode" /> Yes
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" name="mixcode" /> No
            </label>
          </div>
        </Field>
        <Field n={14} label="Slump" required>
          <select className={INP}>
            <option>Select Slump</option>
          </select>
        </Field>
        <Field n={15} label="Quantity" required>
          <input className={INP} placeholder="Enter Quantity" />
        </Field>
        <Field n={16} label="CallBack Load">
          <select className={INP}>
            <option>Select CallBack</option>
          </select>
        </Field>
        <Field n={17} label="Truck Spacing">
          <select className={INP} defaultValue="75 minutes">
            <option>75 minutes</option>
          </select>
        </Field>
        <Field n={18} label="Order Status" required>
          <select className={INP}>
            <option>Select Order Status</option>
          </select>
        </Field>
        <Field n={19} label="Pumped">
          <div className="flex items-center gap-4 text-sm text-[#333]">
            <label className="flex items-center gap-1">
              <input type="radio" name="pumped" /> Yes
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" name="pumped" defaultChecked /> No
            </label>
          </div>
        </Field>
        <Field n={20} label="Admixture Product">
          <input className={INP} placeholder="Select Admixture" />
        </Field>
        <Field n={21} label="Other Products">
          <input className={INP} placeholder="Select Other Products" />
        </Field>
        <Field n={22} label="Notes & Comments">
          <textarea className={`${INP} !h-[100px] resize-none`} placeholder="Enter Notes, Comments, Delivery Instructions, etc." />
        </Field>

        </ol>
        <div className="pt-4 text-center">
          <button
            type="submit"
            className="rounded-[4px] bg-[#f5c518] px-8 py-2 text-sm font-semibold text-[#1f3a2d] hover:bg-[#e6b800]"
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  );
}
