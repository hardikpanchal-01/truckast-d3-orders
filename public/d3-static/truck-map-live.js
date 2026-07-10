/*
 * Live client for the D3 "TruckMap" shell (truck-map.html).
 * Reads the order id from /orders/{id}/truckmap, fetches /api/truck-map, plots the
 * jobsite + plant on a keyless Leaflet/OSM map, and fills the truck / plant / jobsite
 * data tables. Our mirror has no truck GPS feed, so trucks are listed in the table but
 * cannot be placed on the map (D3 gets live GPS; we don't). The TRUCKS "MAP" tile links here.
 */
(function () {
  var parts = location.pathname.split("/").filter(Boolean); // ["orders","{id}","truckmap"]
  var oi = parts.indexOf("orders");
  var ID = oi >= 0 && parts[oi + 1] ? parts[oi + 1] : "";
  var STATUS = { IN_PROCESS: "IN PROCESS", PRE_POUR: "PRE-POUR", COMPLETED: "COMPLETE", CANCELED: "CANCELLED" };
  var mapInited = false, map = null;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function mdShort(s) {
    if (!s) return "";
    var p = String(s).slice(0, 10).split("-");
    return p.length === 3 ? Number(p[1]) + "/" + Number(p[2]) : "";
  }
  function cy(n) { return (Math.round(Number(n || 0) * 100) / 100).toFixed(2); }
  function td(v) { return "<td>" + esc(v == null ? "" : v) + "</td>"; }
  // Plant name like D3: uppercase, drop the "CEMCO " prefix ("Cemco Portable #5 - Exit 1"
  // → "PORTABLE #5 - EXIT 1").
  function plantName(s) { return String(s || "").toUpperCase().replace(/^CEMCO\s+/, ""); }

  function renderTables(d) {
    // Trucks
    var host = document.getElementById("d3-tm-trucks");
    if (host) {
      // Columns match D3's TruckMap table. LAT DEC / LONG DEC = live truck GPS; the HEX
      // columns are blank (D3's are blank too). Volume/Shipped/Driver live in the popup.
      host.innerHTML = (d.trucks || []).map(function (t) {
        return "<tr>" + td(t.ticket_code) + td(t.truck_code) + td(t.status) +
          td(t.lat != null ? t.lat : "") + td("") + td(t.lng != null ? t.lng : "") + td("") +
          td(t.last_update) + td(t.load_number) + td(t.plant_code ? "CG-" + t.plant_code : "") +
          "</tr>";
      }).join("");
    }
    // Plant
    var ph = document.getElementById("d3-tm-plant");
    if (ph) {
      ph.innerHTML = d.plant
        ? "<tr>" + td(plantName(d.plant.name)) + td(d.plant.code ? "CG-" + d.plant.code : "") + td(d.plant.address) +
          td(d.plant.city) + td(d.plant.zip) + td(d.plant.lng) + td(d.plant.lat) + "</tr>"
        : "";
    }
    // Jobsite
    var jh = document.getElementById("d3-tm-jobsite");
    if (jh) {
      jh.innerHTML = d.jobsite
        ? "<tr>" + td("JOBSITE") + td(d.jobsite.address) +
          td(d.jobsite.lat) + td("") + td(d.jobsite.lng) + td("") + "</tr>"
        : "";
    }
  }

  // Truck marker colour by status — matches the legend / D3's marker colours.
  function statusColor(s) {
    s = String(s || "").toLowerCase();
    if (s.indexOf("loading") >= 0 || s.indexOf("loaded") >= 0 || s.indexOf("ticketed") >= 0) return "#8dd35f";
    if (s.indexOf("to job") >= 0) return "#2e7d0e";
    if (s.indexOf("at job") >= 0) return "#33bbee";
    if (s.indexOf("pour") >= 0) return "#2f7ed8";
    if (s.indexOf("wash") >= 0) return "#a98b5a";
    if (s.indexOf("return") >= 0 || s.indexOf("plant") >= 0) return "#f15bb5";
    return "#666";
  }
  // Approximate a truck's position from its status (we have no live GPS): loading→plant,
  // at-job/pouring/washing→jobsite, to-job/returning→midway. A small per-index offset
  // keeps several trucks at the same anchor from stacking into one pin.
  function truckPos(status, job, plant, i) {
    var s = String(status || "").toLowerCase();
    var j = (i % 6) * 0.006 - 0.015, k = (Math.floor(i / 6) % 6) * 0.006 - 0.015;
    var at = /pour|at job|washing|at plant/.test(s) ? job
      : /loading|loaded|ticketed/.test(s) ? plant
      : { lat: (job.lat + plant.lat) / 2, lng: (job.lng + plant.lng) / 2 }; // to-job / returning
    return [at.lat + j, at.lng + k];
  }
  function truckIcon(color, num) {
    // D3's truck marker (62x59): a WHITE rounded card holding the cement-mixer glyph tinted
    // with the truck's status colour, the truck number in dark text below it, and a small
    // downward tail. The glyph is coloured by masking D3's truck.png with the status colour.
    var glyph =
      '<div style="width:30px;height:26px;margin:0 auto;background-color:' + color + ';' +
      '-webkit-mask:url(/d3-static/Order_files/truck.png) center/contain no-repeat;' +
      'mask:url(/d3-static/Order_files/truck.png) center/contain no-repeat"></div>';
    return L.divIcon({
      className: "",
      html:
        '<div style="position:relative;width:62px;text-align:center;white-space:nowrap">' +
          '<div style="display:inline-block;background:#fff;border:2px solid ' + color + ';' +
          'border-radius:8px;padding:4px 7px 3px;box-shadow:0 1px 2px rgba(0,0,0,.45)">' + glyph +
            '<div style="color:#222;font-size:11px;font-weight:bold;line-height:13px;margin-top:1px">' + esc(num) + "</div>" +
          "</div>" +
          '<span style="position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);width:0;height:0;' +
          'border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ' + color + '"></span>' +
        "</div>",
      iconSize: [62, 59], iconAnchor: [31, 59],
    });
  }
  // D3-style badge for the plant / jobsite (58x45): a white rounded card (with a downward
  // tail) holding a navy glyph. Replaces Leaflet's default teardrop pins.
  function badgeIcon(inner) {
    return L.divIcon({
      className: "",
      html:
        '<div style="position:relative;width:58px;text-align:center">' +
          '<div style="display:inline-block;background:#fff;border:1px solid rgba(0,0,0,.35);' +
          'border-radius:8px;padding:7px 9px;box-shadow:0 1px 3px rgba(0,0,0,.45);line-height:0">' + inner + "</div>" +
          '<span style="position:absolute;left:50%;bottom:-7px;transform:translateX(-50%);width:0;height:0;' +
          'border-left:7px solid transparent;border-right:7px solid transparent;border-top:8px solid #fff"></span>' +
        "</div>",
      iconSize: [58, 45], iconAnchor: [29, 45],
    });
  }
  // Jobsite = navy location pin; Plant = navy factory/building — both in a D3 white badge.
  var JOBSITE_SVG = '<svg width="26" height="28" viewBox="0 0 24 24" fill="#1b4e8a"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';
  var PLANT_SVG = '<svg width="28" height="26" viewBox="0 0 24 24" fill="#1b4e8a"><path d="M2 21V9l6 3V9l6 3V4h2l1 4h3l1 13H2zm5-3h3v-3H7v3zm7 0h3v-3h-3v3z"/></svg>';

  function renderMap(d) {
    var el = document.getElementById("map");
    var note = document.getElementById("map-note");
    if (!el) return;
    if (!window.L) {
      el.style.display = "none";
      var lg = document.getElementById("legend"); if (lg) lg.style.display = "none";
      if (note) note.innerHTML = "Map library did not load. Truck, plant and jobsite data are in the tables below.";
      return;
    }
    if (!mapInited) {
      // Prefer Mapbox (our own token, injected server-side); fall back to keyless
      // OSM + Esri satellite when no token is configured.
      var MB = window.MAPBOX_TOKEN;
      var street, sat;
      if (MB) {
        var mb = function (style) {
          return L.tileLayer(
            "https://api.mapbox.com/styles/v1/mapbox/" + style + "/tiles/512/{z}/{x}/{y}@2x?access_token=" + MB,
            { tileSize: 512, zoomOffset: -1, maxZoom: 19, attribution: "&copy; Mapbox &copy; OpenStreetMap" }
          );
        };
        street = mb("streets-v12");
        sat = mb("satellite-streets-v12");
      } else {
        street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19, attribution: "&copy; OpenStreetMap contributors",
        });
        sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
          maxZoom: 19, attribution: "Tiles &copy; Esri",
        });
      }
      map = L.map("map", { layers: [street] });
      L.control.layers({ Map: street, Satellite: sat }, null, { position: "topleft" }).addTo(map);
      // Fullscreen button (uses the browser Fullscreen API — no plugin needed).
      var fs = L.control({ position: "topright" });
      fs.onAdd = function () {
        var b = L.DomUtil.create("div", "leaflet-bar");
        b.innerHTML = '<a href="#" title="Toggle fullscreen" style="font-weight:bold;text-align:center">&#9974;</a>';
        L.DomEvent.on(b, "click", function (e) {
          L.DomEvent.stop(e);
          if (!document.fullscreenElement) { if (el.requestFullscreen) el.requestFullscreen(); }
          else if (document.exitFullscreen) document.exitFullscreen();
          setTimeout(function () { map.invalidateSize(); }, 300);
        });
        return b;
      };
      fs.addTo(map);
      mapInited = true;
    }
    // clear old markers
    map.eachLayer(function (l) { if (l instanceof L.Marker) map.removeLayer(l); });
    var pts = [];
    if (d.jobsite) {
      // D3's JOB SITE InfoWindow: title, Project name, then the delivery address.
      var jobPop = "<div style='font-size:12px;line-height:18px'><b>JOB SITE</b>" +
        (d.project_name ? "<br>Project: " + esc(d.project_name) : "") +
        (d.jobsite.address ? "<br>Delivery Address: " + esc(d.jobsite.address) : "") +
        "</div>";
      L.marker([d.jobsite.lat, d.jobsite.lng], { icon: badgeIcon(JOBSITE_SVG) }).addTo(map).bindPopup(jobPop);
      pts.push([d.jobsite.lat, d.jobsite.lng]);
    }
    if (d.plant) {
      L.marker([d.plant.lat, d.plant.lng], { icon: badgeIcon(PLANT_SVG) }).addTo(map).bindPopup("<b>PLANT " + esc(d.plant.code ? "CG-" + d.plant.code : "") + "</b><br>" + esc(d.plant.name || ""));
      pts.push([d.plant.lat, d.plant.lng]);
    }
    // Truck markers at their LIVE GPS (from the trucks table). Fall back to a status-based
    // approximation only for a truck that has no GPS fix.
    if (d.jobsite && d.plant) {
      (d.trucks || []).forEach(function (t, i) {
        var p = (t.lat != null && t.lng != null) ? [t.lat, t.lng] : truckPos(t.status, d.jobsite, d.plant, i);
        pts.push(p);
        // D3's InfoWindow content, field-for-field.
        var pop = "<div style='font-size:12px;line-height:20px'>" +
          "Truck No: " + esc(t.truck_code || "") + "<br>" +
          "Driver No: " + esc(t.driver_code || "") + "<br>" +
          "Order No: " + esc(t.order_code || "") + "<br>" +
          "Ticket No: " + esc(t.ticket_code || "") + "<br>" +
          "Product: " + esc(t.product || "") + "<br>" +
          "Load Number: " + esc(t.load_number) + "<br>" +
          "Volume: " + cy(t.volume_cy) + " CY<br>" +
          "Shipped: " + cy(t.shipped_cy) + " OF " + cy(d.ordered_cy) + " CY<br>" +
          "Status: " + esc(t.status) +
          "</div>";
        L.marker(p, { icon: truckIcon(statusColor(t.status), t.truck_code || "") }).addTo(map)
          .bindPopup(pop, { minWidth: 190 });
      });
    }
    if (pts.length) map.fitBounds(pts, { padding: [50, 50], maxZoom: 12 });
    else map.setView([35.68, -97.42], 10);
    setTimeout(function () { map.invalidateSize(); }, 100);
    if (note) { note.innerHTML = ""; note.style.display = "none"; }
  }

  function render(d) {
    var title = document.getElementById("d3-tm-title");
    if (title) title.textContent = "ORDER " + (d.order_code || "") + "-" + mdShort(d.order_date);
    var sub = document.getElementById("d3-tm-subtitle");
    if (sub) sub.textContent = String(d.subtitle || "").toUpperCase();
    renderMap(d);
    renderTables(d);
  }

  function fetchMap() {
    if (!ID) return;
    fetch("/api/truck-map?id=" + encodeURIComponent(ID), { cache: "no-store" })
      .then(function (x) { return x.ok ? x.json() : null; })
      .then(function (d) { if (d && !d.error) render(d); })
      .catch(function () {});
  }

  if (document.readyState !== "loading") fetchMap();
  else document.addEventListener("DOMContentLoaded", fetchMap);
  setInterval(fetchMap, 60000);
})();
