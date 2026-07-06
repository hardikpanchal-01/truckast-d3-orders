/*
 * Live client for the D3 "Dolese Orders" shell (public/d3-static/orders.html).
 * Renders the order tiles from /api/orders-tiles and the plant total / date from
 * /api/orders-summary, and wires the date / plant / sort dropdowns — so the page
 * is fully dynamic whether opened at /orders or /d3-static/orders.html.
 */
(function () {
  var q = new URLSearchParams(location.search);
  var D = q.get("date");
  function iso(dt) {
    return (
      dt.getFullYear() +
      "-" +
      String(dt.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(dt.getDate()).padStart(2, "0")
    );
  }
  if (!D) D = iso(new Date());
  var BASE = location.pathname;

  // Download tile → same-origin CSV export for the selected date.
  window.d3Export = function () {
    window.top.location.href = "/api/orders/export?date=" + encodeURIComponent(D);
  };

  function ordersContainer() {
    var c = document.querySelectorAll('[id$="-tiles"]');
    return c[c.length - 1] || null;
  }

  // ---- Date dropdown: built dynamically (last ~30 days + near future, per D3),
  //      each option navigates to that date on OUR origin. No static D3 labels. ----
  var WD = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  function mdy(dt) {
    return (
      String(dt.getMonth() + 1).padStart(2, "0") +
      "/" +
      String(dt.getDate()).padStart(2, "0") +
      "/" +
      dt.getFullYear()
    );
  }
  function dateLabel(dt, todayISO) {
    var di = iso(dt);
    var diff = Math.round((new Date(di + "T00:00:00") - new Date(todayISO + "T00:00:00")) / 86400000);
    if (diff === 0) return "TODAY - " + mdy(dt);
    if (diff === 1) return "TOMORROW - " + mdy(dt);
    if (diff === -1) return "YESTERDAY - " + mdy(dt);
    return WD[dt.getDay()] + " - " + mdy(dt);
  }
  function wireDates() {
    var sel = document.getElementById("daterangeurl");
    if (!sel) return;
    var todayISO = iso(new Date());
    var offsets = [0];
    for (var f = 1; f <= 7; f++) offsets.push(f); // near future
    for (var p = 1; p <= 30; p++) offsets.push(-p); // last 30 days
    var html = "";
    var hasD = false;
    for (var i = 0; i < offsets.length; i++) {
      var dt = new Date(todayISO + "T00:00:00");
      dt.setDate(dt.getDate() + offsets[i]);
      var v = iso(dt);
      if (v === D) hasD = true;
      html += '<option value="' + v + '">' + dateLabel(dt, todayISO) + "</option>";
    }
    if (!hasD) {
      // selected date is outside the window — add it so it stays selectable
      var dd = new Date(D + "T00:00:00");
      html = '<option value="' + D + '">' + dateLabel(dd, todayISO) + "</option>" + html;
    }
    sel.innerHTML = html;
    sel.value = D;
    sel.onchange = function () {
      if (this.value) window.top.location.href = BASE + "?date=" + encodeURIComponent(this.value);
    };
  }

  // ---- Plant dropdown: only DOLESE (our tenant) has live local data ----
  function wirePlant() {
    var sel = document.getElementById("planturl");
    if (!sel) return;
    sel.onchange = function () {
      this.selectedIndex = 0;
    };
  }

  // ---- Sort dropdown: Default (server order) vs Volume (CY desc) ----
  function vol(el) {
    var m = (el.textContent || "").match(/([0-9,]+\.[0-9]{2})\s*CY/);
    return m ? parseFloat(m[1].replace(/,/g, "")) : 0;
  }
  function sortTiles(byVolume) {
    var t = ordersContainer();
    if (!t || !byVolume) return;
    var tiles = [].slice.call(t.querySelectorAll(".tile"));
    var fuel = tiles.shift(); // keep the fuel promo pinned first
    tiles.sort(function (a, b) {
      return vol(b) - vol(a);
    });
    t.innerHTML = "";
    if (fuel) t.appendChild(fuel);
    tiles.forEach(function (el) {
      t.appendChild(el);
    });
  }
  function wireSort() {
    var sel = document.getElementById("volsorturl");
    if (!sel) return;
    sel.onchange = function () {
      if (this.selectedIndex === 1) sortTiles(true);
      // Back to Default: force a repaint (bypass the unchanged-markup dedupe) so the
      // server's default order is restored even though the tile markup is identical.
      else {
        lastTilesHtml = null;
        refresh();
      }
    };
  }

  // ---- Live feeds ----
  // Remember the last tiles markup we painted. The in-process pie is an inline SVG
  // whose SMIL <animate> auto-replays every time the node is (re)inserted, so blindly
  // re-setting innerHTML on each 30s tick / refresh-button click made every pie
  // animate again ("2 faces"). Only swap the DOM when the markup actually changed —
  // an unchanged refresh now leaves the existing nodes (and their finished animation)
  // untouched. A genuine data change still re-renders and animates, as intended.
  var lastTilesHtml = null;
  function tiles() {
    var t = ordersContainer();
    if (!t) return;
    fetch("/api/orders-tiles?date=" + encodeURIComponent(D), { cache: "no-store" })
      .then(function (x) {
        return x.ok ? x.text() : null;
      })
      .then(function (hh) {
        if (!hh || hh === lastTilesHtml) return;
        lastTilesHtml = hh;
        t.innerHTML = hh;
        var s = document.getElementById("volsorturl");
        if (s && s.selectedIndex === 1) sortTiles(true);
        renderPies();
      })
      .catch(function () {});
  }

  // ---- In-process pies: rendered with Highcharts, using D3's OWN pie config verbatim
  //      (tileInitTPie in d3_complete_nohc.js) so colour, border, size and hover match
  //      exactly. Key details copied from D3:
  //        - colours assigned by the `colors` array (NOT per-point): data[0]=remaining →
  //          0.2 white (darker), data[1]=poured → 0.4 white (lighter). Remaining slice is
  //          drawn first — matches D3 exactly, so a mostly-poured order reads mostly-light.
  //        - no borderColor/borderWidth/shadow/hover overrides → Highcharts 4.1.9
  //          defaults (white 1px border + default hover halo, i.e. D3's "blur ring").
  //        - size 60, default centre → the (36, 37.5) seat seen in D3's export.
  //      Called after tiles are (re)painted; only new mounts are drawn once.
  function renderPies() {
    // Vendored Highcharts is v4.1.9 (same as D3). In 4.x there is no Highcharts.chart()
    // factory (that arrived in v5) — charts are created with `new Highcharts.Chart({
    // chart: { renderTo: el } })`. Using the v5 factory threw and left the pies blank.
    if (!window.Highcharts || !window.Highcharts.Chart) return;
    var mounts = document.querySelectorAll(".d3-pie");
    for (var i = 0; i < mounts.length; i++) {
      var el = mounts[i];
      if (el.getAttribute("data-rendered")) continue;
      el.setAttribute("data-rendered", "1");
      var pct = parseFloat(el.getAttribute("data-pct")) || 0;
      if (pct < 0) pct = 0;
      if (pct > 100) pct = 100;
      var poured = pct;
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
          // Fill colours (swapped per request): slice 0 = 0.2 (darker poured wedge),
          // slice 1 = 0.4 (lighter remaining).
          colors: [
            "rgba(255, 255, 255, 0.2)",
            "rgba(255, 255, 255, 0.4)",
            "rgba(255, 255, 255, 0.6)",
            "rgba(255, 255, 255, 0.8)",
          ],
          plotOptions: {
            pie: {
              allowPointSelect: false,
              size: 60,
              dataLabels: { enabled: false },
              showInLegend: false,
            },
          },
          // Data order reversed per request: poured slice drawn FIRST from 12 o'clock
          // (clockwise), so the poured wedge sits top-right and grows clockwise.
          series: [
            {
              type: "pie",
              data: [
                ["O", poured],
                ["T", remain],
              ],
            },
          ],
        });
      } catch (e) {
        // If a single chart fails, don't wedge the others — allow a later retry.
        el.removeAttribute("data-rendered");
      }
    }
  }
  function summary() {
    fetch("/api/orders-summary?date=" + encodeURIComponent(D), { cache: "no-store" })
      .then(function (x) {
        return x.ok ? x.json() : null;
      })
      .then(function (j) {
        if (!j) return;
        var pt = document.getElementById("d3PlantTotal");
        if (pt && j.totalLabel) pt.textContent = j.totalLabel;
        var dd = document.getElementById("d3DlDate");
        if (dd && j.dateLabel) dd.textContent = j.dateLabel;
      })
      .catch(function () {});
  }
  function refresh() {
    tiles();
    summary();
  }
  // Title-bar refresh button (top-right) re-pulls the live feeds for THIS page
  // instead of navigating to the external d3.truckast.com site. Unchanged data is a
  // no-op (see tiles()), so a click never needlessly replays the pie animation.
  window.d3Refresh = refresh;
  function init() {
    wireDates();
    wirePlant();
    wireSort();
    refresh();
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
  setInterval(refresh, 30000);
})();
