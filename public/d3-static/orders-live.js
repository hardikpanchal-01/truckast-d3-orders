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
  var DT = q.get("dateTo"); // range end (present for Last 7 / month / Future / etc.)
  var BASE = location.pathname;
  // Query string for the tile + summary feeds — carries the range end when present.
  function feedQS() { return "date=" + encodeURIComponent(D) + (DT ? "&dateTo=" + encodeURIComponent(DT) : ""); }
  // Friendly label for the download tile — the preset NAME D3 shows ("Yesterday"), the date,
  // or the range span. Mirrors the date dropdown's own relative-day logic (mdy/iso defined
  // below are hoisted). D3 shows "Yesterday", not "07/17/2026", on the ORDERS download tile.
  function friendlyDate() {
    if (DT) return mdy(new Date(D + "T00:00:00")) + " - " + mdy(new Date(DT + "T00:00:00"));
    var todayISO = iso(new Date());
    var n = Math.round((new Date(D + "T00:00:00") - new Date(todayISO + "T00:00:00")) / 86400000);
    if (n === 0) return "Today";
    if (n === -1) return "Yesterday";
    if (n === 1) return "Tomorrow";
    return mdy(new Date(D + "T00:00:00"));
  }

  // Download tile → same-origin CSV export for the selected date.
  window.d3Export = function () {
    window.top.location.href = "/api/orders/export?date=" + encodeURIComponent(D);
  };

  function ordersContainer() {
    var c = document.querySelectorAll('[id$="-tiles"]');
    return c[c.length - 1] || null;
  }

  // ---- Date dropdown: built dynamically to match D3's preset list, each option navigating
  //      on OUR origin. No static D3 labels. ----
  function mdy(dt) {
    return (
      String(dt.getMonth() + 1).padStart(2, "0") +
      "/" +
      String(dt.getDate()).padStart(2, "0") +
      "/" +
      dt.getFullYear()
    );
  }
  // Month-year label like D3 ("AUGUST 2026").
  function monthLabel(dt) {
    return dt.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase();
  }
  // D3's preset list: TODAY / TOMORROW / YESTERDAY, the next 5 individual days, the rest of
  // this month, LAST 7 / LAST 30 DAYS, the next 3 months, FUTURE and SEARCH. Range presets
  // carry a "start|end" value and navigate with ?date=&dateTo=; single presets use ?date=.
  function wireDates() {
    var sel = document.getElementById("daterangeurl");
    if (!sel) return;
    var today = new Date(iso(new Date()) + "T00:00:00");
    function shift(n) { var d = new Date(today); d.setDate(today.getDate() + n); return d; }
    var tmr = shift(1), yst = shift(-1);
    var eom = new Date(today.getFullYear(), today.getMonth() + 1, 0); // last day of this month
    var opts = [];
    opts.push({ v: iso(today), t: "TODAY - " + mdy(today) });
    opts.push({ v: iso(tmr), t: "TOMORROW - " + mdy(tmr) });
    opts.push({ v: iso(yst), t: "YESTERDAY" });
    for (var i = 2; i <= 6; i++) { var d = shift(i); opts.push({ v: iso(d), t: mdy(d) }); }
    opts.push({ v: iso(tmr) + "|" + iso(eom), t: mdy(tmr) + " - " + mdy(eom) }); // rest of this month
    opts.push({ v: iso(shift(-6)) + "|" + iso(today), t: "LAST 7 DAYS" });
    opts.push({ v: iso(shift(-29)) + "|" + iso(today), t: "LAST 30 DAYS" });
    for (var m = 1; m <= 3; m++) {
      var f0 = new Date(today.getFullYear(), today.getMonth() + m, 1);
      var l0 = new Date(today.getFullYear(), today.getMonth() + m + 1, 0);
      opts.push({ v: iso(f0) + "|" + iso(l0), t: monthLabel(f0) });
    }
    opts.push({ v: iso(tmr) + "|" + iso(shift(30)), t: "FUTURE" });
    opts.push({ v: "search", t: "SEARCH" });

    var curVal = DT ? D + "|" + DT : D;
    var html = "";
    if (!opts.some(function (o) { return o.v === curVal; })) {
      // The selected date/range isn't one of the presets — prepend it so it stays selectable.
      var lbl = DT
        ? mdy(new Date(D + "T00:00:00")) + " - " + mdy(new Date(DT + "T00:00:00"))
        : mdy(new Date(D + "T00:00:00"));
      html += '<option value="' + curVal + '">' + lbl + "</option>";
    }
    for (var k = 0; k < opts.length; k++) html += '<option value="' + opts[k].v + '">' + opts[k].t + "</option>";
    sel.innerHTML = html;
    sel.value = curVal;
    sel.onchange = function () {
      var val = this.value;
      if (!val) return;
      if (val === "search") {
        // Open the D3 OrderSearch form (start/end date + area), carrying the current date
        // as its start default. Its SEARCH button navigates back to /orders?date=&dateTo=.
        window.top.location.href = "/orders/search?date=" + encodeURIComponent(D);
        return;
      }
      if (val.indexOf("|") >= 0) {
        var pr = val.split("|");
        window.top.location.href = BASE + "?date=" + encodeURIComponent(pr[0]) + "&dateTo=" + encodeURIComponent(pr[1]);
      } else {
        window.top.location.href = BASE + "?date=" + encodeURIComponent(val);
      }
    };
  }

  // ---- Plant dropdown: one option per tenant (server-rendered, selected tenant
  // defaulted). Picking another tenant sets the selected_tenant cookie via the
  // same API the settings page uses, then reloads so the board re-renders from
  // that tenant's database. On failure the selection snaps back. ----
  function wirePlant() {
    var sel = document.getElementById("planturl");
    if (!sel) return;
    var initialIdx = sel.selectedIndex;
    sel.onchange = function () {
      var val = sel.value;
      if (!val || sel.selectedIndex === initialIdx) return;
      fetch("/api/settings/tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant: val }),
      })
        .then(function (x) {
          return x.ok ? x.json() : null;
        })
        .then(function (j) {
          if (j && j.success) window.top.location.reload();
          else sel.selectedIndex = initialIdx;
        })
        .catch(function () {
          sel.selectedIndex = initialIdx;
        });
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
    fetch("/api/orders-tiles?" + feedQS(), { cache: "no-store" })
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
    fetch("/api/orders-summary?" + feedQS(), { cache: "no-store" })
      .then(function (x) {
        return x.ok ? x.json() : null;
      })
      .then(function (j) {
        if (!j) return;
        var pt = document.getElementById("d3PlantTotal");
        if (pt && j.totalLabel) pt.textContent = j.totalLabel;
        // D3's download tile shows the preset name ("Yesterday" / "Today") or the date/range,
        // not the raw mdy — computed client-side so it tracks the browser's "today".
        var dd = document.getElementById("d3DlDate");
        if (dd) dd.textContent = friendlyDate();
      })
      .catch(function () {});
  }
  function refresh() {
    tiles();
    summary();
  }
  // Title-bar refresh button (top-right): do a genuine full page reload — the same
  // thing D3's own reload button does — so the whole list visibly refreshes. (The
  // earlier silent AJAX repaint looked like "nothing happened" when the data was
  // unchanged.) The 30s auto-tick below still uses the quiet refresh() so the pies
  // don't re-animate on their own every half-minute.
  window.d3Refresh = function () {
    window.location.reload();
  };
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
