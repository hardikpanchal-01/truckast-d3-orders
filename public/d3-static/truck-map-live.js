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

  function renderTables(d) {
    // Trucks
    var host = document.getElementById("d3-tm-trucks");
    if (host) {
      host.innerHTML = (d.trucks || []).map(function (t) {
        return "<tr>" + td(t.ticket_code) + td(t.truck_code) + td(t.driver_name) + td(t.status) +
          td(t.last_update) + td(t.load_number) + td(cy(t.volume_cy) + " CY") +
          td(cy(t.shipped_cy) + " OF " + cy(d.ordered_cy) + " CY") + td(t.plant_code ? "CG-" + t.plant_code : "") +
          "</tr>";
      }).join("");
    }
    // Plant
    var ph = document.getElementById("d3-tm-plant");
    if (ph) {
      ph.innerHTML = d.plant
        ? "<tr>" + td(d.plant.name) + td(d.plant.code ? "CG-" + d.plant.code : "") + td(d.plant.address) +
          td(d.plant.city) + td(d.plant.zip) + td(d.plant.lng) + td(d.plant.lat) + "</tr>"
        : "";
    }
    // Jobsite
    var jh = document.getElementById("d3-tm-jobsite");
    if (jh) {
      jh.innerHTML = d.jobsite
        ? "<tr>" + td("JOBSITE") + td(d.jobsite.address) + td(d.jobsite.lat) + td(d.jobsite.lng) + "</tr>"
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
    return L.divIcon({
      className: "",
      html: '<div style="background:' + color + ';border:2px solid #2b2b2b;border-radius:5px;' +
        'padding:1px 5px;color:#fff;font-size:10px;font-weight:bold;white-space:nowrap;' +
        'box-shadow:1px 1px 2px rgba(0,0,0,.45);text-align:center;line-height:14px">&#128667; ' + esc(num) + "</div>",
      iconSize: [46, 20], iconAnchor: [23, 20],
    });
  }

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
      var osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: "&copy; OpenStreetMap contributors",
      });
      var sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19, attribution: "Tiles &copy; Esri",
      });
      map = L.map("map", { layers: [osm] });
      L.control.layers({ Map: osm, Satellite: sat }, null, { position: "topleft" }).addTo(map);
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
      L.marker([d.jobsite.lat, d.jobsite.lng]).addTo(map).bindPopup("<b>JOB SITE</b><br>" + esc(d.jobsite.address || ""));
      pts.push([d.jobsite.lat, d.jobsite.lng]);
    }
    if (d.plant) {
      L.marker([d.plant.lat, d.plant.lng]).addTo(map).bindPopup("<b>PLANT " + esc(d.plant.code ? "CG-" + d.plant.code : "") + "</b><br>" + esc(d.plant.name || ""));
      pts.push([d.plant.lat, d.plant.lng]);
    }
    // Approximate truck markers (status-based; see truckPos). Only if we have both anchors.
    if (d.jobsite && d.plant) {
      (d.trucks || []).forEach(function (t, i) {
        var p = truckPos(t.status, d.jobsite, d.plant, i);
        L.marker(p, { icon: truckIcon(statusColor(t.status), t.truck_code || "") }).addTo(map)
          .bindPopup("<b>TRUCK " + esc(t.truck_code || "") + "</b><br>" + esc(t.status) +
            "<br>Load " + esc(t.load_number) + " &middot; " + esc((Math.round(t.shipped_cy * 100) / 100)) + " CY shipped");
      });
    }
    if (pts.length) map.fitBounds(pts, { padding: [50, 50], maxZoom: 12 });
    else map.setView([35.68, -97.42], 10);
    setTimeout(function () { map.invalidateSize(); }, 100);
    if (note) {
      note.innerHTML = "Truck pins are placed by <b>status</b> (loading&nbsp;=&nbsp;plant, at&nbsp;job/pouring&nbsp;=&nbsp;jobsite, " +
        "to&nbsp;job&nbsp;=&nbsp;midway) — our feed has no live truck GPS, so these are approximate, not each truck's real position. " +
        "Traffic and Street View are Google-Maps-only and are not available on this keyless map.";
    }
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
