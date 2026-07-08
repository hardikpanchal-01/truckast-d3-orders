/*
 * Live client for the D3 "Truck Arrival" shell (truck-arrival.html).
 * Reads the order id from /orders/{id}/truck-arrival, fetches /api/truck-arrival, and
 * renders one D3 tile per active truck (heading to / on the job). Each tile links to
 * that truck's ticket detail.
 */
(function () {
  var parts = location.pathname.split("/").filter(Boolean); // ["orders","{id}","truck-arrival"]
  var oi = parts.indexOf("orders");
  var ID = oi >= 0 && parts[oi + 1] ? parts[oi + 1] : "";
  var ASSET = "/d3-static/Order_files";
  var STATUS = { IN_PROCESS: "IN PROCESS", PRE_POUR: "PRE-POUR", COMPLETED: "COMPLETE", CANCELED: "CANCELLED" };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function mdShort(s) {
    if (!s) return "";
    var p = String(s).slice(0, 10).split("-");
    return p.length === 3 ? Number(p[1]) + "/" + Number(p[2]) : "";
  }
  function num(n) { return (Math.round(Number(n || 0) * 100) / 100).toFixed(2); }

  // One D3 truck-status tile: icon + "TICKET: CY" + "TRUCK n STAGE: time".
  function tile(t) {
    var href = "/orders/" + esc(ID) + "/tickets/" + esc(t.ticket_id);
    var sub = "TRUCK " + esc(t.truck_code || "") + " " + esc(t.stage_label) +
      (t.stage_time ? ": " + esc(t.stage_time) : "");
    return (
      '<div class="tile" style="position: relative; background-color: rgb(47, 126, 216); cursor: pointer; display: block;" ' +
      "onclick=\"window.top.location.href='" + href + "'\">" +
      '<img src="' + ASSET + '/dogear.png" style="position: absolute; right: 0px; bottom: 0px; display: block;">' +
      '<div class="tileContainer"><div class="tileIcon"><img src="' + ASSET + "/" + esc(t.icon) + ".png\" onerror=\"this.onerror=null;this.src='" + ASSET + "/order_2.png'\"></div>" +
      '<div class="tileInfoSection"><div class="tileCell">' +
      '<div class="tileSuperTitle"></div>' +
      '<div class="tileTitle">' + esc(t.ticket_code || "") + ": " + num(t.load_cy) + " CY</div>" +
      '<div class="tileSubTitle">' + sub + "</div>" +
      "</div></div></div></div>"
    );
  }

  // ---------- Search filter (D3's TruckArrival ":Contains" tile filter) ----------
  // Hides tiles whose text doesn't contain the search box value. Re-applied after
  // every refresh so filtered results survive the 60s tile reload, exactly like D3.
  var $ = window.jQuery;
  if ($ && $.expr && $.expr[":"] && !$.expr[":"].Contains) {
    $.expr[":"].Contains = function (a, i, m) {
      return (a.textContent || a.innerText || "").toUpperCase().indexOf(m[3].toUpperCase()) >= 0;
    };
  }
  function applyFilter() {
    if (!$) return;
    var filter = $("#d3-ta-search").val();
    var tiles = $("#d3-truck-tiles");
    if (filter) {
      tiles.children(".tile:not(:Contains(" + filter + "))").css("display", "none");
      tiles.children(".tile:Contains(" + filter + ")").css("display", "block");
    } else {
      tiles.children(".tile").css("display", "block");
    }
  }
  if ($) {
    $(function () {
      $("#d3-ta-search").on("change keyup", function () { applyFilter(); return false; });
    });
    // Restore the filter when returning via the Back button (D3 pageshow handler).
    window.addEventListener("pageshow", applyFilter, false);
  }

  function render(d) {
    var title = document.getElementById("d3-ta-title");
    if (title) title.textContent = "ORDER " + (d.order_code || "") + "-" + mdShort(d.order_date);
    var sub = document.getElementById("d3-ta-subtitle");
    if (sub) sub.textContent = String(d.subtitle || "").toUpperCase();
    var st = document.getElementById("d3-ta-status");
    if (st) {
      st.innerHTML = "<h4>" + esc((STATUS[d.status] || d.status || "") +
        (d.customer_name ? " - " + d.customer_name : "")) + "</h4>";
    }
    var host = document.getElementById("d3-truck-tiles");
    if (host) host.innerHTML = (d.trucks || []).map(tile).join("");
    applyFilter(); // keep any active search applied across refreshes
  }

  function fetchArrival() {
    if (!ID) return;
    fetch("/api/truck-arrival?id=" + encodeURIComponent(ID), { cache: "no-store" })
      .then(function (x) { return x.ok ? x.json() : null; })
      .then(function (d) { if (d && !d.error) render(d); })
      .catch(function () {});
  }

  if (document.readyState !== "loading") fetchArrival();
  else document.addEventListener("DOMContentLoaded", fetchArrival);
  setInterval(fetchArrival, 60000);
})();
