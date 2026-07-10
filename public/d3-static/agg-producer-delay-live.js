/*
 * Live client for the D3 "AggProducerDelay" shell (public/d3-static/agg-producer-delay.html).
 * Reads the order id from the URL (/orders/{id}/producer-delay), fetches /api/producer-delay
 * and renders the "DOLESE - DELAY MINUTES" title plus one red truck tile per late load
 * (TRUCK <n> DUE : <t> / <ticket>: N MIN DELAY / ARRIVED: <t>), each linking to that ticket.
 */
(function () {
  var ASSET = "/d3-static/Order_files";

  function orderId() {
    var m = location.pathname.match(/\/orders\/([^/]+)\/producer-delay/i);
    if (m) return decodeURIComponent(m[1]);
    var q = new URLSearchParams(location.search);
    return q.get("id") || q.get("OrderID") || "";
  }
  var ID = orderId();

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function setHtml(id, html) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }
  // "HH:MM[:SS]" (CST clock) → 12-hour "h:mmAM" like D3 (e.g. 04:41:44 → 4:41AM).
  function clock(t) {
    if (!t) return "";
    var m = String(t).match(/^(\d{1,2}):(\d{2})/);
    if (!m) return String(t);
    var h = parseInt(m[1], 10);
    var ap = h >= 12 ? "PM" : "AM";
    var h12 = h % 12 || 12;
    return h12 + ":" + m[2] + ap;
  }

  // one late-load tile, in D3's markup (red, truck icon).
  function tile(l) {
    var delay = l.delay_min == null ? 0 : l.delay_min;
    var ticket = l.ticket_code || "—";
    var truck = l.truck_code || "—";
    var href = ID && l.ticket_id ? "/orders/" + encodeURIComponent(ID) + "/tickets/" + encodeURIComponent(l.ticket_id) : "";
    return (
      '<div class="tile" style="position: relative; background-color: rgb(196, 57, 38); cursor: pointer; display: block;"' +
      (href ? ' onclick="window.top.location.href=\'' + href + "'\"" : "") + ">" +
      '<img src="' + ASSET + '/dogear.png" style="position: absolute; right: 0px; bottom: 0px; display: block;">' +
      '<div class="tileContainer">' +
      '<div class="tileIcon"><img src="' + ASSET + '/truck.png"></div>' +
      '<div class="tileInfoSection"><div class="tileCell">' +
      '<div class="tileSuperTitle">TRUCK ' + esc(truck) + " DUE : " + esc(clock(l.due)) + "</div>" +
      '<div class="tileTitle">' + esc(ticket) + ": " + esc(delay) + " MIN DELAY</div>" +
      '<div class="tileSubTitle">ARRIVED: ' + esc(clock(l.arrived)) + "</div>" +
      "</div></div></div></div>"
    );
  }

  function render(d) {
    setHtml("d3-pd-title", "DOLESE - DELAY MINUTES");
    setHtml(
      "d3-pd-subtitle",
      esc(d.order_line || "") + (d.address_line ? "<br>" + esc(d.address_line) : ""),
    );
    document.title = "DOLESE - DELAY MINUTES";
    var loads = d.loads || [];
    setHtml("d3-pd-tiles", loads.length ? loads.map(tile).join("") : "");
  }

  function wireSearch() {
    var box = document.getElementById("d3-pd-search");
    var host = document.getElementById("d3-pd-tiles");
    if (!box || !host) return;
    function apply() {
      var f = (box.value || "").toUpperCase();
      var tiles = host.querySelectorAll(".tile");
      for (var i = 0; i < tiles.length; i++) {
        var txt = (tiles[i].textContent || "").toUpperCase();
        tiles[i].style.display = !f || txt.indexOf(f) >= 0 ? "block" : "none";
      }
    }
    box.addEventListener("keyup", apply);
    box.addEventListener("change", apply);
  }

  function load() {
    if (!ID) return;
    fetch("/api/producer-delay?id=" + encodeURIComponent(ID), { cache: "no-store" })
      .then(function (x) { return x.ok ? x.json() : null; })
      .then(function (d) { if (d && !d.error) { render(d); wireSearch(); } })
      .catch(function () {});
  }

  if (document.readyState !== "loading") load();
  else document.addEventListener("DOMContentLoaded", load);
})();
