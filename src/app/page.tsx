import { getDoleseSummary } from "@/actions/orderActions";
import Link from "next/link";
import "./market-summary/market-summary.css";
import { MarketTile } from "./market-summary/MarketTile";

export const dynamic = "force-dynamic";

// Main page - exact D3 structure from MarketSummary.htm
export default async function MarketSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; dateTo?: string }>;
}) {
  const { date, dateTo } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const dateStr = date || today;
  const dateToStr = dateTo || undefined;

  const summary = await getDoleseSummary(dateStr, dateToStr);
  const tenantName = summary.name.split(" ")[0].charAt(0).toUpperCase() + summary.name.split(" ")[0].slice(1).toLowerCase();

  // Format date for display - D3 format: MM/DD/YYYY
  const formatDate = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;

  const todayDate = new Date();
  const todayDisplay = formatDate(todayDate);

  // Generate all date options like D3
  const tomorrow = new Date(todayDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDisplay = formatDate(tomorrow);

  // Days 3-7 (next 5 days after tomorrow)
  const day3 = new Date(todayDate);
  day3.setDate(day3.getDate() + 2);
  const day4 = new Date(todayDate);
  day4.setDate(day4.getDate() + 3);
  const day5 = new Date(todayDate);
  day5.setDate(day5.getDate() + 4);
  const day6 = new Date(todayDate);
  day6.setDate(day6.getDate() + 5);
  const day7 = new Date(todayDate);
  day7.setDate(day7.getDate() + 6);

  // End of current month
  const endOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0);
  const tomorrowToEndOfMonth = `${formatDate(tomorrow)} - ${formatDate(endOfMonth)}`;

  // Future months
  const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  const nextMonth1 = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 1);
  const nextMonth2 = new Date(todayDate.getFullYear(), todayDate.getMonth() + 2, 1);
  const nextMonth3 = new Date(todayDate.getFullYear(), todayDate.getMonth() + 3, 1);

  return (
    <div className="d3-page">
      {/* Sub Header navbar - exact D3 structure */}
      <div className="navbar">
        <div className="navbar-inner">
          <table style={{ width: "100%" }}>
            <tbody>
              <tr>
                <td style={{ width: 38 }}>
                  <Link href="/">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      id="titlebar-left-image"
                      width={32}
                      height={32}
                      style={{ marginTop: 5, marginBottom: 5 }}
                      src="/icons/arrow-big-01@2x.png"
                      alt=""
                    />
                  </Link>
                </td>
                <td>
                  <div style={{ width: "100%", float: "left", textAlign: "center", verticalAlign: "middle" }}>
                    <div id="titlebar-caption" style={{ display: "inline-block", margin: 5 }}>
                      <span style={{ fontSize: 16 }}><strong>{tenantName} Orders</strong></span>
                      <br />
                      <span style={{ fontSize: 11, padding: 0 }}><strong></strong></span>
                    </div>
                  </div>
                </td>
                <td style={{ width: 38 }}>
                  <Link href="/">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      id="titlebar-right-image"
                      width={32}
                      height={32}
                      style={{ marginTop: 5, marginBottom: 5 }}
                      src="/icons/arrow-small-27@2x.png"
                      alt=""
                    />
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div id="Header" className="d3-label" style={{ width: "100%" }}></div>
      <div className="d3-label" style={{ width: "100%" }}><h4></h4></div>

      {/* Date Range Select - exact D3 structure with all options */}
      <select
          id="daterangeurl"
          name="daterangeurl"
        style={{ width: "100%", marginBottom: 0, display: "block" }}
        defaultValue="today"
      >
        <option value="today">TODAY - {todayDisplay}</option>
        <option value="tomorrow">TOMORROW - {tomorrowDisplay}</option>
        <option value="yesterday">YESTERDAY</option>
        <option value="day3">{formatDate(day3)}</option>
        <option value="day4">{formatDate(day4)}</option>
        <option value="day5">{formatDate(day5)}</option>
        <option value="day6">{formatDate(day6)}</option>
        <option value="day7">{formatDate(day7)}</option>
        <option value="tomorrow-to-end-of-month">{tomorrowToEndOfMonth}</option>
        <option value="last7">LAST 7 DAYS</option>
        <option value="last30">LAST 30 DAYS</option>
        <option value="month1">{monthNames[nextMonth1.getMonth()]} {nextMonth1.getFullYear()}</option>
        <option value="month2">{monthNames[nextMonth2.getMonth()]} {nextMonth2.getFullYear()}</option>
        <option value="month3">{monthNames[nextMonth3.getMonth()]} {nextMonth3.getFullYear()}</option>
        <option value="future">FUTURE</option>
        <option value="search">SEARCH</option>
      </select>

      <br />

      {/* Invite Tiles Section - exact D3 structure */}
      <div id="invitetilevis" style={{ width: "100%", display: "block" }}>
        <input
          id="invitetilevis-search"
          type="text"
          placeholder="Search"
          style={{ width: 260, display: "none" }}
        />
        <div style={{ width: "100%", height: 1, clear: "both" }}></div>

        <div id="invitetilevis-tiles" style={{ display: "inline-block" }}>
          {/* Easy Customer Invite Tile */}
          <Link href="/rollout/search" style={{ textDecoration: "none" }}>
            <div
              className="tile"
              style={{ position: "relative", backgroundColor: "rgb(47, 126, 216)", cursor: "pointer", display: "block" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/dogear.png"
                style={{ position: "absolute", right: 0, bottom: 0, display: "block" }}
                alt=""
              />
              <div className="tileContainer">
                <div className="tileIcon">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/contractor.png" alt="" />
                </div>
                <div className="tileInfoSection">
                  <div className="tileCell">
                    <div className="tileSuperTitle">EASY</div>
                    <div className="tileTitle">CUSTOMER</div>
                    <div className="tileSubTitle">INVITE</div>
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* Order Concrete Tile */}
          <Link href="/order-request/project" style={{ textDecoration: "none" }}>
            <div
              className="tile"
              style={{ position: "relative", backgroundColor: "rgb(47, 126, 216)", cursor: "pointer", display: "block" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/dogear.png"
                style={{ position: "absolute", right: 0, bottom: 0, display: "block" }}
                alt=""
              />
              <div className="tileContainer">
                <div className="tileIcon">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/fill_form64.png" alt="" />
                </div>
                <div className="tileInfoSection">
                  <div className="tileCell">
                    <div className="tileSuperTitle">Click Here</div>
                    <div className="tileTitle">ORDER CONCRETE</div>
                    <div className="tileSubTitle">Its Easy</div>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Market Tiles Section - exact D3 structure */}
      <div id="tiles" style={{ width: "100%", display: "block" }}>
        <input
          id="tiles-search"
          type="text"
          placeholder="Search"
          style={{ width: 260, display: "block" }}
        />
        <div style={{ width: "100%", height: 1, clear: "both" }}></div>

        <div id="tiles-tiles" style={{ display: "inline-block" }}>
          {/* Fuel Surcharge Tile */}
          <Link href="/fuel-surcharges" style={{ textDecoration: "none" }}>
            <div
              className="tile"
              style={{ position: "relative", backgroundColor: "red", cursor: "pointer", display: "block" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/dogear.png"
                style={{ position: "absolute", right: 0, bottom: 0, display: "block" }}
                alt=""
              />
              <div className="tileContainer">
                <div className="tileIcon">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/dolesepublish.png" alt="" />
                </div>
                <div className="tileInfoSection">
                  <div className="tileCell">
                    <div className="tileSuperTitle">June 29th thru July 3rd, 2026</div>
                    <div className="tileTitle">Current Fuel Surcharge</div>
                    <div className="tileSubTitle">$25.00 per load *Click for Details</div>
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* Market Summary Tile with Animated Pie Chart */}
          <MarketTile
            href={`/orders?date=${dateStr}`}
            name={summary.name}
            usedCY={summary.usedCY}
            totalCY={summary.totalCY}
            totalOrders={summary.totalOrders}
            activeOrders={summary.activeOrders}
            cancelledOrders={summary.cancelledOrders}
          />
        </div>
      </div>
    </div>
  );
}
