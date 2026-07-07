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
  var GREEN = "rgb(69, 139, 0)";
  var RED = "rgb(196, 57, 38)";
  var YELLOW = "rgb(247, 187, 0)";
  var STATUS = { IN_PROCESS: "IN PROCESS", PRE_POUR: "PRE-POUR", COMPLETED: "COMPLETE", CANCELED: "CANCELLED" };

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

  function tile1x1(tagline, title, subtitle, onclick, bg) {
    var click = onclick ? ' onclick="' + onclick + '"' : "";
    var cur = onclick ? "pointer" : "default";
    var dog = onclick ? '<img src="' + ASSET + '/dogear.png" style="position:absolute;right:0;bottom:0">' : "";
    return (
      '<div class="tile" style="position: relative; width: 88px; height: 90px; margin-right:5px; margin-bottom: 5px; background-color: ' +
      (bg || BLUE) + "; float: left; color:white; cursor:" + cur + '; display:block"' + click + ">" + dog +
      '<div style="padding:5px">' +
      '<div style="text-align:center;font-size:12px;font-weight:bold">' + esc(tagline) + "</div>" +
      '<div style="width:100%;height:40px;line-height:40px;text-align:center;font-weight:bold;font-size:24px">' + esc(title) + "</div>" +
      '<div style="text-align:center;font-size:12px">' + esc(subtitle || "") + "</div>" +
      "</div></div>"
    );
  }

  function weatherTile(w, finalLabel) {
    if (!w) return "";
    // Pick the D3 weather glyph from the condition text: clear → 01N, else clouds (04n).
    var desc = String((w && w.description) || "").toLowerCase();
    var icon = w.icon ? ASSET + "/" + w.icon + ".png"
      : desc.indexOf("clear") >= 0 ? ASSET + "/01N.PNG"
      : ASSET + "/04n.png";
    return (
      '<div class="tile" style="position: relative; background-color: ' + BLUE + '; cursor: default; display: block;">' +
      '<div class="tileContainer"><div class="tileIcon"><img src="' + icon + '" onerror="this.src=\'' + ASSET + '/04n.png\'"></div>' +
      '<div class="tileInfoSection"><div class="tileCell">' +
      '<div class="tileSuperTitle"><span style="font-size:11px;font-weight:bold">' + esc(w.place || "") + "</span></div>" +
      '<div class="tileTitle"><span style="font-size:14px;font-weight:bold">' + esc(((w.temp || "") + " " + (w.description || "")).trim()) + "</span></div>" +
      '<div class="tileSubTitle">H: ' + esc(w.humidity || "") + "   P: " + esc(w.pressure || "") + "   W: " + esc(w.wind || "") + " " + esc(w.direction || "") +
      (w.updated ? "<br>" + (finalLabel ? "Final Update: " : "Last Update: ") + esc(w.updated) : "") + "</div>" +
      "</div></div></div></div>"
    );
  }

  // Evaporation-rate tile (shown on Completed orders in D3). Coloured by shrinkage-
  // cracking risk: Normal = green, Caution = yellow, High/Severe = red.
  function evaporationTile(e) {
    if (!e) return "";
    var risk = String(e.risk || "").toLowerCase();
    var bg = risk.indexOf("high") >= 0 || risk.indexOf("severe") >= 0 ? RED
           : risk.indexOf("caution") >= 0 ? YELLOW : GREEN;
    return (
      '<div class="tile" style="position: relative; background-color: ' + bg + '; cursor: default; display: block;">' +
      '<div class="tileContainer"><div class="tileIcon"><img src="' + ASSET + '/EVAPORATIONRATEVERIFI.PNG"></div>' +
      '<div class="tileInfoSection"><div class="tileCell">' +
      '<div class="tileSuperTitle"><span style="font-size:14px;font-weight:bold">Evaporation Rate </span></div>' +
      '<div class="tileTitle"><span style="font-size:12px;font-weight:bold">Concrete: ' + esc(e.concreteTempF != null ? e.concreteTempF + "F" : "") + ", " + esc(e.rate != null ? e.rate + " lb/ft^2/hr" : "") + "<br>Shrinkage Cracking: " + esc(e.risk || "") + "</span></div>" +
      '<div class="tileSubTitle"><span style="font-size:11px;font-weight:normal">' +
      (e.ticketNo ? "Please use as a guide  TN:" + esc(e.ticketNo) : "Please use as a guide") + "</span></div>" +
      "</div></div></div></div>"
    );
  }

  // Delay Overview table (D3), shown on Completed orders below the Trucks chart.
  // Uses D3's EXACT export markup — the ".d3-label" header, the Bootstrap
  // "table table-striped" table, <font color> value cells and the "btn btn-success"
  // button — so the layout, striping and spacing are styled verbatim by
  // d3_complete.css (already loaded on the page). Contractor Delay is signed: red
  // when positive (over the allotted pour), green when zero/negative.
  function delayOverviewHtml(loads) {
    if (!loads || !loads.length) return "";
    // Column widths as PERCENTAGES of D3's rendered dataTable (210/139/205/233/303 px)
    // so the columns spread across the full width exactly like D3's, at any container size.
    var W = ["19.3%", "12.7%", "18.8%", "21.4%", "27.8%"];
    var rows = loads.map(function (l, idx) {
      var cd = l.contractor_delay;
      var color = cd > 0 ? "red" : "green";
      var rowClass = idx % 2 === 0 ? "gradeA odd" : "gradeA even";
      return '<tr class="' + rowClass + '">' +
        '<td style="border-top:0" class="  sorting_1">' + esc(l.order) + "</td>" +
        '<td style="border-top:0" class=" ">' + esc(l.truck) + "</td>" +
        '<td style="border-top:0" class=" ">' + esc(l.prod_delay) + "</td>" +
        '<td style="border-top:0" class=" ">' + esc(l.wait_to_pour) + "</td>" +
        '<td style="border-top:0" class=" "><font color="' + color + '">' + esc(cd) + "</font></td>" +
        "</tr>";
    }).join("");
    return '<div class="d3-label" style="width: 100%;"><h4>Delay Overview</h4></div>' +
      '<div style="display: block; width: 100%">' +
      '<div class="dataTables_wrapper form-inline" role="grid">' +
      '<div class="row"><div class="span6"></div><div class="span6"></div></div>' +
      '<table cellpadding="0" cellspacing="0" border="0" class="table table-striped dataTable" style="width: 100%;">' +
      '<thead><tr role="row">' +
      '<th class="sorting_asc" role="columnheader" style="width:' + W[0] + '">Load Order</th>' +
      '<th class="sorting" role="columnheader" style="width:' + W[1] + '">Truck</th>' +
      '<th class="sorting" role="columnheader" style="width:' + W[2] + '">Prod Delay</th>' +
      '<th class="sorting" role="columnheader" style="width:' + W[3] + '">Wait To Pour</th>' +
      '<th class="sorting" role="columnheader" style="width:' + W[4] + '">Contractor Delay</th>' +
      "</tr></thead>" +
      '<tbody role="alert" aria-live="polite" aria-relevant="all">' + rows + "</tbody></table>" +
      '<div class="row"><div class="span6"></div><div class="span6"></div></div>' +
      "</div></div>" +
      '<a class="btn btn-success" style="width:100px; display:inline-block" ' +
      "onclick=\"window.top.location.href='/orders/" + ID + "/delays'\">Delay Details</a><br><br><br><br>"
      ;
  }
  function renderDelayOverview(loads) {
    var host = document.getElementById("d3-delay-overview");
    if (host) host.innerHTML = delayOverviewHtml(loads);
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
        // Pin the x-axis to 15-minute gaps (D3's Pour Speed spacing for this order),
        // instead of Highcharts' width-dependent auto ticks.
        xAxis: { type: "datetime", minRange: 6000, tickInterval: 15 * 60 * 1000, title: { text: null } },
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
        var out = [], prev = null, prevX = null;
        // Give each riser a small diagonal ramp (~1 min, clamped to 40% of the gap to
        // the previous event) so steps LEAN like D3 instead of being a vertical wall.
        // Tightly-spaced events clamp down so brief spikes stay thin.
        var RAMP = 60000;
        for (var i = 0; i < arr.length; i++) {
          var x = chartBase + arr[i].t * 60000;
          var y = arr[i][key];
          if (prev !== null) {
            var ramp = Math.min(RAMP, (x - prevX) * 0.4);
            out.push([x - ramp, prev]); // hold previous count until just before the event
          }
          out.push([x, y]); // diagonal (not vertical) to the new count at the event
          prev = y;
          prevX = x;
        }
        return out;
      };
      // Anchor the staircase to the order's SCHEDULED start (c.tMin = 02:00), like D3:
      // prepend a zero-count baseline point at that time so the area sits flat at 0 from
      // the scheduled start until the first truck arrives, and the x-axis begins at 02:00
      // instead of at the first event (~02:06).
      var truckData = (c.trucks || []).slice();
      var startT = (typeof c.tMin === "number") ? c.tMin
        : (truckData.length ? truckData[0].t : 0);
      if (truckData.length && truckData[0].t > startT) {
        truckData.unshift({ t: startT, waiting: 0, pouring: 0 });
      }
      var waiting = stepify(truckData, "waiting");
      var pouring = stepify(truckData, "pouring");
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
        plotOptions: {
          area: {
            stacking: "normal",
            lineWidth: 1,
            // No point marker, and no bold hover marker / halo ring on the hovered node.
            marker: { enabled: false, states: { hover: { enabled: false } } },
            states: { hover: { halo: null } },
            connectNulls: true,
          },
        },
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

  // ---- Pre-Pour tile helpers. For an order with no ticket activity D3 shows a
  //      different layout: STATUS / ON JOB / RATE, then one product tile per product
  //      (not NEXT TRUCK / ORDERED / TICKETED / ON JOB). ----
  function onJobTime(raw) {
    if (!raw) return "—";
    var d = new Date(raw);
    if (isNaN(d.getTime())) return "—"; // scheduled clock (CST value in a UTC field)
    return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
  }
  function onJobDate(raw) {
    if (!raw) return "";
    var d = new Date(raw);
    if (isNaN(d.getTime())) return "";
    return String(d.getUTCMonth() + 1).padStart(2, "0") + "/" + String(d.getUTCDate()).padStart(2, "0") + "/" + String(d.getUTCFullYear()).slice(-2);
  }
  // Barcode + "ORDER" glyph (D3's product-tile icon), inline SVG.
  function barcodeSvg() {
    var widths = [2, 1, 3, 1, 2, 3, 1, 2, 1, 3, 1, 2, 2, 1, 3, 1, 2, 1];
    var bars = "", xp = 6;
    for (var i = 0; i < widths.length; i++) {
      if (i % 2 === 0) bars += '<rect x="' + xp + '" y="6" width="' + widths[i] + '" height="34" fill="#fff"/>';
      xp += widths[i] + 1;
    }
    return '<svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">' + bars +
      '<text x="30" y="56" text-anchor="middle" font-size="11" font-weight="bold" fill="#fff">ORDER</text></svg>';
  }
  // Green product tile (D3's Pre-Pour product card): item, ordered CY, slump.
  function productTile(p) {
    var name = (p.item_code || "") + " (" + (p.description || "") + " )";
    return (
      '<div class="tile" style="position: relative; background-color: rgb(69, 139, 0); cursor: default; display: block;">' +
      '<div class="tileContainer"><div class="tileIcon">' + barcodeSvg() + "</div>" +
      '<div class="tileInfoSection"><div class="tileCell">' +
      '<div class="tileSuperTitle">' + esc(name) + "</div>" +
      '<div class="tileTitle"><span style="font-size:16px;font-weight:bold">' + esc(half(p.qty)) + " CY</span></div>" +
      '<div class="tileSubTitle">SLUMP: ' + esc(p.slump != null ? p.slump : "") + " IN</div>" +
      "</div></div></div></div>"
    );
  }

  function render(d) {
    setText("d3-title", "ORDER " + d.order_code + "-" + mdShort(d.order_date));
    setText("d3-subtitle", (d.delivery_addr1 || d.project_name || "").toUpperCase());
    setText("d3-status", (STATUS[d.status] || d.status) + " - " + (d.customer_name || ""));

    var hdr = document.getElementById("d3-header-tiles");
    var det = document.getElementById("d3-detail-tiles");

    if (d.status === "PRE_POUR") {
      // Pre-Pour layout (D3): STATUS / ON JOB / RATE, then a product tile per product.
      if (hdr) {
        hdr.innerHTML =
          tile1x1("STATUS", d.dispatch_status || "—", "") +
          tile1x1("ON JOB", onJobTime(d.scheduled_time_raw), onJobDate(d.scheduled_time_raw)) +
          tile1x1("RATE", d.delivery_rate != null ? Number(d.delivery_rate).toFixed(2) : "—", "CY/HR");
      }
      if (det) {
        det.innerHTML =
          (d.products || []).map(productTile).join("") +
          '<div style="width: 100%; height: 1px; clear: both"></div>' +
          weatherTile(d.weather);
      }
    } else if (d.status === "COMPLETED") {
      // Completed layout (D3 COMPLETE spec): LOADS / LOADS %ON TIME / POURED, then
      // POUR RATE / DOLESE (producer) delay / <customer> delay, weather (Final Update)
      // and the evaporation-rate tile.
      var onTime = d.on_time_pct != null ? d.on_time_pct : 0;
      var otColor = onTime >= 90 ? GREEN : onTime >= 60 ? YELLOW : RED; // spec colour bands
      var dd = d.dolese_delay_min || 0;
      var cd = d.customer_delay_min != null ? d.customer_delay_min : (d.job_delay_min || 0);
      var producer = ((d.customer_name || "").split(/\s+/)[0] || "CUSTOMER").toUpperCase();
      if (hdr) {
        hdr.innerHTML =
          // LOADS → ticket summary; the onclick makes tile1x1 add the corner dogear.
          tile1x1("LOADS", String(d.loads || 0), "", "window.top.location.href='/orders/" + ID + "/tickets'") +
          tile1x1("LOADS", onTime + " %", "ON TIME", null, otColor) +
          tile1x1("POURED", half(d.poured_cy), "CY");
      }
      if (det) {
        det.innerHTML =
          tile1x1("POUR RATE", (d.pour_rate != null ? Number(d.pour_rate).toFixed(2) : "0.00"), "CY/HR") +
          tile1x1("DOLESE", String(dd), "DELAY MIN", dd > 0 ? "window.top.location.href='/orders/" + ID + "/delays'" : null, dd > 0 ? RED : BLUE) +
          tile1x1(producer, String(cd), "DELAY MIN", cd > 0 ? "window.top.location.href='/orders/" + ID + "/delays'" : null, cd > 0 ? RED : BLUE) +
          '<div style="width: 100%; height: 1px; clear: both"></div>' +
          weatherTile(d.weather, true) +
          '<div style="width: 100%; height: 1px; clear: both"></div>' +
          evaporationTile(d.evaporation);
      }
    } else {
      // In-Process / Complete layout.
      var nt = splitTime(d.next_truck);
      var pf = splitTime(d.pour_finish);
      if (hdr) {
        hdr.innerHTML =
          tile1x1("NEXT TRUCK", nt.v, nt.sub) +
          tile1x1("POUR FINISH", pf.v, pf.sub) +
          tile1x1("TRUCKS", String(d.trucks || 0), "MAP");
      }
      if (det) {
        det.innerHTML =
          tile1x1("ORDERED", half(d.ordered_cy), "CY") +
          tile1x1("TICKETED", half(d.ticketed_cy), "CY", "window.top.location.href='/orders/" + ID + "/tickets'") +
          tile1x1("ON JOB", half(d.on_job_cy), "CY") +
          '<div style="width: 100%; height: 1px; clear: both"></div>' +
          weatherTile(d.weather);
      }
    }
    chartBase = dayBase(d.order_date);
    renderCharts(d.charts);
    renderDelayOverview(d.status === "COMPLETED" ? d.delay_loads : null);
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
