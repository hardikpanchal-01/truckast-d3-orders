"use client";

import * as React from "react";
import {
  Truck,
  Tag,
  Navigation,
  MapPin,
  CircleCheck,
  Droplets,
  Building2,
  ScanBarcode,
  type LucideIcon,
} from "lucide-react";

const BASE = "https://d3.truckast.com/IMAGES/ICONS/";

/** Live d3 icon filenames (provided by the client). These images bake in the label text. */
const ICON_FILE: Record<string, string> = {
  truck: "TRUCK.PNG",
  order: "ORDER_2.PNG",
  ticketed: "TICKET_2.PNG",
  loading: "TICKET_2.PNG",
  loaded: "LOADED_2.PNG",
  to_job: "TO_JOB_2.PNG",
  at_job: "AT_JOB_2.PNG",
  pouring: "POURING_2.PNG",
  poured: "END_POUR_2.PNG",
  washing: "WASHING_2.PNG",
  to_plant: "TO_PLANT_2.PNG",
  at_plant: "AT_PLANT_2.PNG",
  verifi: "VERIFI_LOGO.PNG",
};

/** Lucide fallbacks, used only if the d3 image fails to load. */
const FALLBACK: Record<string, LucideIcon> = {
  truck: Truck,
  order: ScanBarcode,
  ticketed: Tag,
  loading: Truck,
  loaded: CircleCheck,
  to_job: Navigation,
  at_job: MapPin,
  pouring: Truck,
  poured: CircleCheck,
  washing: Droplets,
  to_plant: Navigation,
  at_plant: Building2,
};

/**
 * Status / product glyph for the ticket-detail tiles. Renders the live d3 image
 * (which already includes its label text); on failure it falls back to a lucide
 * icon plus the `badge` label so the tile still reads correctly.
 */
export function TicketIcon({
  slug,
  badge,
  className = "h-[82px] w-[72px] object-contain",
}: {
  slug: string;
  badge?: string;
  className?: string;
}) {
  const [broken, setBroken] = React.useState(false);
  const file = ICON_FILE[slug];

  if (broken || !file) {
    const Icon = FALLBACK[slug];
    return (
      <div className="flex flex-col items-center justify-center">
        {Icon ? <Icon className="h-10 w-10" strokeWidth={1.6} /> : null}
        {badge ? <span className="mt-1 text-[9px] font-bold tracking-wide">{badge}</span> : null}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`${BASE}${file}`} alt={badge || slug} className={className} onError={() => setBroken(true)} />
  );
}
