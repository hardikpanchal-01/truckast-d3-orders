import { getRolloutCustomer, getProjectBasic, getReferencedOrders } from "@/actions/orderActions";
import JobAddressField from "./JobAddressField";
import DateOfPourField from "./DateOfPourField";
import { CARD, INP, LBL, REQ } from "./styles";
import css from "./form.module.css";
import { isMarketViewTenant } from "@/lib/tenant-view";
import { getConcreteMixes, getDeliveryAddress } from "@/actions/marketActions";

export const dynamic = "force-dynamic";

// Matches D3's <li class="form-group badge-li"> + absolute .number-badge (25px yellow circle
// in the left gutter). The gutter itself comes from the <ol> content-box margin below.
function Field({
  n,
  label,
  required,
  extraGap,
  badge,
  children,
}: {
  n: number;
  label: string;
  required?: boolean;
  /** Badge colour classes — Dolese's yellow circle, or Hercules' maroon one. */
  badge?: string;
  /** D3 trails the Admixture and Other Products rows with a stray `<br>` after their
   *  hidden inputs, which renders a 20px line box on top of the row's own 20px margin. */
  extraGap?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className={`relative pl-[25px] ${extraGap ? "mb-10" : "mb-5"}`}>
      <span
        className={`absolute left-[-30px] top-[-1px] flex h-[25px] w-[25px] items-center justify-center rounded-full text-[14px] font-bold ${
          badge || "bg-[#ffcb05] text-black"
        }`}
      >
        {n}
      </span>
      {/* D3 keeps the space OUTSIDE span.require ("Label <span>*</span>"), so the span box
          is just the asterisk. */}
      <label className={LBL}>
        {label}
        {required ? <> <span className={REQ}>*</span></> : null}
      </label>
      {children}
    </li>
  );
}

// D3 .custom-radio > .form-input-radio > .custom-input-radio--wrapper: a row of Yes/No
// (stacking below 600px), each item 5px/20px-margined, 5px between the dot and its text.
function YesNo({ name, defaultChecked }: { name: string; defaultChecked?: "yes" | "no" }) {
  return (
    <div className={`${css.radioGroup} text-sm text-[#333]`}>
      {(["yes", "no"] as const).map((v) => (
        <label key={v} className="my-[5px] mr-5 flex items-center">
          <input
            type="radio"
            name={name}
            value={`${name}${v}`}
            defaultChecked={defaultChecked === v}
            className="mr-[5px]"
          />
          {v === "yes" ? "Yes" : "No"}
        </label>
      ))}
    </div>
  );
}

export default async function OrderRequestFormPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; project?: string; pname?: string; paddr?: string }>;
}) {
  const { customer, project, pname, paddr } = await searchParams;

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

  /* ------------------------------------------------------------------ *
   * Hercules order form — a different form entirely from Dolese's: nine
   * fields instead of twenty-two, a maroon #A32835 theme (banner, number
   * badges, Submit — all pixel-sampled from the live board) and the
   * Hercules logo. Dolese and every other tenant fall through to the
   * original 22-field yellow form below, untouched.
   * ------------------------------------------------------------------ */
  if (await isMarketViewTenant()) {
    const BADGE = "bg-[#A32835] text-white";
    // INP's focus ring is Dolese yellow; swap it to the Hercules maroon. Derived from the
    // shared constant so any other INP change flows through automatically.
    const INP_H = INP.replace(/#ffcb05/g, "#A32835");
    const [mixes, deliveryAddress] = await Promise.all([
      getConcreteMixes(),
      getDeliveryAddress({
        projectId: project ? Number(project) : undefined,
        customerId: customer ? Number(customer) : undefined,
      }),
    ]);
    return (
      <div className="space-y-5">
        {/* Slate top border, same as Dolese's — sampled #44525D directly above live's
            maroon band. The band itself measures 60px tall. */}
        {/* 60px maroon band, measured on live (ours rendered 46px). */}
        <div className={`${CARD} relative border-t-[5px] border-[#44525d] bg-[#A32835] px-5 py-[20px]`}>
          <span className={`${css.bannerTitle} !text-white`} style={{ textAlign: "center", display: "block" }}>
            Order Request Form
          </span>
          {/* NOT css.bannerLogo: that class forces width:270px below 980px, which stretched
              this JPG right across the title. Fixed height, natural width, pinned right. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://d3.truckast.com/images/logos/HerculesLogoWhite.jpg"
            alt="HERCULES"
            className="absolute right-[10px] top-1/2 h-[52px] w-auto -translate-y-1/2"
          />
        </div>

        <form className={`${CARD} rounded-[10px] bg-white p-10 shadow-[0_0_12px_2px_rgba(0,0,0,0.16)]`}>
          <ol className={css.contentBox}>
            {/* `pname`/`paddr` come from the tiles that have no project row behind them —
                they carry their prefill values on the link. A real project always wins. */}
            <Field n={1} label="Project Name" required badge={BADGE}>
              <input className={INP_H} defaultValue={jobName || pname || ""} placeholder="Enter Project Name" />
            </Field>
            <Field n={2} label="Delivery Street Address" required badge={BADGE}>
              <input
                className={INP_H}
                defaultValue={deliveryAddress || paddr || ""}
                placeholder="Enter Delivery Street Address"
              />
            </Field>
            <Field n={3} label="Concrete product" required badge={BADGE}>
              <select className={INP_H} defaultValue="">
                <option value="">Select Mix</option>
                {mixes.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.description}
                  </option>
                ))}
              </select>
            </Field>
            <Field n={4} label="Cubic Yards" required badge={BADGE}>
              <input className={INP_H} placeholder="Enter Quantity" />
            </Field>
            <Field n={5} label="Spacing (Cubic Yards/Hour)" required badge={BADGE}>
              <input className={INP_H} placeholder="Enter delivered Cubic Yards/Hour" />
            </Field>
            <Field n={6} label="Admixture" required badge={BADGE}>
              <YesNo name="admixture" />
            </Field>
            <Field n={7} label="Date of pour" required badge={BADGE}>
              <DateOfPourField className={INP_H} />
            </Field>
            <Field n={8} label="Delivery time" required badge={BADGE}>
              <select className={INP_H} defaultValue="06:00">
                {timeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field n={9} label="Notes &amp; Comments" badge={BADGE}>
              <textarea
                className={`${INP_H} !h-[100px] resize-none leading-[130%]`}
                placeholder="Enter Notes, Comments, Delivery Instructions, etc."
              />
            </Field>
          </ol>
          <div className="flex justify-center">
            <button
              type="submit"
              className="mt-5 rounded-[5px] border-0 bg-[#A32835] px-[3em] py-[0.7em] text-sm font-normal text-white"
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    // space-y-5 is D3 .header-banner's `margin-bottom: 20px` down to the card.
    <div className="space-y-5">
      {/* D3 .header-banner: yellow bar, 5px slate top border, 30px title (left-aligned on
          narrow widths), logo pinned right. D3 puts NO box-shadow on this bar. */}
      <div className={`${CARD} relative border-t-[5px] border-[#44525d] bg-[#ffcb05] p-5`}>
        {/* Title + logo carry D3's max-width breakpoints, which live in form.module.css —
            see the note there on why they can't be Tailwind variants. */}
        <span className={css.bannerTitle}>Order Request Form</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://d3.truckast.com/images/logos/dolese-logo.svg" alt="DOLESE" className={css.bannerLogo} />
      </div>

      {/* D3 .order-request-form--wrapper: 40px padding, soft shadow, square-ish card. */}
      <form className={`${CARD} rounded-[10px] bg-white p-10 shadow-[0_0_12px_2px_rgba(0,0,0,0.16)]`}>
        {/* D3 .order-form-content-box: 3em side inset (1em on ≤600px) — the field gutter. */}
        <ol className={css.contentBox}>
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
          <YesNo name="jobsite" defaultChecked="no" />
        </Field>
        <Field n={9} label="On Job Date" required>
          <select className={INP} defaultValue={dateOptions[0]}>
            {dateOptions.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field n={10} label="On Job Time" required>
          {/* D3 .form-control-time trims this one control to 36px (every other is 42px). */}
          <select className={`${INP} !h-[36px] cursor-pointer`} defaultValue="00:00">
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
          <YesNo name="mixcode" />
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
          <YesNo name="pumped" defaultChecked="no" />
        </Field>
        <Field n={20} label="Admixture Product" extraGap>
          <input className={INP} placeholder="Select Admixture" />
        </Field>
        <Field n={21} label="Other Products" extraGap>
          <input className={INP} placeholder="Select Other Products" />
        </Field>
        <Field n={22} label="Notes & Comments">
          {/* D3 .txtarea overrides .form-control's line-height with 130%. */}
          <textarea
            className={`${INP} !h-[100px] resize-none leading-[130%]`}
            placeholder="Enter Notes, Comments, Delivery Instructions, etc."
          />
        </Field>

        </ol>
        {/* D3 .form-group-btn--wrapper + .btn-success: the 20px standoff is the button's own
            margin-top, and its padding is em-based off its 14px font-size (9.8px/42px).
            D3's markup is `class="btn-success"` WITHOUT `btn`, so `.btn`'s `margin: 0 2px`
            never lands — the button has no horizontal margin. The inline <style> kills
            .btn-success's gradient (`background-image: none !important`) but NOT its
            text-shadow, which survives from d3_complete.css and is still painted. */}
        <div className="flex justify-center">
          <button
            type="submit"
            className="mt-5 rounded-[5px] border-0 bg-[#ffcb05] px-[3em] py-[0.7em] text-sm font-normal text-[#00502f] [text-shadow:0_-1px_0_rgba(0,0,0,0.25)]"
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  );
}
