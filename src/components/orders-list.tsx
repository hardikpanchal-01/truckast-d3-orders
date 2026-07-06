"use client";

import * as React from "react";
import Link from "next/link";
import type { DoleseOrderListItem, OrderStatus } from "@/actions/orderActions";
import styles from "./order-tiles.module.css";

const STATUS_LABEL: Record<OrderStatus, string> = {
  IN_PROCESS: "IN PROCESS",
  PRE_POUR: "PRE-POUR",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELLED",
};

/**
 * D3's exact tile background colours (from the exported JobsForFixedNodeID markup):
 *  green  rgb(69,139,0)   – firm pre-pour; on-plan in-process/complete
 *  yellow rgb(247,187,0)  – will-call pre-pour; behind-plan in-process/complete
 *  red    rgb(196,57,38)  – on-hold and cancelled orders
 */
const TILE_GREEN = "rgb(69, 139, 0)";
const TILE_YELLOW = "rgb(247, 187, 0)";
const TILE_RED = "rgb(196, 57, 38)";

function tileColor(o: DoleseOrderListItem): string {
  const ds = o.dispatch_status;
  if (o.status === "CANCELED" || ds === "Cancelled" || ds === "Hold") return TILE_RED;
  if (o.status === "PRE_POUR") {
    // Firmed (dispatch "Active") → green; otherwise Will-Call → yellow (matches D3).
    return ds === "Active" ? TILE_GREEN : TILE_YELLOW;
  }
  // IN_PROCESS / COMPLETE → poured speed vs planned speed.
  const pct = o.pour_pct;
  if (pct == null) return TILE_GREEN;
  if (pct >= 90) return TILE_GREEN;
  if (pct >= 60) return TILE_YELLOW;
  return TILE_RED;
}

/** D3 shows CY as 0.00 until an order reaches a full 1 CY (sub-1 values display as zero). */
function cyLabel(cy: number): string {
  return (cy < 1 ? 0 : cy).toFixed(2);
}

function md(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** start_time is a CST clock value stored in a UTC field → read UTC parts as HH:MM. */
function startLabel(t: string | null): string {
  if (!t) return "";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function OrdersList({ orders }: { orders: DoleseOrderListItem[] }) {
  const [filter, setFilter] = React.useState("");

  const q = filter.trim().toLowerCase();

  const visible = React.useMemo(() => {
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.order_code?.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.delivery_addr1?.toLowerCase().includes(q) ||
        o.project_name?.toLowerCase().includes(q),
    );
  }, [orders, q]);

  // D3 pins a red "Current Fuel Surcharge" promo as the first grid cell; it filters
  // out of the grid like any other tile when the search query excludes it.
  const showFuel = !q || "current fuel surcharge dolese".includes(q);

  return (
    <div>
      <div className={styles.searchWrap}>
        <input
          type="text"
          className={styles.search}
          placeholder="Search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {visible.length === 0 && !showFuel ? (
        <p className={styles.empty}>No orders for this day.</p>
      ) : (
        <div className={styles.tiles}>
          {showFuel && (
            <Link href="/fuel-surcharges" className={`${styles.tile} ${styles.fuelTile}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/dogear.png" alt="" aria-hidden className={styles.dogear} />
              <div className={styles.tileContainer}>
                <div className={`${styles.tileIcon} ${styles.fuelIcon}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="https://d3.truckast.com/Images/logos/dolesepublish.png" alt="" />
                </div>
                <div className={styles.tileInfoSection}>
                  <div className={styles.tileCell}>
                    {/* Hardcoded weekly promo — mirrors D3's current surcharge. */}
                    <div className={styles.fuelDate}>June 29th thru July 3rd, 2026</div>
                    <div className={styles.fuelTitle}>Current Fuel Surcharge</div>
                    <div className={styles.fuelSub}>$25.00 per load *Click for Details</div>
                  </div>
                </div>
              </div>
            </Link>
          )}
          {visible.map((o) => {
            const isCancelled = o.status === "CANCELED";
            // D3 SuperTitle: "48307-7/6: 0.00 CY (PRE-POUR)"
            const superTitle = `${o.order_code}-${md(o.order_date)}: ${cyLabel(o.ordered_cy)} CY (${STATUS_LABEL[o.status]})`;
            // D3 Title (bold): "02:00 201 DOLLAR TREE WAY" — time+address; cancelled tiles omit the time.
            const start = isCancelled ? "" : startLabel(o.start_time);
            const addr = o.delivery_addr1 || o.project_name || "";
            const title = `${start} ${addr}`.trim().toUpperCase();
            // D3 SubTitle: customer name.
            const subTitle = (o.customer_name || "").toUpperCase();

            return (
              <Link
                key={o.order_id}
                href={`/orders/${o.order_id}`}
                className={styles.tile}
                style={{ backgroundColor: tileColor(o) }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/dogear.png" alt="" aria-hidden className={styles.dogear} />
                <div className={styles.tileContainer}>
                  <div className={styles.tileIcon}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={isCancelled ? "/icons/cancelled.png" : "/icons/scheduled.png"} alt="" />
                  </div>
                  <div className={styles.tileInfoSection}>
                    <div className={styles.tileCell}>
                      <div className={styles.tileSuperTitle}>{superTitle}</div>
                      <div className={styles.tileTitle}>{title}</div>
                      <div className={styles.tileSubTitle}>{subTitle}</div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
