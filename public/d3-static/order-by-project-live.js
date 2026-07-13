/*
 * Live client for the D3 "Order By Project" shell
 * (public/d3-static/order-by-project.html). Replaces D3's server postback
 * (onSubmit_orderbyproject) with a client-side search: the SEARCH button / Enter
 * key queries /api/customer-search?q=... and renders D3's exact result set —
 *   • one BLUE "NEW ORDER / W/O PROJECT" tile per matched customer, then
 *   • one GREEN tile per existing project of that customer
 *     (project name, "Recent Orders N", "Project <code> Customer <code>").
 * The lower filter box behaves like D3's listFilter() over the rendered tiles.
 *
 * Data source: projects table (name/code/customer) + orders table (recent_orders,
 * counted over a rolling 90-day window) + user_projects (restricted flag), resolved by
 * searchOrderProjects(). A blank SEARCH returns the whole book (D3's wildcard). Clicking
 * a tile opens the order form (/order-request/form?customer=|?project=). Note: the
 * restricted/unrestricted glyph is a tenant-wide binary (project has assigned users vs
 * not) — the app's single shared login can't express a true per-user restriction.
 */
(function () {
  var TILES_ID = "e6ab4f38-78b8-450f-bc34-66b84db20f0a-tiles";
  var FILTER_ID = "e6ab4f38-78b8-450f-bc34-66b84db20f0a-search";

  // D3 tile colours (match order-request board palette).
  var BLUE = "rgb(47, 126, 216)";
  var GREEN = "rgb(69, 139, 0)";

  // Real D3 tile glyphs (copied from the OrderByProject export):
  //  • no-project:  fill_form64orderwoproject.png  (blue "new order, no project")
  //  • restricted:   fill_form64-restricted.png     (green project, access-scoped)
  //  • unrestricted: fill_form64-unrestricted.png   (green project, open)
  var ICON_BASE = "/d3-static/OrderByProject_files/";
  var ICON_NOPROJECT = ICON_BASE + "fill_form64orderwoproject.png";
  var ICON_RESTRICTED = ICON_BASE + "fill_form64-restricted.png";
  var ICON_UNRESTRICTED = ICON_BASE + "fill_form64-unrestricted.png";

  // Where a clicked tile lands — the order form prefills from these query params.
  var FORM_URL = "/order-request/form";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function up(s) { return esc(String(s == null ? "" : s).toUpperCase()); }

  function tile(bg, icon, superTitle, title, subLines, href) {
    var subs = (subLines || []).map(function (s) {
      return '<div class="tileSubTitle">' + esc(s) + "</div>";
    }).join("");
    var nav = href
      ? ' cursor: pointer;" onclick="window.location.href=&quot;' + esc(href) + '&quot;'
      : ' cursor: default;';
    return (
      '<div class="tile" style="position: relative; background-color: ' + bg + ';' + nav + '">' +
      '<img src="' + ICON_BASE + 'dogear.png" style="position: absolute; right: 0px; bottom: 0px; display: block;">' +
      '<div class="tileContainer"><div class="tileIcon"><img src="' + icon + '"></div>' +
      '<div class="tileInfoSection"><div class="tileCell">' +
      '<div class="tileSuperTitle">' + superTitle + "</div>" +
      '<div class="tileTitle">' + title + "</div>" +
      subs +
      "</div></div></div></div>"
    );
  }

  // Blue "new order, no project" tile — one per matched customer → order form for the customer.
  // D3 puts the whole "NEW ORDER / W/O PROJECT" in the (big, bold) tileTitle across two
  // lines via <br>, with an empty subtitle — not a small subtitle line.
  function noProjectTile(c) {
    var href = c.id != null ? FORM_URL + "?customer=" + encodeURIComponent(c.id) : null;
    return tile(BLUE, ICON_NOPROJECT, up(c.name), "NEW ORDER <br> W/O PROJECT", [], href);
  }
  // Green project tile — one per existing project → order form for that project. The
  // glyph is restricted vs unrestricted per the project's access flag.
  function projectTile(p) {
    var line2 = "Project " + (p.project_code == null ? "" : p.project_code) +
      " Customer " + (p.customer_code == null ? "" : p.customer_code);
    var icon = p.restricted ? ICON_RESTRICTED : ICON_UNRESTRICTED;
    var href = p.project_id != null ? FORM_URL + "?project=" + encodeURIComponent(p.project_id) : null;
    return tile(
      GREEN, icon, up(p.customer_name), up(p.project_name),
      ["Recent Orders " + Number(p.recent_orders || 0), line2], href
    );
  }

  function tilesBox() { return document.getElementById(TILES_ID); }

  function render(data) {
    var box = tilesBox();
    if (!box) return;
    var customers = (data && data.customers) || [];
    var projects = (data && data.projects) || [];
    if (!customers.length && !projects.length) {
      box.innerHTML = '<div style="padding: 8px 2px; color: #666; font-size: 13px">No customers found.</div>';
      return;
    }
    // Group projects under their customer by customer_code (D3 lists each customer's
    // blue "no project" tile first, then that customer's green project tiles).
    var byCode = {};
    projects.forEach(function (p) {
      var k = String(p.customer_code == null ? "" : p.customer_code);
      (byCode[k] = byCode[k] || []).push(p);
    });
    var used = {};
    var html = "";
    customers.forEach(function (c) {
      html += noProjectTile(c);
      var k = String(c.code == null ? "" : c.code);
      (byCode[k] || []).forEach(function (p) { html += projectTile(p); });
      used[k] = true;
    });
    // Any projects whose customer wasn't in the customer list (defensive): append.
    Object.keys(byCode).forEach(function (k) {
      if (!used[k]) byCode[k].forEach(function (p) { html += projectTile(p); });
    });
    box.innerHTML = html;
    applyFilter();
  }

  // ---- Results filter box (mirrors D3's listFilter over the rendered tiles) ----
  function applyFilter() {
    var box = tilesBox();
    var input = document.getElementById(FILTER_ID);
    if (!box) return;
    var filter = ((input && input.value) || "").toUpperCase();
    var tiles = box.querySelectorAll(".tile");
    for (var i = 0; i < tiles.length; i++) {
      var txt = (tiles[i].textContent || tiles[i].innerText || "").toUpperCase();
      tiles[i].style.display = !filter || txt.indexOf(filter) >= 0 ? "block" : "none";
    }
  }

  var lastQuery = null;
  function doSearch() {
    var input = document.getElementById("searchtext");
    var q = input ? (input.value || "").trim() : "";
    var btn = document.getElementById("submit-button");
    // A blank SEARCH returns the whole book (mirrors D3's wildcard). No early return.
    lastQuery = q;
    if (btn) btn.disabled = true;
    fetch("/api/customer-search?q=" + encodeURIComponent(q), { cache: "no-store" })
      .then(function (x) { return x.ok ? x.json() : null; })
      .then(function (d) {
        if (q !== lastQuery) return; // a newer search superseded this one
        render(d || null);
      })
      .catch(function () { render(null); })
      .then(function () { if (btn) btn.disabled = false; });
  }

  function init() {
    var btn = document.getElementById("submit-button");
    if (btn) btn.addEventListener("click", function () { doSearch(); });

    var input = document.getElementById("searchtext");
    if (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.keyCode === 13) { e.preventDefault(); doSearch(); }
      });
    }

    var filter = document.getElementById(FILTER_ID);
    if (filter) {
      filter.addEventListener("input", applyFilter);
      filter.addEventListener("keyup", applyFilter);
    }
  }
  window.d3obpSearch = doSearch;

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
