import { SubHeader } from "@/components/d3-ui";

export const dynamic = "force-dynamic";

const TIERS = [
  "$4.00 - $4.25 = $25.00/Load.",
  "$4.26 - $4.50 = $30.00/Load.",
  "$4.51 - $4.75 = $35.00/Load.",
  "$4.76 - $5.00 = $40.00/Load.",
  "$5.01 - $5.25 = $45.00/Load.",
  "$5.26 - $5.50 = $50.00/Load.",
  "$5.51 - $5.75 = $55.00/Load.",
  "$5.76 - $6.00 = $60.00/Load.",
];

export default function FuelSurchargesPage() {
  return (
    <div className="space-y-5">
      <SubHeader title="FUEL SURCHARGES" backHref="/" />

      <div className="space-y-4 text-[15px] leading-relaxed text-[#2f6f4f]">
        <p>
          Notice: Effective 4/20/2026 Dolese Bros. Co. will reimplement a fuel surcharge, based on published Diesel
          pricing as follows: {TIERS[0]}
        </p>
        <div>
          {TIERS.slice(1).map((t) => (
            <p key={t}>{t}</p>
          ))}
        </div>
        <p>
          This surcharge amount will be updated each Monday based on average price of Diesel fuel in Oklahoma as
          published by AAA at
        </p>
        <p>
          <a
            href="https://gasprices.aaa.com/?state=OK"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#2f7ed8] hover:underline"
          >
            https://gasprices.aaa.com/?state=OK
          </a>
        </p>
      </div>
    </div>
  );
}
