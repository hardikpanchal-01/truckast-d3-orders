/*
 * Live client for the D3 "OrderDetails" shell (order-details.html).
 * Reads the order id from /orders/{id}/details, fetches /api/order-detail, and renders
 * D3's OrderDetails view: the STATUS / ON JOB / RATE header tiles, one card per ordered
 * product (mix = green) and the plant weather tile. The ORDERED tile on the order page
 * links here.
 */
(function () {
  var parts = location.pathname.split("/").filter(Boolean); // ["orders","{id}","details"]
  var oi = parts.indexOf("orders");
  var ID = oi >= 0 && parts[oi + 1] ? parts[oi + 1] : "";
  var ASSET = "/d3-static/Order_files";
  var BLUE = "rgb(47, 126, 216)";
  var GREEN = "rgb(69, 139, 0)";
  var STATUS = { IN_PROCESS: "IN PROCESS", PRE_POUR: "PRE-POUR", COMPLETED: "COMPLETE", CANCELED: "CANCELLED" };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  // Concrete is half-yard increments → show CY to nearest 0.50 (matches D3's 304.50).
  function half(n) { return (Math.round(Number(n || 0) * 2) / 2).toFixed(2); }
  function num2(n) { return Number(n || 0).toFixed(2); }
  function mdShort(s) {
    if (!s) return "";
    var p = String(s).slice(0, 10).split("-");
    return p.length === 3 ? Number(p[1]) + "/" + Number(p[2]) : "";
  }
  // "2026-07-08T01:00:00+00:00" → { time:"01:00", date:"07/08/26" } (UTC parts = CST clock).
  function onJobParts(iso) {
    if (!iso) return { time: "", date: "" };
    var d = new Date(iso);
    if (isNaN(d.getTime())) return { time: "", date: "" };
    var hh = String(d.getUTCHours()).padStart(2, "0");
    var mm = String(d.getUTCMinutes()).padStart(2, "0");
    var mo = String(d.getUTCMonth() + 1).padStart(2, "0");
    var da = String(d.getUTCDate()).padStart(2, "0");
    var yy = String(d.getUTCFullYear()).slice(2);
    return { time: hh + ":" + mm, date: mo + "/" + da + "/" + yy };
  }

  // D3 fixed 88x90 header tile (STATUS / ON JOB / RATE).
  function tile1x1(tagline, title, subtitle) {
    return (
      '<div class="tile" style="position: relative; width: 88px; height: 90px; margin-right: 5px; margin-bottom: 5px; background-color: ' +
      BLUE + '; float: left; color: white; cursor: default; display: block;">' +
      '<div style="padding:5px">' +
      '<div style="text-align: center; font-size: 12px; font-weight: bold">' + esc(tagline) + "</div>" +
      '<div style="width:100%; height:40px; line-height: 40px; text-align: center; vertical-align: middle; font-weight: bold; font-size: 24px">' + esc(title) + "</div>" +
      '<div style="text-align: center; font-size: 12px">' + esc(subtitle || "") + "</div>" +
      "</div></div>"
    );
  }

  // D3 product card: item (description) / qty unit / SLUMP. Mix = green, else blue.
  function productTile(p) {
    var unit = String(p.unit || "").toUpperCase();
    var isEach = unit === "EA" || unit === "EACH";
    var qtyStr = isEach ? num2(p.qty) + " EACH" : half(p.qty) + " " + (unit || "CY");
    var superTitle = esc(p.item_code || "") + (p.description ? " (" + esc(p.description) + ")" : "");
    var sub = p.is_mix && p.slump != null ? "SLUMP: " + esc(p.slump) + " IN" : "";
    return (
      '<div class="tile" style="position: relative; background-color: ' + (p.is_mix ? GREEN : BLUE) + '; cursor: default; display: block;">' +
      '<div class="tileContainer"><div class="tileIcon"><img src="' + ASSET + '/order_2.png"></div>' +
      '<div class="tileInfoSection"><div class="tileCell">' +
      '<div class="tileSuperTitle">' + superTitle + "</div>" +
      '<div class="tileTitle">' + esc(qtyStr) + "</div>" +
      '<div class="tileSubTitle">' + sub + "</div>" +
      "</div></div></div></div>"
    );
  }

  // Plant weather tile (D3 OrderDetails uses the 02n "few clouds" glyph; clear → 01N).
  function weatherTile(w) {
    if (!w) return "";
    var desc = String(w.description || "").toLowerCase();
    var icon = desc.indexOf("clear") >= 0 ? ASSET + "/01N.PNG"
      : desc.indexOf("few") >= 0 || desc.indexOf("scattered") >= 0 || desc.indexOf("part") >= 0 ? ASSET + "/02n.png"
      : ASSET + "/02n.png";
    return (
      '<div class="tile" style="position: relative; background-color: ' + BLUE + '; cursor: default; display: block;">' +
      '<div class="tileContainer"><div class="tileIcon"><img src="' + icon + '" onerror="this.src=\'' + ASSET + '/02n.png\'"></div>' +
      '<div class="tileInfoSection"><div class="tileCell">' +
      '<div class="tileSuperTitle"><span style="font-size: 11px; font-weight: bold;">' + esc(w.place || "") + "</span></div>" +
      '<div class="tileTitle"><span style="font-size: 14px; font-weight: bold;">' + esc(((w.temp || "") + " " + (w.description || "")).trim()) + "</span></div>" +
      '<div class="tileSubTitle">H: ' + esc(w.humidity || "") + "   P: " + esc(w.pressure || "") + "   W: " + esc(w.wind || "") + " " + esc(w.direction || "") +
      (w.updated ? "<br>Last Update: " + esc(w.updated) : "") + "</div>" +
      "</div></div></div></div>"
    );
  }

  function render(d) {
    var title = document.getElementById("d3-od-title");
    if (title) title.textContent = "ORDER " + (d.order_code || "") + "-" + mdShort(d.order_date);
    var sub = document.getElementById("d3-od-subtitle");
    if (sub) sub.textContent = String(d.delivery_addr1 || d.project_name || "").toUpperCase();
    var st = document.getElementById("d3-od-status");
    if (st) {
      st.innerHTML = "<h4>" + esc((STATUS[d.status] || d.status || "") +
        (d.customer_name ? " - " + d.customer_name : "")) + "</h4>";
    }

    // Header tiles: STATUS / ON JOB / RATE
    var oj = onJobParts(d.scheduled_time_raw || d.order_date);
    var hdr = document.getElementById("d3-od-header");
    if (hdr) {
      hdr.innerHTML =
        tile1x1("STATUS", String(d.dispatch_status || "").toUpperCase(), "") +
        tile1x1("ON JOB", oj.time, oj.date) +
        tile1x1("RATE", d.delivery_rate != null ? num2(d.delivery_rate) : "", "CY/HR");
    }

    // Product cards + weather
    var host = document.getElementById("d3-od-products");
    if (host) {
      host.innerHTML =
        (d.products || []).map(productTile).join("") +
        '<div style="width: 100%; height: 1px; clear: both"></div>' +
        weatherTile(d.weather);
    }
  }

  function fetchDetails() {
    if (!ID) return;
    fetch("/api/order-detail?id=" + encodeURIComponent(ID), { cache: "no-store" })
      .then(function (x) { return x.ok ? x.json() : null; })
      .then(function (d) { if (d && !d.error) render(d); })
      .catch(function () {});
  }

  if (document.readyState !== "loading") fetchDetails();
  else document.addEventListener("DOMContentLoaded", fetchDetails);
  setInterval(fetchDetails, 60000);
})();
