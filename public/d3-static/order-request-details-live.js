/*
 * Live client for the D3 "DoleseOrderRequestDetailsV2" shell (order-request-details.html).
 * Reads the OrderRequestID (GUID) from /order-request/{id}, fetches /api/order-request-detail
 * and fills the title, verify form, summary tile group, product tile, tables and chat bubble.
 * Our order-request queue is a static snapshot of the D3 export, so fields D3 pulls from its
 * D3BUY subsystem that the snapshot lacks (product mixes, spacing, chute usage, jobsite
 * contact, notes) render blank — the components are all present, as on D3.
 */
(function () {
  var ASSET = "/d3-static/JobsForFixedNodeID_files";
  var parts = location.pathname.split("/").filter(Boolean); // ["order-request","{id}"]
  var oi = parts.indexOf("order-request");
  var ID = oi >= 0 && parts[oi + 1] ? decodeURIComponent(parts[oi + 1]) : "";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function set(id, v) { var el = document.getElementById(id); if (el) el.textContent = v == null ? "" : v; }
  function num(n) { return (Math.round(Number(n || 0) * 100) / 100).toFixed(2); }
  function up(s) { return String(s || "").toUpperCase(); }

  // "6/29 09:00" -> {date:"6/29", time:"9:00 AM"}
  function splitStart(s) {
    if (!s) return { date: "", time: "" };
    var m = String(s).match(/^(\d+\/\d+)\s+(\d{1,2}):(\d{2})/);
    if (!m) return { date: String(s), time: "" };
    var h = Number(m[2]), mm = m[3];
    var ap = h >= 12 ? "PM" : "AM";
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return { date: m[1], time: h12 + ":" + mm + " " + ap };
  }
  // "6/29 09:00" -> "MON, JUN 29" (D3's VERIFY ORDER DATE format). Year comes from the
  // request date when present, else assumes the current calendar year.
  var DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  var MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  function longDate(startStr, orderDate) {
    var m = String(startStr || "").match(/^(\d+)\/(\d+)/);
    if (!m) return "";
    var yr = orderDate ? Number(String(orderDate).slice(0, 4)) : new Date().getFullYear();
    var d = new Date(yr, Number(m[1]) - 1, Number(m[2]));
    if (isNaN(d.getTime())) return m[1] + "/" + m[2];
    return DOW[d.getDay()] + ", " + MON[Number(m[1]) - 1] + " " + Number(m[2]);
  }

  // Request status → D3 title label + verify-form status + summary-tile abbrev.
  var STATUS = {
    active: { label: "SUBMITTED", verify: "WILL CALL", abbr: "W/C" },
    scheduled: { label: "ACCEPTED", verify: "Firm", abbr: "FIRM" },
    cancelled: { label: "CANCELLED", verify: "Hold", abbr: "HOLD" },
  };

  function productTile(bg, superTitle, title, subTitle) {
    return (
      '<div class="tile" style="position: relative; background-color: ' + bg + '; cursor: default; display: block;">' +
      '<div class="tileContainer"><div class="tileIcon"><img src="' + ASSET + '/order_2.png"></div>' +
      '<div class="tileInfoSection"><div class="tileCell">' +
      '<div class="tileSuperTitle">' + esc(superTitle) + "</div>" +
      '<div class="tileTitle">' + esc(title) + "</div>" +
      '<div class="tileSubTitle">' + esc(subTitle) + "</div>" +
      "</div></div></div></div>"
    );
  }

  var GREEN = "rgb(69, 139, 0)", BLUE = "rgb(47, 126, 216)";

  function render(d) {
    var st = STATUS[d.status] || STATUS.scheduled;
    var s = splitStart(d.start_time);
    // Customer / project read like D3 with their trailing codes ("… - LIT075", "…- 43945").
    var custLine = up(d.customer_name) + (d.customer_code ? " - " + up(d.customer_code) : "");
    var projLine = up(d.address) + (d.project_code ? "- " + esc(d.project_code) : "");

    // Title bar + label
    set("or-cust", custLine || "ORDER REQUEST");
    set("or-project", projLine);
    set("or-title", "REQUEST #" + (d.order_code || "") + " - " + (d.status_label || st.label));

    // Verify form
    var oe = document.getElementById("or-ordereid"); if (oe) oe.value = String(d.order_code || "").replace(/^R/i, "");
    var os = document.getElementById("or-orderstatus"); if (os) os.value = st.verify;
    var sd = document.getElementById("or-scheduledate");
    if (sd) { var ld = longDate(d.start_time, d.order_date); sd.innerHTML = '<option selected>' + esc(ld) + "</option>"; }
    var stime = document.getElementById("or-scheduletime");
    if (stime && s.time) { var m24 = String(d.start_time || "").match(/(\d{1,2}):(\d{2})/); if (m24) stime.value = ("0" + m24[1]).slice(-2) + ":" + m24[2]; }

    // Summary tiles
    set("or-tile-status", st.abbr);
    set("or-tile-onjob", s.date);
    set("or-tile-onjob-time", s.time);
    set("or-tile-spacing", d.spacing_minutes != null ? d.spacing_minutes : "");
    set("or-method", up(d.method));
    set("or-usage", up(d.usage));
    set("or-po", d.po || "");
    set("or-loc-name", up(d.address));
    set("or-loc-addr", up(d.full_address || d.address));
    set("or-loc-region", d.region ? "Region: " + up(d.region) : "");
    set("or-contact", d.contact || "");

    // Product tiles: one per product mix when we have the detail (D3-style), else a single
    // tile with the ordered total (dashboard-snapshot-only requests).
    var box = document.getElementById("or-product-tiles");
    if (box) {
      if (Array.isArray(d.products) && d.products.length) {
        box.innerHTML = d.products.map(function (p) {
          var bg = p.color === "blue" ? BLUE : GREEN;
          var sup = up(p.code) + (p.desc ? "(" + esc(p.desc) + ")" : "");
          var title = p.cy != null ? num(p.cy) + " CY" : "";
          var sub = p.slump ? "SLUMP: " + esc(p.slump) : "";
          return productTile(bg, sup, title, sub);
        }).join("");
      } else {
        box.innerHTML = productTile(GREEN, up(d.customer_name), num(d.ordered_cy) + " CY", "");
      }
    }

    // Product Category / Description table
    var pcb = document.getElementById("or-prodcat-body");
    if (pcb) {
      pcb.innerHTML = Array.isArray(d.products)
        ? d.products.map(function (p, i) {
            return '<tr class="gradeA ' + (i % 2 ? "even" : "odd") + '"><td>' + esc(up(p.category)) + "</td><td>" +
              esc(up(p.code)) + (p.desc ? "(" + esc(p.desc) + ")" : "") + "</td></tr>";
          }).join("")
        : "";
    }

    // Region table — prefer the full "REGION - Plant" string, else the plain region.
    var rb = document.getElementById("or-region-body");
    if (rb) {
      var rv = d.region_full ? up(d.region_full) : d.region ? up(d.region) : "";
      rb.innerHTML = rv ? '<tr class="gradeA odd"><td>' + esc(rv) + "</td></tr>" : "";
    }

    // Notes & Comments table
    var nb = document.getElementById("or-notes-body");
    if (nb) nb.innerHTML = d.notes ? '<tr class="gradeA odd"><td>' + esc(d.notes) + "</td></tr>" : "";

    // Chat: synthesize the request summary from the fields we have.
    var chat = document.getElementById("chat1");
    if (chat) {
      var prodLines = Array.isArray(d.products)
        ? d.products.map(function (p) {
            return "Product Name: " + esc(up(p.code)) + "<br>Product Description: " + esc(p.desc || "") +
              (p.slump ? "<br>Slump: " + esc(p.slump) : "") + (p.cy != null ? "<br>Quantity: " + num(p.cy) + " CY" : "") + "<br>";
          }).join("<br>")
        : "";
      var msg =
        esc(up(d.customer_name)) + " placed an Order Request." + "<br><br>" +
        "Order Request Number: " + esc(String(d.order_code || "").replace(/^R/i, "")) + "<br>" +
        "Customer: " + esc(custLine) + "<br>" +
        "Job (Project): " + esc(projLine) + "<br>" +
        "Requested Start Time: " + esc(d.start_time || "") + "<br>" +
        "Address: " + esc(up(d.full_address || d.address)) + "<br>" +
        (d.region_full ? "Region: " + esc(up(d.region_full)) + "<br>" : d.region ? "Region: " + esc(up(d.region)) + "<br>" : "") +
        "Order Status: " + esc(st.abbr) + "<br>" +
        (d.spacing_minutes != null ? "Spacing Minutes: " + esc(d.spacing_minutes) + " Minutes<br>" : "") +
        (prodLines ? "<br>PRODUCTS<br>" + prodLines : "") +
        (d.notes ? "<br>Notes &amp; Comments: " + esc(d.notes) : "");
      chat.innerHTML =
        '<div class="chat-list-bubble-container" style="margin:8px; width:100%">' +
        '<div class="chat-list-bubble"><table style="padding:10px; width:100%"><tbody><tr>' +
        '<td style="background-color: #d7e4ed; padding: 12px">' +
        '<div class="chat-list-content" style="width: 100%">' + msg + "</div>" +
        '<div class="chat-list-label" style="font-size: small; font-weight: bold">' +
        '<img src="' + ASSET + '/truckast_40.png" alt="TRUCKAST" width="40" height="40"> - TRUCKAST</div>' +
        "</td>" +
        '<td style="width: 15px; vertical-align: top; border: 0; padding: 0"><img src="' + ASSET + '/chat-list-callout-author.png" style="border: 0"></td>' +
        "</tr></tbody></table></div></div>";
    }
  }

  function fetchDetail() {
    if (!ID) return;
    fetch("/api/order-request-detail?id=" + encodeURIComponent(ID), { cache: "no-store" })
      .then(function (x) { return x.ok ? x.json() : null; })
      .then(function (d) { if (d && !d.error) render(d); })
      .catch(function () {});
  }

  if (document.readyState !== "loading") fetchDetail();
  else document.addEventListener("DOMContentLoaded", fetchDetail);
})();
