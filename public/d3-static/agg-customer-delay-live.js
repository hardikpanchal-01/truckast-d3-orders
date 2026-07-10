/*
 * Live client for the D3 "AggCustomerDelay" shell (public/d3-static/agg-customer-delay.html).
 * Reads the order id from the URL (/orders/{id}/customer-delay), fetches /api/customer-delay
 * and renders the "<CUSTOMER> - DELAY MINUTES" title plus one red contractor tile per
 * delayed load (PLAN / <ticket>: N MIN DELAY / ACTUAL), each linking to that ticket's detail.
 */
(function () {
  var ASSET = "/d3-static/Order_files";

  // order id from /orders/{id}/customer-delay (fall back to ?id= / ?OrderID=)
  function orderId() {
    var m = location.pathname.match(/\/orders\/([^/]+)\/customer-delay/i);
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

  // one delayed-load tile, in D3's exact markup (red, contractor icon).
  function tile(l) {
    var plan = l.plan_min == null ? 0 : l.plan_min;
    var delay = l.delay_min == null ? 0 : l.delay_min;
    var actual = l.actual_min == null ? 0 : l.actual_min;
    var ticket = l.ticket_code || "—";
    var href = ID && l.ticket_id ? "/orders/" + encodeURIComponent(ID) + "/tickets/" + encodeURIComponent(l.ticket_id) : "";
    return (
      '<div class="tile" style="position: relative; background-color: rgb(196, 57, 38); cursor: pointer; display: block;"' +
      (href ? ' onclick="window.top.location.href=\'' + href + "'\"" : "") + ">" +
      '<img src="' + ASSET + '/dogear.png" style="position: absolute; right: 0px; bottom: 0px; display: block;">' +
      '<div class="tileContainer">' +
      '<div class="tileIcon"><img src="' + ASSET + '/contractor.png"></div>' +
      '<div class="tileInfoSection"><div class="tileCell">' +
      '<div class="tileSuperTitle">PLAN: ' + esc(plan) + " MINUTE(S)</div>" +
      '<div class="tileTitle">' + esc(ticket) + ": " + esc(delay) + " MIN DELAY</div>" +
      '<div class="tileSubTitle">ACTUAL: ' + esc(actual) + " MINUTE(S)</div>" +
      "</div></div></div></div>"
    );
  }

  function render(d) {
    var cust = (d.customer_name || "CUSTOMER").toUpperCase();
    setHtml("d3-cd-title", esc(cust) + " - DELAY MINUTES");
    setHtml(
      "d3-cd-subtitle",
      esc(d.order_line || "") + (d.address_line ? "<br>" + esc(d.address_line) : ""),
    );
    document.title = cust + " - DELAY MINUTES";
    var loads = d.loads || [];
    setHtml("d3-cd-tiles", loads.length ? loads.map(tile).join("") : "");
  }

  // D3's tile search: hide tiles whose text doesn't contain the query.
  function wireSearch() {
    var box = document.getElementById("d3-cd-search");
    var host = document.getElementById("d3-cd-tiles");
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
    fetch("/api/customer-delay?id=" + encodeURIComponent(ID), { cache: "no-store" })
      .then(function (x) { return x.ok ? x.json() : null; })
      .then(function (d) { if (d && !d.error) { render(d); wireSearch(); } })
      .catch(function () {});
  }

  if (document.readyState !== "loading") load();
  else document.addEventListener("DOMContentLoaded", load);
})();
