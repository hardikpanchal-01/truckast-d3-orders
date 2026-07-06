/*
 * Live client for the D3 "Order" detail shell (public/d3-static/order.html).
 * Reads the order id from the URL (/orders/{id}), fetches /api/order-detail, and
 * renders the header/detail tiles, status, weather, the two Highcharts (Pour Speed
 * + Trucks on the Job) and the activity/chat feed — the D3 page, driven by our DB.
 */
(function () {
  var parts = location.pathname.split("/").filter(Boolean); // ["orders","{id}", ...]
  var oi = parts.indexOf("orders");
  var ID = oi >= 0 && parts[oi + 1] ? parts[oi + 1] : "";
  var ASSET = "/d3-static/Order_files";
  var BLUE = "rgb(47, 126, 216)";
  var STATUS = { IN_PROCESS: "IN PROCESS", PRE_POUR: "PRE-POUR", COMPLETED: "COMPLETED", CANCELED: "CANCELLED" };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  // Concrete is half-yard increments → show CY to nearest 0.50 (kills float artifacts).
  function half(n) { return (Math.round(Number(n || 0) * 2) / 2).toFixed(2); }
  function mdShort(s) {
    if (!s) return "";
    var p = String(s).slice(0, 10).split("-");
    return p.length === 3 ? Number(p[1]) + "/" + Number(p[2]) : "";
  }
  // "9:28 AM" -> {v:"9:28",sub:"AM"}; "8 MIN" -> {v:"8",sub:"MIN"}; "Now" -> {v:"Now",sub:""}
  function splitTime(s) {
    if (!s) return { v: "—", sub: "" };
    var m = String(s).match(/^(.*?)\s*(AM|PM)$/i);
    if (m) return { v: m[1].trim(), sub: m[2].toUpperCase() };
    var mn = String(s).match(/^(\d+)\s*MIN$/i);
    if (mn) return { v: mn[1], sub: "MIN" };
    return { v: String(s), sub: "" };
  }

  function tile1x1(tagline, title, subtitle, onclick) {
    var click = onclick ? ' onclick="' + onclick + '"' : "";
    var cur = onclick ? "pointer" : "default";
    var dog = onclick ? '<img src="' + ASSET + '/dogear.png" style="position:absolute;right:0;bottom:0">' : "";
    return (
      '<div class="tile" style="position: relative; width: 88px; height: 90px; margin-right:5px; margin-bottom: 5px; background-color: ' +
      BLUE + "; float: left; color:white; cursor:" + cur + '; display:block"' + click + ">" + dog +
      '<div style="padding:5px">' +
      '<div style="text-align:center;font-size:12px;font-weight:bold">' + esc(tagline) + "</div>" +
      '<div style="width:100%;height:40px;line-height:40px;text-align:center;font-weight:bold;font-size:24px">' + esc(title) + "</div>" +
      '<div style="text-align:center;font-size:12px">' + esc(subtitle || "") + "</div>" +
      "</div></div>"
    );
  }

  function weatherTile(w) {
    if (!w) return "";
    var icon = w.icon ? ASSET + "/" + w.icon + ".png" : ASSET + "/04n.png";
    return (
      '<div class="tile" style="position: relative; background-color: ' + BLUE + '; cursor: default; display: block;">' +
      '<div class="tileContainer"><div class="tileIcon"><img src="' + icon + '" onerror="this.src=\'' + ASSET + '/04n.png\'"></div>' +
      '<div class="tileInfoSection"><div class="tileCell">' +
      '<div class="tileSuperTitle"><span style="font-size:11px;font-weight:bold">' + esc(w.place || "") + "</span></div>" +
      '<div class="tileTitle"><span style="font-size:14px;font-weight:bold">' + esc(((w.temp || "") + " " + (w.description || "")).trim()) + "</span></div>" +
      '<div class="tileSubTitle">H: ' + esc(w.humidity || "") + "   P: " + esc(w.pressure || "") + "   W: " + esc(w.wind || "") + " " + esc(w.direction || "") +
      (w.updated ? "<br>Last Update: " + esc(w.updated) : "") + "</div>" +
      "</div></div></div></div>"
    );
  }

  // ---- Highcharts (v4, vendored like D3): new Highcharts.Chart({chart:{renderTo}}) ----
  var chartsDone = false;
  // The chart x-values are minutes-of-day; anchor them to the order's actual date
  // so the datetime axis + tooltip read the REAL day (e.g. "Monday, Jul 6, 05:21:06"),
  // not 1970. Set per render() from d.order_date; with useUTC the value formats as the
  // plant-local clock (times are stored as plant-local clock in UTC fields).
  var chartBase = 0;
  function dayBase(orderDate) {
    if (!orderDate) return 0;
    var p = String(orderDate).slice(0, 10).split("-");
    return p.length === 3 ? Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])) : 0;
  }
  function pts(arr) { return (arr || []).map(function (p) { return [chartBase + p.t * 60000, p.v]; }); }
  function baseTime() {
    if (window.Highcharts) window.Highcharts.setOptions({ global: { useUTC: true, timezoneOffset: 0 } });
  }
  // D3's subtitle text (desktop vs touch), matched verbatim.
  var ZOOM_SUB = document.ontouchstart === undefined
    ? "Click and drag in the plot area to zoom in"
    : "Drag your finger over the plot to zoom in";
  // D3's tooltip header: "Monday, Jul 6, 05:21:06".
  var TOOLTIP = { shared: false, xDateFormat: "%A, %b %e, %H:%M:%S" };
  function renderCharts(c) {
    if (chartsDone || !window.Highcharts || !window.Highcharts.Chart || !c) return;
    baseTime();
    var pour = document.getElementById("pour-speed-chart");
    if (pour) {
      pour.innerHTML = "";
      new window.Highcharts.Chart({
        chart: { renderTo: pour, type: "spline", zoomType: "x", spacingRight: 10, spacingLeft: 10, spacingTop: 10, spacingBottom: 10 },
        colors: ["#434348", "#90ed7d", "#7cb5ec"],
        title: { text: "Pour Speed (CY/HR)" },
        subtitle: { text: ZOOM_SUB },
        xAxis: { type: "datetime", minRange: 6000, title: { text: null } },
        yAxis: { min: 0, title: { text: "" } },
        tooltip: TOOLTIP,
        legend: { enabled: true },
        credits: { enabled: false },
        plotOptions: { spline: { marker: { enabled: true } }, series: { connectNulls: true } },
        // Series names are quoted to match D3 (its CSV column headers include quotes).
        series: [
          { name: '"Delivered"', data: pts(c.delivered) },
          { name: '"Poured"', data: pts(c.poured) },
          { name: '"Ordered"', data: pts(c.orderedPoints) },
        ],
      });
    }
    var trucks = document.getElementById("job-inventory-chart1");
    if (trucks) {
      trucks.innerHTML = "";
      // Build the staircase INTO the data (hold the previous count until just before
      // the next event, then step to it) and draw a plain linear area — exactly how
      // D3 encodes the truck-count CSV. This gives crisp vertical steps + thin spikes
      // without relying on Highcharts' `step` (which can smear when stacked).
      var stepify = function (arr, key) {
        var out = [], prev = null;
        for (var i = 0; i < arr.length; i++) {
          var x = chartBase + arr[i].t * 60000;
          var y = arr[i][key];
          if (prev !== null) out.push([x - 1, prev]); // hold previous count up to this event
          out.push([x, y]); // step to the new count at the event
          prev = y;
        }
        return out;
      };
      var waiting = stepify(c.trucks || [], "waiting");
      var pouring = stepify(c.trucks || [], "pouring");
      new window.Highcharts.Chart({
        chart: { renderTo: trucks, type: "area", zoomType: "x", spacingRight: 10, spacingLeft: 10, spacingTop: 10, spacingBottom: 10 },
        colors: ["#434348", "#90ed7d"],
        title: { text: "Trucks on the Job" },
        subtitle: { text: ZOOM_SUB },
        xAxis: { type: "datetime", minRange: 60000, title: { text: null } },
        yAxis: { min: 0, title: { text: "" }, allowDecimals: false },
        tooltip: TOOLTIP,
        legend: { enabled: true },
        credits: { enabled: false },
        plotOptions: { area: { stacking: "normal", lineWidth: 1, marker: { enabled: false }, connectNulls: true } },
        series: [
          { name: '"Waiting"', data: waiting },
          { name: '"Pouring"', data: pouring },
        ],
      });
    }
    chartsDone = true;
  }

  // One D3-style chat bubble. bodyHtml is already-escaped/HTML; timeLabel optional.
  function chatBubble(bodyHtml, timeLabel) {
    return (
      '<div class="chat-list-bubble-container" style="margin:8px; width:100%"><div class="chat-list-bubble">' +
      '<table style="padding:10px; width:100%"><tbody><tr>' +
      '<td style="background-color: #d7e4ed; padding: 12px">' +
      '<div class="chat-list-content" style="width: 100%">' + bodyHtml + "</div>" +
      '<div class="chat-list-label" style="font-size: small; font-weight: bold">' +
      '<img src="' + ASSET + '/truckast_40.png" alt="TRUCKAST" width="40" height="40">' +
      (timeLabel ? " - " + esc(timeLabel) : "") + "</div>" +
      "</td>" +
      '<td style="width: 15px; vertical-align: top; border: 0; padding: 0"><img src="' + ASSET + '/chat-list-callout-author.png"></td>' +
      "</tr></tbody></table></div></div>"
    );
  }

  function unitFull(u) {
    u = String(u || "").toUpperCase();
    if (u === "CY" || u === "YDQ") return "Cubic Yards";
    return u;
  }

  // D3's final activity card: the full order summary + products (matches the D3
  // order-detail feed, which always closes with this block).
  function orderCard(d) {
    var L = [];
    L.push("Order Number: " + esc(d.order_code || ""));
    L.push("Order Status: " + esc(d.dispatch_status || ""));
    L.push("Plant: " + esc(d.plant_name || ""));
    L.push("Scheduled Time on Job: " + esc(d.scheduled_time || "n/a"));
    L.push("Spacing: " + (d.spacing_minutes != null ? esc(d.spacing_minutes) + " minutes" : "n/a"));
    L.push("Purchase Order: " + esc(d.purchase_order || "n/a"));
    L.push("Instructions: " + esc(d.instructions || "n/a"));
    L.push("Ordered By: " + esc(d.ordered_by || "n/a"));
    var prods = d.products || [];
    if (prods.length) {
      L.push("");
      L.push("PRODUCTS");
      prods.forEach(function (p) {
        L.push("Product Name: " + esc(p.item_code || ""));
        L.push("Product Description: " + esc(p.description || ""));
        L.push("Quantity: " + esc(half(p.qty)) + " " + esc(unitFull(p.unit)));
        L.push("Slump: " + esc(p.slump != null ? p.slump : ""));
        L.push("Usage: " + esc(p.usage || ""));
      });
    }
    return chatBubble(L.join("<br>"), "");
  }

  function renderChat(acts, d) {
    var el = document.getElementById("chat1");
    if (!el) return;
    var html = (acts || []).map(function (a) { return chatBubble(esc(a.text), a.time); }).join("");
    if (d) html += orderCard(d); // always close with the order-summary card, like D3
    el.innerHTML = html;
  }

  function setText(id, s) { var el = document.getElementById(id); if (el) el.textContent = s; }

  function render(d) {
    setText("d3-title", "ORDER " + d.order_code + "-" + mdShort(d.order_date));
    setText("d3-subtitle", d.delivery_addr1 || d.project_name || "");
    setText("d3-status", (STATUS[d.status] || d.status) + " - " + (d.customer_name || ""));

    var nt = splitTime(d.next_truck);
    var pf = splitTime(d.pour_finish);
    var hdr = document.getElementById("d3-header-tiles");
    if (hdr) {
      hdr.innerHTML =
        tile1x1("NEXT TRUCK", nt.v, nt.sub) +
        tile1x1("POUR FINISH", pf.v, pf.sub) +
        tile1x1("TRUCKS", String(d.trucks || 0), "MAP");
    }
    var det = document.getElementById("d3-detail-tiles");
    if (det) {
      det.innerHTML =
        tile1x1("ORDERED", half(d.ordered_cy), "CY") +
        tile1x1("TICKETED", half(d.ticketed_cy), "CY", "window.top.location.href='/orders/" + ID + "/tickets'") +
        tile1x1("ON JOB", half(d.on_job_cy), "CY") +
        '<div style="width: 100%; height: 1px; clear: both"></div>' +
        weatherTile(d.weather);
    }
    chartBase = dayBase(d.order_date);
    renderCharts(d.charts);
    renderChat(d.activity, d);
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
  setInterval(fetchDetail, 30000);
})();
