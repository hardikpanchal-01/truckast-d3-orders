/*
 * Live client for the D3 "Ticket Details" shell (public/d3-static/ticket-details.html).
 * Reads the ticket id from the URL (/orders/{orderId}/tickets/{ticketId}), fetches
 * /api/ticket-detail, and renders the truck tile, ordered-product tiles and the
 * status-timeline + Verifi sensor cards — the D3 page, driven by our DB.
 */
(function () {
  var parts = location.pathname.split("/").filter(Boolean); // ["orders",oid,"tickets",tid]
  var oi = parts.indexOf("orders");
  var ORDER = oi >= 0 && parts[oi + 1] ? parts[oi + 1] : "";
  var ti = parts.indexOf("tickets");
  var TID = ti >= 0 && parts[ti + 1] ? parts[ti + 1] : "";
  var ASSET = "/d3-static/TicketDetails_files";
  var BLUE = "rgb(47, 126, 216)";
  var GREEN = "rgb(69, 139, 0)";
  var DARK = "rgb(63, 63, 63)"; // Verifi sensor cards (D3's exact shade)
  var STATUS = { IN_PROCESS: "IN PROCESS", PRE_POUR: "PRE-POUR", COMPLETED: "COMPLETE", CANCELED: "CANCELLED" };
  // Event icon slug → vendored glyph. Truck-status stages + the Verifi logo.
  var ICON = {
    ticketed: "ticket_2", loading: "loading_2", loaded: "loaded_2", to_job: "to_job_2",
    at_job: "at_job_2", on_job: "at_job_2", pouring: "pouring_2", poured: "end_pour_2",
    washing: "washing_2", end_wash: "end_washing_2", to_plant: "to_plant_2", at_plant: "at_plant_2",
    verifi: "verifi_logo", order: "order_2", truck: "truck",
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function setText(id, s) { var el = document.getElementById(id); if (el) el.textContent = s; }
  function iconFor(slug) { return ASSET + "/" + (ICON[slug] || "order_2") + ".png"; }
  // Uppercase the plant name and restore D3's "PORTABLE #N" convention (our synced
  // data stores portable plants as "Portable N" without the #).
  function plantName(s) { return String(s || "").toUpperCase().replace(/\bPORTABLE\s+(\d)/, "PORTABLE #$1"); }

  // One D3 tile (274x90): icon + super/title/sub text. bg = background colour.
  function tile(bg, iconSlug, superT, title, sub) {
    return (
      '<div class="tile" style="position: relative; background-color: ' + bg + '; cursor: default; display: block;">' +
      '<div class="tileContainer"><div class="tileIcon"><img src="' + iconFor(iconSlug) +
      '" onerror="this.onerror=null;this.src=\'' + ASSET + '/order_2.png\'"></div>' +
      '<div class="tileInfoSection"><div class="tileCell">' +
      '<div class="tileSuperTitle">' + esc(superT) + "</div>" +
      '<div class="tileTitle">' + esc(title) + "</div>" +
      '<div class="tileSubTitle">' + esc(sub || "") + "</div>" +
      "</div></div></div></div>"
    );
  }

  function render(d) {
    setText("d3-title", "TICKET " + (d.ticket_code || ""));
    setText("d3-subtitle", String(d.subtitle || "").toUpperCase());
    setText("d3-status", STATUS[d.status] || d.status || "");

    // Plant / truck header tile.
    var truck = document.getElementById("td-truck");
    if (truck) {
      truck.innerHTML = tile(
        BLUE, "truck",
        d.plant_name ? "PLANT: " + plantName(d.plant_name) : "",
        "TRUCK: " + (d.truck_code || "—"),
        d.printed_stamp || ""
      );
    }

    // Ordered products (green = mix, blue = other).
    var prods = document.getElementById("td-products");
    if (prods) {
      prods.innerHTML = (d.products || []).map(function (p) {
        var name = ((p.item_code || "") + (p.description ? " (" + p.description + ")" : "")).toUpperCase();
        return tile(p.is_mix ? GREEN : BLUE, "order", name,
          (Number(p.qty || 0)).toFixed(2) + " " + (p.unit || ""),
          p.slump != null ? "SLUMP: " + p.slump + " IN" : "");
      }).join("");
    }

    // Status timeline + Verifi sensor cards.
    var events = document.getElementById("td-events");
    if (events) {
      events.innerHTML = (d.events || []).map(function (ev) {
        var bg = ev.dark ? DARK : BLUE;
        var slug = ev.dark ? "verifi" : ev.icon;
        return tile(bg, slug, ev.title, ev.value, ev.sub);
      }).join("");
    }
  }

  function fetchDetail() {
    if (!TID) return;
    fetch("/api/ticket-detail?id=" + encodeURIComponent(TID), { cache: "no-store" })
      .then(function (x) { return x.ok ? x.json() : null; })
      .then(function (d) { if (d && !d.error) render(d); })
      .catch(function () {});
  }
  window.d3Refresh = fetchDetail;

  if (document.readyState !== "loading") fetchDetail();
  else document.addEventListener("DOMContentLoaded", fetchDetail);
  setInterval(fetchDetail, 30000);
})();
