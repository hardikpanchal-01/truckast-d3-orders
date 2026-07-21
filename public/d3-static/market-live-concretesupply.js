/*
 * Live client for Concrete Supply Market Summary (D3 exact match).
 * Renders:
 * - Fuel Surcharges announcement tile (brown, with Concrete Supply logo)
 * - CONCRETE SUPPLY business-unit summary tile (green, with pie chart)
 */
(function () {
  var q = new URLSearchParams(location.search);
  var D = q.get("date");
  var ASSET = "/d3-static/MarketSummary_files";
  var GREEN = "#458b00"; // D3's exact green for Concrete Supply
  var BROWN = ""; // D3 uses no background color (defaults to brownish from the logo)
  var PIE_USED = "#7cb5ec";
  var PIE_REMAIN = "#434348";

  function iso(dt) {
    return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
  }
  if (!D) D = iso(new Date());
  var DT = q.get("dateTo");
  var BASE = location.pathname;

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function comma(n) {
    return (Math.round(Number(n || 0) * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ---- Date dropdown ----
  var MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  function mdy(dt) {
    return String(dt.getMonth() + 1).padStart(2, "0") + "/" + String(dt.getDate()).padStart(2, "0") + "/" + dt.getFullYear();
  }
  function dateOptions() {
    var t = new Date(iso(new Date()) + "T00:00:00");
    function add(n) { var d = new Date(t); d.setDate(d.getDate() + n); return d; }
    var eom = new Date(t.getFullYear(), t.getMonth() + 1, 0);
    var o = [];
    o.push(["TODAY - " + mdy(t), iso(t)]);
    o.push(["TOMORROW - " + mdy(add(1)), iso(add(1))]);
    o.push(["YESTERDAY", iso(add(-1))]);
    o.push([mdy(add(2)), iso(add(2))]);
    o.push([mdy(add(3)), iso(add(3))]);
    o.push([mdy(add(4)), iso(add(4))]);
    o.push([mdy(add(5)), iso(add(5))]);
    o.push([mdy(add(6)), iso(add(6))]);
    o.push([mdy(add(1)) + " - " + mdy(eom), iso(add(1)) + "|" + iso(eom)]);
    o.push(["LAST 7 DAYS", iso(add(-6)) + "|" + iso(t)]);
    o.push(["LAST 30 DAYS", iso(add(-29)) + "|" + iso(t)]);
    for (var m = 1; m <= 3; m++) {
      var first = new Date(t.getFullYear(), t.getMonth() + m, 1);
      var last = new Date(t.getFullYear(), t.getMonth() + m + 1, 0);
      o.push([MONTHS[first.getMonth()] + " " + first.getFullYear(), iso(first) + "|" + iso(last)]);
    }
    o.push(["FUTURE", iso(add(1)) + "|2099-12-31"]);
    o.push(["SEARCH", "SEARCH"]);
    return o;
  }
  function wireDates() {
    var sel = document.getElementById("daterangeurl");
    if (!sel) return;
    var list = dateOptions();
    var html = "";
    for (var i = 0; i < list.length; i++) html += '<option value="' + list[i][1] + '">' + esc(list[i][0]) + "</option>";
    sel.innerHTML = html;
    var cur = DT ? D + "|" + DT : D;
    sel.value = cur;
    if (sel.selectedIndex < 0) sel.value = D;
    sel.onchange = function () {
      var v = this.value;
      if (v === "SEARCH") { this.value = cur; return; }
      var parts = v.split("|");
      var url = BASE + "?date=" + encodeURIComponent(parts[0]);
      if (parts[1]) url += "&dateTo=" + encodeURIComponent(parts[1]);
      window.top.location.href = url;
    };
  }

  // ---- Fuel Surcharges tile (static for Concrete Supply - D3 exact match) ----
  function fuelSurchargeTile() {
    // Calculate effective date (most recent Monday)
    var today = new Date();
    var dayOfWeek = today.getDay();
    var daysToMonday = (dayOfWeek === 0) ? 6 : dayOfWeek - 1;
    var monday = new Date(today);
    monday.setDate(today.getDate() - daysToMonday);
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var effectiveDate = "Effective " + months[monday.getMonth()] + " " + monday.getDate() + ", " + monday.getFullYear();

    return (
      '<div class="tile" style="position: relative; background-color: ; cursor: pointer; display: block;" ' +
      "onclick=\"window.top.location.href='/fuel-surcharges'\">" +
      '<img src="' + ASSET + '/dogear.png" style="position: absolute; right: 0px; bottom: 0px; display: block;">' +
      '<div class="tileContainer">' +
      '<div class="tileIcon"><img src="/Images/concretesupplyco-tile-nb.png"></div>' +
      '<div class="tileInfoSection"><div class="tileCell">' +
      '<div class="tileSuperTitle">' + effectiveDate + '</div>' +
      '<div class="tileTitle">Fuel Surcharges</div>' +
      '<div class="tileSubTitle">$52.00 per load</div>' +
      "</div></div></div></div>"
    );
  }

  // ---- CONCRETE SUPPLY summary tile (pie + used-of-total + counts) ----
  function summaryTile(s) {
    var used = Number(s.usedCY || 0);
    var total = Number(s.totalCY || 0);
    var usedPct = total > 0 ? Math.max(0, Math.min(100, Math.round((used / total) * 100))) : 0;
    return (
      '<div class="tile" style="position: relative; background-color: ' + GREEN + '; cursor: pointer; display: block;" ' +
      "onclick=\"window.top.location.href='/orders?date=" + encodeURIComponent(D) + "'\">" +
      '<img src="' + ASSET + '/dogear.png" style="position: absolute; right: 0px; bottom: 0px; display: block;">' +
      '<div class="tileContainer">' +
      '<div class="mkt-pie" data-pct="' + usedPct + '" style="width:72px; height:80px; margin-right:5px; float:left"></div>' +
      '<div class="tileInfoSection"><div class="tileCell">' +
      '<div class="tileSuperTitle">CONCRETE SUPPLY</div>' +
      '<div class="tileTitle">' + comma(used) + " OF " + comma(total) + " CY</div>" +
      '<div class="tileSubTitle">Tot ' + (s.totalOrders || 0) + ", Act " + (s.activeOrders || 0) + ", Can " + (s.cancelledOrders || 0) + "</div>" +
      "</div></div></div></div>"
    );
  }

  // ---- Highcharts pie (D3's tileInitPie config) ----
  function renderPies() {
    if (!window.Highcharts || !window.Highcharts.Chart) return;
    var mounts = document.querySelectorAll(".mkt-pie");
    for (var i = 0; i < mounts.length; i++) {
      var el = mounts[i];
      if (el.getAttribute("data-rendered")) continue;
      el.setAttribute("data-rendered", "1");
      var pct = parseFloat(el.getAttribute("data-pct")) || 0;
      if (pct < 0) pct = 0;
      if (pct > 100) pct = 100;
      var used = pct;
      var remain = 100 - pct;
      try {
        new Highcharts.Chart({
          chart: {
            renderTo: el,
            type: "pie",
            width: 72,
            height: 80,
            backgroundColor: "rgba(255, 255, 255, 0.01)",
            plotBackgroundColor: null,
            plotBorderWidth: null,
            plotShadow: false,
          },
          title: { text: "" },
          tooltip: { enabled: false },
          exporting: { enabled: false },
          legend: { enabled: false },
          credits: { enabled: false },
          colors: [PIE_USED, PIE_REMAIN],
          plotOptions: {
            pie: { allowPointSelect: false, size: 60, dataLabels: { enabled: false }, showInLegend: false },
          },
          series: [{ type: "pie", data: [["Used", used], ["Remaining", remain]] }],
        });
      } catch (e) {
        el.removeAttribute("data-rendered");
      }
    }
  }

  var lastHtml = null;
  function load() {
    var t = document.getElementById("tiles-tiles");
    if (!t) return;
    var qs = "date=" + encodeURIComponent(D) + (DT ? "&dateTo=" + encodeURIComponent(DT) : "");

    $.ajax({
      url: "/api/market-summary?" + qs,
      type: 'GET',
      success: function(s) {
        if (!s || s.error) return;
        // Concrete Supply layout: Fuel Surcharges tile + Summary tile (side by side)
        var html = fuelSurchargeTile() + summaryTile(s);
        if (html === lastHtml) return;
        lastHtml = html;
        t.innerHTML = html;
        renderPies();
      }
    });
  }
  function refresh() { lastHtml = null; load(); }
  window.d3Refresh = refresh;

  function init() {
    wireDates();
    load();
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
  setInterval(load, 30000);
})();
