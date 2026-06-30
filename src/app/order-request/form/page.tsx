import { MapPin } from "lucide-react";
import { getRolloutCustomer, getProjectBasic } from "@/actions/orderActions";

export const dynamic = "force-dynamic";

const INP =
  "w-full rounded-[4px] border border-[#e6e6e6] bg-[#f7f7f7] px-3 py-2 text-sm text-[#333] outline-none focus:border-[#66afe9]";

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
    <div className="flex gap-3 py-3">
      <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f5c518] text-[12px] font-bold text-black">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <label className="mb-1 block text-sm text-[#333]">
          {label}
          {required ? <span className="text-red-500"> *</span> : null}
        </label>
        {children}
      </div>
    </div>
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
      {/* Yellow title bar with the DOLESE logo (square corners) */}
      <div className="relative mx-auto flex max-w-[1140px] items-center border-t-[3px] border-[#00502f] bg-[#f5c518] px-5 py-4 shadow-[0_2px_10px_rgba(0,0,0,0.12)]">
        <span className="w-full text-center text-[26px] font-bold text-[#00502f]">Order Request Form</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://d3.truckast.com/images/logos/dolese-logo.svg"
          alt="DOLESE"
          className="absolute right-5 top-1/2 h-9 w-auto -translate-y-1/2"
        />
      </div>

      <form className="mx-auto max-w-[1140px] rounded-[10px] border border-[#e5e5e5] bg-white p-6 shadow-[0_2px_16px_rgba(0,0,0,0.12)]">
        <Field n={1} label="Company">
          <select className={INP} defaultValue={companyName}>
            <option>{companyName || "Select Company"}</option>
          </select>
        </Field>
        <Field n={2} label="Referenced Order">
          <select className={INP}>
            <option>SELECT RECENT ORDERS</option>
          </select>
        </Field>
        <Field n={3} label="Job Name">
          <input className={INP} placeholder="Enter Job Name" defaultValue={jobName} />
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
          <div className="flex items-stretch gap-2">
            <span className="flex w-10 shrink-0 items-center justify-center rounded-[4px] bg-[#f5c518] text-[#1f3a2d]">
              <MapPin className="h-5 w-5" strokeWidth={2} />
            </span>
            <input className={INP} placeholder="Enter Job Address Or Set Pin From Map Icon" />
          </div>
          <label className="mb-1 mt-3 block text-sm text-[#333]">Region</label>
          <input className={INP} placeholder="Region Will Be Populated Based On the Job Adress" />
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
          <textarea className={`${INP} h-24 resize-none`} placeholder="Enter Notes, Comments, Delivery Instructions, etc." />
        </Field>

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
