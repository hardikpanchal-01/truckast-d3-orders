/*
 * Live client for the D3 "Mobile Tickets — view by order" page (Hercules only).
 *
 * Producer options come from /api/market-summary/markets (same list as the JOBS plant
 * dropdown, company roll-up first). Tiles come from /api/mobile-tickets, which returns
 * the not-yet-started orders for the selected date.
 */
(function () {
  var q = new URLSearchParams(location.search);
  var ASSET = "/d3-static/JobsForFixedNodeID_files";
  // Pure green, pixel-sampled from the live Mobile Ticket board. NOT D3's olive
  // rgb(69,139,0) used by the market/order tiles — this page uses a different green.
  var GREEN = "rgb(0, 128, 0)";

  function iso(dt) {
    return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
  }
  // D3 opens this page on YESTERDAY (the day whose tickets are being reviewed).
  var D = q.get("date");
  if (!D) {
    var y = new Date();
    y.setDate(y.getDate() - 1);
    D = iso(y);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function comma(n) {
    return (Math.round(Number(n || 0) * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  // D3 prints the date on this page as M/D/YYYY ("7/21/2026").
  function mdy(s) {
    var p = String(s).split("-");
    return Number(p[1]) + "/" + Number(p[2]) + "/" + p[0];
  }

  function fillProducers() {
    var sel = document.getElementById("mt-producer");
    if (!sel) return;
    fetch("/api/market-summary/markets?date=" + encodeURIComponent(D), { cache: "no-store" })
      .then(function (x) { return x.ok ? x.json() : null; })
      .then(function (j) {
        if (!j || !j.markets || !j.markets.length) return;
        sel.innerHTML = j.markets
          .map(function (m) {
            return '<option value="' + esc(m.key || "") + '">' + esc(m.name) + "</option>";
          })
          .join("");
      })
      .catch(function () {});
  }

  // One order tile — D3's markup, calendar icon, green background.
  function tile(o) {
    return (
      '<div class="tile" style="position: relative; background-color: ' + GREEN + '; cursor: pointer; display: block;" ' +
      "onclick=\"window.top.location.href='/orders/" + esc(o.order_id) + "'\">" +
      '<img src="' + ASSET + '/dogear.png" style="position: absolute; right: 0px; bottom: 0px;">' +
      '<div class="tileContainer"><div class="tileIcon"><img src="' + ASSET + '/Scheduled.png"></div>' +
      '<div class="tileInfoSection"><div class="tileCell">' +
      '<div class="tileSuperTitle">' + esc(o.order_code) + " - " + esc(o.md) + " - " + comma(o.ordered_cy) + " CY(Pre-Pour)</div>" +
      (o.address ? '<div class="tileTitle">' + esc(o.address) + "</div>" : "") +
      '<div class="tileSubTitle">' + esc(o.customer_name || "") + "</div>" +
      '<div class="tileSubTitle">Order has not started</div>' +
      "</div></div></div></div>"
    );
  }

  var all = [];
  function paint() {
    var t = document.getElementById("mt-tiles");
    if (!t) return;
    var term = (document.getElementById("mt-search") || {}).value || "";
    term = term.trim().toUpperCase();
    var rows = !term
      ? all
      : all.filter(function (o) {
          return (
            String(o.order_code).toUpperCase().indexOf(term) >= 0 ||
            String(o.customer_name || "").toUpperCase().indexOf(term) >= 0 ||
            String(o.address || "").toUpperCase().indexOf(term) >= 0
          );
        });
    t.innerHTML = rows.map(tile).join("");
  }

  function load() {
    var d = document.getElementById("mt-date");
    if (d) d.value = mdy(D);
    fetch("/api/mobile-tickets?date=" + encodeURIComponent(D), { cache: "no-store" })
      .then(function (x) { return x.ok ? x.json() : null; })
      .then(function (j) {
        all = (j && j.orders) || [];
        paint();
      })
      .catch(function () {});
  }
  window.d3Refresh = load;

  // Kendo DatePicker — the widget the live board uses (bundled in d3_complete_nohc.js).
  // It supplies the button and the calendar popup, anchored under the field's left edge.
  // Picking a date reloads the page for it so Submit and the tiles stay in sync.
  // Falls back to a plain text field if Kendo isn't present, rather than breaking the page.
  function wireDatePicker() {
    var el = document.getElementById("mt-date");
    if (!el || !window.jQuery || !window.jQuery.fn || !window.jQuery.fn.kendoDatePicker) return;
    var parts = D.split("-");
    window
      .jQuery(el)
      .kendoDatePicker({
        format: "M/d/yyyy",
        value: new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])),
        change: function () {
          var v = this.value();
          if (!v) return;
          var iso =
            v.getFullYear() + "-" + String(v.getMonth() + 1).padStart(2, "0") + "-" + String(v.getDate()).padStart(2, "0");
          location.href = location.pathname + "?date=" + encodeURIComponent(iso);
        },
      });
  }

  function init() {
    fillProducers();
    wireDatePicker();
    load();
    var s = document.getElementById("mt-search");
    if (s) s.oninput = paint;
    var b = document.getElementById("mt-submit");
    if (b) b.onclick = load;
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
