/*
 * Live client for the D3 "Order Request Dashboard" shell
 * (public/d3-static/order-request.html). Fetches /api/order-requests and renders
 * one D3 request tile per order — coloured by status (Restarted = blue,
 * Scheduled = green, Cancelled = red), matching DoleseOrderRequestDashboardV2.
 * Works whether opened at /order-request or /d3-static/order-request.html.
 */
(function () {
  var ASSET = "/d3-static/JobsForFixedNodeID_files";
  // D3's exact request-status → tile colour + glyph mapping.
  var BLUE = "rgb(47, 126, 216)";
  var GREEN = "rgb(69, 139, 0)";
  var RED = "rgb(196, 57, 38)";
  var STYLE = {
    active: { bg: BLUE, icon: "Restarted.png" },
    scheduled: { bg: GREEN, icon: "Scheduled.png" },
    cancelled: { bg: RED, icon: "Cancelled.png" },
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function num(n) { return (Math.round(Number(n || 0) * 100) / 100).toFixed(2); }

  // One D3 request tile: status glyph, R#/start/CY, project name, customer.
  function requestTile(o) {
    var st = STYLE[o.status] || STYLE.scheduled;
    var superTitle = esc(o.order_code) +
      (o.start_time ? ": " + esc(o.start_time) : ":") + " - " + num(o.ordered_cy) + " CY";
    // Every tile opens the Order Request Details page, keyed by its OrderRequestID (a GUID
    // in the D3 snapshot, or our own numeric id) at /order-request/{id}.
    var rid = String(o.order_id || "");
    var clickable = rid !== "";
    var cursor = clickable ? "pointer" : "default";
    var onclick = clickable ? " onclick=\"window.top.location.href='/order-request/" + encodeURIComponent(rid) + "'\"" : "";
    // data-region drives the region dropdown filter (best-effort; "" = unassigned).
    var region = ' data-region="' + esc(o.region || "") + '"';
    return (
      '<div class="tile"' + region + ' style="position: relative; background-color: ' + st.bg + '; cursor: ' + cursor + '; display: block;"' + onclick + ">" +
      '<img src="' + ASSET + '/dogear.png" style="position: absolute; right: 0px; bottom: 0px;">' +
      '<div class="tileContainer"><div class="tileIcon"><img src="' + ASSET + "/" + st.icon + '"></div>' +
      '<div class="tileInfoSection"><div class="tileCell">' +
      '<div class="tileSuperTitle">' + superTitle + "</div>" +
      '<div class="tileTitle">' + esc(String(o.address || "").toUpperCase()) + "</div>" +
      '<div class="tileSubTitle">' + esc(String(o.customer_name || "").toUpperCase()) + "</div>" +
      "</div></div></div></div>"
    );
  }

  // ---- Combined filter: search text + region dropdown ----
  // Region is a best-effort tag on each tile (the D3 snapshot omits region), so a
  // specific region shows only the tiles we could place; "ALL REGIONS" shows every one.
  var curSearch = "";
  var curRegion = "all";
  function applyFilters() {
    var box = document.getElementById("or-tiles");
    if (!box) return;
    var tiles = box.querySelectorAll(".tile");
    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      var txt = (t.textContent || "").toUpperCase();
      var region = t.getAttribute("data-region") || "";
      var okSearch = !curSearch || txt.indexOf(curSearch) >= 0;
      var okRegion = curRegion === "all" || region === curRegion;
      t.style.display = okSearch && okRegion ? "block" : "none";
    }
  }
  function wireSearch() {
    var input = document.getElementById("or-search");
    if (!input) return;
    input.oninput = function () { curSearch = (this.value || "").toUpperCase(); applyFilters(); };
  }
  function wireRegion() {
    var sel = document.getElementById("ddlorderrequestregion");
    if (!sel) return;
    sel.onchange = function () { curRegion = this.value || "all"; applyFilters(); };
  }

  // D3 groups the board by status — Restarted first, then Scheduled, then Cancelled.
  var ORDER = { active: 0, scheduled: 1, cancelled: 2 };
  var lastHtml = null;
  function render(list) {
    var box = document.getElementById("or-tiles");
    if (!box) return;
    var rows = (list || []).slice().sort(function (a, b) {
      return (ORDER[a.status] || 0) - (ORDER[b.status] || 0);
    });
    var html = rows.map(requestTile).join("");
    if (html === lastHtml) return; // avoid needless repaint on the 30s tick
    lastHtml = html;
    box.innerHTML = html;
    applyFilters(); // re-apply active search + region filter after refresh
  }

  function fetchRequests() {
    fetch("/api/order-requests", { cache: "no-store" })
      .then(function (x) { return x.ok ? x.json() : null; })
      .then(function (d) { if (d && !d.error) render(d.orders || d); })
      .catch(function () {});
  }
  window.d3Refresh = fetchRequests;

  function init() { wireSearch(); wireRegion(); fetchRequests(); }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
  setInterval(fetchRequests, 30000);
})();
