/*
 * Live client for the D3 "Market Summary" shell (public/d3-static/market.html).
 * Renders the DOLESE business-unit summary tile (used-of-total CY + order counts +
 * Highcharts used/remaining pie) from /api/market-summary, plus the fuel-surcharge
 * promo, and wires the date dropdown — the D3 landing page, driven by our DB.
 */
(function () {
  var q = new URLSearchParams(location.search);
  var D = q.get("date");
  var ASSET = "/d3-static/MarketSummary_files";
  var GREEN = "rgb(69, 139, 0)";
  // D3's default pie colours (Highcharts.setOptions): used = blue, remaining = dark.
  var PIE_USED = "#7cb5ec";
  var PIE_REMAIN = "#434348";

  function iso(dt) {
    return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
  }
  if (!D) D = iso(new Date());
  var DT = q.get("dateTo"); // optional range end (for LAST 7/30 DAYS, month ranges, FUTURE)
  var BASE = location.pathname;

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  // Comma-grouped to 2 decimals, e.g. 3748.75 -> "3,748.75".
  function comma(n) {
    return (Math.round(Number(n || 0) * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ---- Date dropdown: D3's exact named ranges. Each option value is "start" or
  //      "start|end" (a range); the change handler navigates to ?date=&dateTo=. ----
  var MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  function mdy(dt) {
    return String(dt.getMonth() + 1).padStart(2, "0") + "/" + String(dt.getDate()).padStart(2, "0") + "/" + dt.getFullYear();
  }
  function dateOptions() {
    var t = new Date(iso(new Date()) + "T00:00:00"); // local midnight today
    function add(n) { var d = new Date(t); d.setDate(d.getDate() + n); return d; }
    var eom = new Date(t.getFullYear(), t.getMonth() + 1, 0); // last day of this month
    var o = [];
    o.push(["TODAY - " + mdy(t), iso(t)]);
    o.push(["TOMORROW - " + mdy(add(1)), iso(add(1))]);
    o.push(["YESTERDAY", iso(add(-1))]);
    o.push([mdy(add(2)), iso(add(2))]);
    o.push([mdy(add(3)), iso(add(3))]);
    o.push([mdy(add(4)), iso(add(4))]);
    o.push([mdy(add(5)), iso(add(5))]);
    o.push([mdy(add(6)), iso(add(6))]);
    o.push([mdy(add(1)) + " - " + mdy(eom), iso(add(1)) + "|" + iso(eom)]); // tomorrow → end of month
    o.push(["LAST 7 DAYS", iso(add(-6)) + "|" + iso(t)]);
    o.push(["LAST 30 DAYS", iso(add(-29)) + "|" + iso(t)]);
    for (var m = 1; m <= 3; m++) { // next 3 whole months
      var first = new Date(t.getFullYear(), t.getMonth() + m, 1);
      var last = new Date(t.getFullYear(), t.getMonth() + m + 1, 0);
      o.push([MONTHS[first.getMonth()] + " " + first.getFullYear(), iso(first) + "|" + iso(last)]);
    }
    o.push(["FUTURE", iso(add(1)) + "|2099-12-31"]);
    o.push(["SEARCH", "SEARCH"]);
    return o;
  }
  function wireDates() {
    var sel = document.getElementById("daterangeurl");
    if (!sel) return;
    var list = dateOptions();
    var html = "";
    for (var i = 0; i < list.length; i++) html += '<option value="' + list[i][1] + '">' + esc(list[i][0]) + "</option>";
    sel.innerHTML = html;
    // Reflect the current selection (single date or start|end range).
    var cur = DT ? D + "|" + DT : D;
    sel.value = cur;
    if (sel.selectedIndex < 0) sel.value = D; // fall back to the plain date
    sel.onchange = function () {
      var v = this.value;
      if (v === "SEARCH") { this.value = cur; return; } // no OrderSearch page yet
      var parts = v.split("|");
      var url = BASE + "?date=" + encodeURIComponent(parts[0]);
      if (parts[1]) url += "&dateTo=" + encodeURIComponent(parts[1]);
      window.top.location.href = url;
    };
  }

  // ---- Announcement tiles (dynamic from API) ----
  var colorMap = {
    'red': '#FF0000', 'green': '#00FF00', 'blue': '#2F7ED8', 'yellow': '#FFFF00',
    'orange': '#FFA500', 'purple': '#800080', 'black': '#000000', 'white': '#FFFFFF',
    'gray': '#808080', 'grey': '#808080'
  };

  function getColor(color) {
    if (!color) return 'red';
    var c = color.toLowerCase();
    return colorMap[c] || color;
  }

  // Detect if current tenant is Concrete Supply (check cookie or page content)
  function isConcreteSupply() {
    // Check from page title or document
    var titleEl = document.querySelector('#titlebar-caption strong');
    if (titleEl && titleEl.textContent.toLowerCase().includes('market')) return true;
    if (titleEl && titleEl.textContent.toLowerCase().includes('concrete')) return true;
    // Also check for cookie
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
      var c = cookies[i].trim();
      if (c.indexOf('selected_tenant=') === 0) {
        var tenant = decodeURIComponent(c.substring(16));
        if (tenant.toLowerCase().includes('concrete')) return true;
      }
    }
    return false;
  }

  function announcementTile(a) {
    var bgColor = getColor(a.color);
    // Use Concrete Supply logo if tenant is Concrete Supply, otherwise Dolese logo
    var defaultIcon = isConcreteSupply() ? '/Images/concretesupplyco-tile-nb.png' : (ASSET + '/dolesepublish.png');
    var icon = a.icon_or_percent || defaultIcon;
    var tagline = esc(a.tagline || '');
    var title = esc(a.title || a.name || '');
    var subtitle = esc(a.subtitle || '');

    return (
      '<div class="tile" style="position: relative; background-color: ' + bgColor + '; cursor: pointer; display: block;" ' +
      "onclick=\"window.top.location.href='/d3-static/announcements.html?id=" + a.id + "'\">" +
      '<img src="' + ASSET + '/dogear.png" style="position: absolute; right: 0px; bottom: 0px;">' +
      '<div class="tileContainer"><div class="tileIcon"><img src="' + esc(icon) + '"></div>' +
      '<div class="tileInfoSection"><div class="tileCell">' +
      '<div class="tileSuperTitle">' + tagline + '</div>' +
      '<div class="tileTitle">' + title + '</div>' +
      '<div class="tileSubTitle">' + subtitle + '</div>' +
      "</div></div></div></div>"
    );
  }

  var cachedAnnouncements = [];
  function loadAnnouncements(callback) {
    console.log('[Announcements] Fetching active announcements...');
    $.ajax({
      url: '/api/announcements/active',
      type: 'GET',
      success: function(response) {
        console.log('[Announcements] API Response:', response);
        if (response.success && response.data) {
          cachedAnnouncements = response.data;
          console.log('[Announcements] Found ' + cachedAnnouncements.length + ' active announcement(s):');
          cachedAnnouncements.forEach(function(a, i) {
            console.log('[Announcements] Tile ' + (i+1) + ':', {
              id: a.id,
              name: a.name,
              tagline: a.tagline,
              title: a.title,
              subtitle: a.subtitle,
              color: a.color,
              icon: a.icon_or_percent,
              start_date: a.start_date,
              end_date: a.end_date
            });
          });
        } else {
          console.log('[Announcements] No active announcements found');
        }
        if (callback) callback();
      },
      error: function(xhr, status, error) {
        console.error('[Announcements] Error fetching:', error);
        if (callback) callback();
      }
    });
  }

  function announcementTiles() {
    var html = '';
    for (var i = 0; i < cachedAnnouncements.length; i++) {
      html += announcementTile(cachedAnnouncements[i]);
    }
    return html;
  }

  // ---- DOLESE business-unit summary tile (pie mount + used-of-total + counts) ----
  function summaryTile(s) {
    var used = Number(s.usedCY || 0);
    var total = Number(s.totalCY || 0);
    var usedPct = total > 0 ? Math.max(0, Math.min(100, Math.round((used / total) * 100))) : 0;
    var name = (s.name || "DOLESE").toString().toUpperCase();
    return (
      '<div class="tile" style="position: relative; background-color: ' + GREEN + '; cursor: pointer; display: block;" ' +
      "onclick=\"window.top.location.href='/orders?date=" + encodeURIComponent(D) + "'\">" +
      '<img src="' + ASSET + '/dogear.png" style="position: absolute; right: 0px; bottom: 0px;">' +
      '<div class="tileContainer">' +
      '<div class="mkt-pie" data-pct="' + usedPct + '" style="width:72px; height:80px; margin-right:5px; float:left"></div>' +
      '<div class="tileInfoSection"><div class="tileCell">' +
      '<div class="tileSuperTitle">' + esc(name) + "</div>" +
      '<div class="tileTitle">' + comma(used) + " OF " + comma(total) + " CY</div>" +
      '<div class="tileSubTitle">Tot ' + (s.totalOrders || 0) + ", Act " + (s.activeOrders || 0) + ", Can " + (s.cancelledOrders || 0) + "</div>" +
      "</div></div></div></div>"
    );
  }

  // ---- Highcharts used/remaining pie (D3's tileInitPie config verbatim) ----
  function renderPies() {
    if (!window.Highcharts || !window.Highcharts.Chart) return;
    var mounts = document.querySelectorAll(".mkt-pie");
    for (var i = 0; i < mounts.length; i++) {
      var el = mounts[i];
      if (el.getAttribute("data-rendered")) continue;
      el.setAttribute("data-rendered", "1");
      var pct = parseFloat(el.getAttribute("data-pct")) || 0;
      if (pct < 0) pct = 0;
      if (pct > 100) pct = 100;
      var used = pct;
      var remain = 100 - pct;
      try {
        new Highcharts.Chart({
          chart: {
            renderTo: el,
            type: "pie",
            width: 72,
            height: 80,
            backgroundColor: "rgba(255, 255, 255, 0.01)",
            plotBackgroundColor: null,
            plotBorderWidth: null,
            plotShadow: false,
          },
          title: { text: "" },
          tooltip: { enabled: false },
          exporting: { enabled: false },
          legend: { enabled: false },
          credits: { enabled: false },
          colors: [PIE_USED, PIE_REMAIN],
          plotOptions: {
            pie: { allowPointSelect: false, size: 60, dataLabels: { enabled: false }, showInLegend: false },
          },
          series: [{ type: "pie", data: [["Used", used], ["Remaining", remain]] }],
        });
      } catch (e) {
        el.removeAttribute("data-rendered");
      }
    }
  }

  var lastHtml = null;
  function load() {
    var t = document.getElementById("tiles-tiles");
    if (!t) return;
    var qs = "date=" + encodeURIComponent(D) + (DT ? "&dateTo=" + encodeURIComponent(DT) : "");

    // Load announcements first, then market summary
    loadAnnouncements(function() {
      $.ajax({
        url: "/api/market-summary?" + qs,
        type: 'GET',
        success: function(s) {
          if (!s || s.error) return;
          var html = announcementTiles() + summaryTile(s);
          if (html === lastHtml) return;
          lastHtml = html;
          t.innerHTML = html;
          renderPies();
        }
      });
    });
  }
  function refresh() { lastHtml = null; load(); }
  window.d3Refresh = refresh;

  function init() {
    wireDates();
    load();
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
  setInterval(load, 30000);
})();
