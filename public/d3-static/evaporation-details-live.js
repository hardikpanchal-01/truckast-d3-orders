/*
 * Live client for the D3 "evaporationdetails" shell (evaporation-details.html).
 * Reads the order id from /orders/{id}/evaporation, fetches /api/order-detail and fills
 * the Status / Evaporation Rate / Concrete Temp / Order / Ticket rows. The green
 * Evaporation tile on the order page links here.
 */
(function () {
  var parts = location.pathname.split("/").filter(Boolean); // ["orders","{id}","evaporation"]
  var oi = parts.indexOf("orders");
  var ID = oi >= 0 && parts[oi + 1] ? parts[oi + 1] : "";

  function set(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
  // "2026-07-08…" -> "07/08/26"
  function mdy(s) {
    if (!s) return "";
    var p = String(s).slice(0, 10).split("-");
    return p.length === 3 ? p[1] + "/" + p[2] + "/" + p[0].slice(2) : "";
  }

  function render(d) {
    set("d3-ev-title", "Evaporation Details - " + mdy(d.order_date));
    var e = d.evaporation || {};
    var risk = e.risk || "";
    // D3 shows "Shrinkage Cracking: Normal Conditions".
    set("d3-ev-status", "Shrinkage Cracking: " + risk + (risk ? " Conditions" : ""));
    set("d3-ev-rate", (e.rate != null ? e.rate : "") + " lb/ft^2/hr");
    set("d3-ev-temp", (e.concreteTempF != null ? e.concreteTempF : "") + "F");
    set("d3-ev-order", d.order_code || "");
    set("d3-ev-ticket", e.ticketNo || "");
  }

  function fetchDetail() {
    if (!ID) return;
    fetch("/api/order-detail?id=" + encodeURIComponent(ID), { cache: "no-store" })
      .then(function (x) { return x.ok ? x.json() : null; })
      .then(function (d) { if (d && !d.error) render(d); })
      .catch(function () {});
  }

  if (document.readyState !== "loading") fetchDetail();
  else document.addEventListener("DOMContentLoaded", fetchDetail);
  setInterval(fetchDetail, 60000);
})();
