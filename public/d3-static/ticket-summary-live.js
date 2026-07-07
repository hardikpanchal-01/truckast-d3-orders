/*
 * Live client for the D3 "Ticket Summary" shell (public/d3-static/ticket-summary.html).
 * Reads the order id from the URL (/orders/{id}/tickets), fetches /api/ticket-summary,
 * and renders one load tile per delivered ticket — the D3 page, driven by our DB.
 */
(function () {
  var parts = location.pathname.split("/").filter(Boolean); // ["orders","{id}","tickets"]
  var oi = parts.indexOf("orders");
  var ID = oi >= 0 && parts[oi + 1] ? parts[oi + 1] : "";
  var ASSET = "/d3-static/TicketSummary_files";
  var BLUE = "rgb(47, 126, 216)";
  var STATUS = { IN_PROCESS: "IN PROCESS", PRE_POUR: "PRE-POUR", COMPLETED: "COMPLETE", CANCELED: "CANCELLED" };
  // Ticket-stage label → D3 status glyph (…_2.png). Missing early stages fall back to loading.
  var ICON = {
    "AT PLANT": "at_plant_2", "TO PLANT": "to_plant_2", "WASHING": "washing_2",
    "POURED": "end_pour_2", "POURING": "pouring_2", "ON JOB": "at_job_2",
    "TO JOB": "to_job_2", "LOADED": "loaded_2", "LOADING": "loading_2",
    "PRINTED": "loading_2", "ORDERED": "loading_2",
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function num(n) { return (Math.round(Number(n || 0) * 100) / 100).toFixed(2); }
  function mdShort(s) {
    if (!s) return "";
    var p = String(s).slice(0, 10).split("-");
    return p.length === 3 ? Number(p[1]) + "/" + Number(p[2]) : "";
  }
  function iconFor(status) { return ASSET + "/" + (ICON[status] || "loading_2") + ".png"; }
  function setText(id, s) { var el = document.getElementById(id); if (el) el.textContent = s; }

  // One D3 load tile (blue): LOAD #, truck + plant, ticket: CY, time + cumulative-of-total.
  function loadTile(l) {
    return (
      '<div class="tile" style="position: relative; background-color: ' + BLUE + '; cursor: pointer; display: block;" ' +
      "onclick=\"window.top.location.href='/orders/" + ID + "/tickets/" + esc(l.ticket_id) + "'\">" +
      '<img src="' + ASSET + '/dogear.png" style="position: absolute; right: 0px; bottom: 0px;">' +
      '<div class="tileContainer"><div class="tileIcon"><img src="' + iconFor(l.status) +
      '" onerror="this.onerror=null;this.src=\'' + ASSET + '/at_plant_2.png\'"></div>' +
      '<div class="tileInfoSection"><div class="tileCell">' +
      '<div class="tileSuperTitle">LOAD # ' + esc(l.load_no) + "</div>" +
      // Truck + plant on its own line, always suffixed with "..." (D3 shows the ellipsis
      // to hint there's more detail behind the tile).
      '<div class="tileSuperTitle" style="white-space:normal;word-wrap:break-word;overflow-wrap:break-word">TRUCK ' + esc(l.truck_code || "—") +
      (l.plant_name ? " - " + esc(String(l.plant_name).toUpperCase()) : "") + " ...</div>" +
      '<div class="tileTitle">' + esc(l.ticket_code || "—") + ": " + num(l.load_cy) + " CY</div>" +
      '<div class="tileSubTitle">' + (l.status_time ? esc(l.status_time) + " " : "") +
      num(l.cumulative_cy) + " OF " + num(l.total_cy) + " CY</div>" +
      "</div></div></div></div>"
    );
  }

  // ---- Tile search (filter by any visible text, like D3) ----
  function wireSearch() {
    var input = document.getElementById("ts-search");
    var box = document.getElementById("ts-tiles");
    if (!input || !box) return;
    input.oninput = function () {
      var f = (this.value || "").toUpperCase();
      var tiles = box.querySelectorAll(".tile");
      for (var i = 0; i < tiles.length; i++) {
        var txt = (tiles[i].textContent || "").toUpperCase();
        tiles[i].style.display = !f || txt.indexOf(f) >= 0 ? "block" : "none";
      }
    };
  }

  function render(d) {
    setText("d3-title", "ORDER " + d.order_code + "-" + mdShort(d.order_date));
    setText("d3-subtitle", String(d.subtitle || "").toUpperCase());
    setText("d3-status", (STATUS[d.status] || d.status) + " - " + (d.customer_name || "—"));
    var t = document.getElementById("ts-tiles");
    if (t) {
      t.innerHTML = (d.loads || []).map(loadTile).join("");
      var input = document.getElementById("ts-search");
      if (input && input.value) input.oninput(); // re-apply active filter after refresh
    }
  }

  function fetchSummary() {
    if (!ID) return;
    fetch("/api/ticket-summary?id=" + encodeURIComponent(ID), { cache: "no-store" })
      .then(function (x) { return x.ok ? x.json() : null; })
      .then(function (d) { if (d && !d.error) render(d); })
      .catch(function () {});
  }
  window.d3Refresh = fetchSummary;

  function init() { wireSearch(); fetchSummary(); }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
  setInterval(fetchSummary, 30000);
})();
