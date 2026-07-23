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
  /* ------------------------------------------------------------------------
   * STATIC PLACEHOLDER PROJECT NAMES — Hercules only.
   *
   * These project rows do NOT exist in the Hercules database. Verified: customers
   * 844 / 1514 / 830 / 1255 have exactly two project rows between them ("435 Martin
   * Luther King Jr Boulevard" and "Various 2026", both under COD Pedro Landscaping).
   * The names below are copied from the live D3 board so this screen matches it
   * visually. They are display-only.
   *
   * Because there is no project id behind them, each tile still links to the REAL
   * customer (?customer=<id>) — clicking opens the order form for that customer
   * rather than a project that doesn't exist.
   *
   * DELETE THIS MAP once the projects table is synced; the code falls back to the
   * real data automatically for any customer not listed here.
   * --------------------------------------------------------------------- */
  // Each entry: tile label + the values the order form should prefill. `name` is the
  // natural-case project name and `address` the delivery street address, both taken from
  // the live form. Leave `address` empty where the live value isn't known — the field
  // then opens blank rather than showing a made-up address.
  var STATIC_PROJECTS = {
    "COD - PEDRO": [
      { label: "PEDROS HOUSE", name: "Pedros house", address: "1171 cleveland ave Lincoln park MI" },
      { label: "PEDROS HOUSE", name: "Pedros house", address: "1171 cleveland ave Lincoln park MI" },
    ],
    "COD PEDRO LOPEZ": [{ label: "7112 ARMY", name: "7112 Army", address: "" }],
    "PEDRO ALONSO - IAFRATE": [{ label: "PEDRO'S DRIVEWAY", name: "Pedro's Driveway", address: "" }],
  };

  function noProjectTile(c) {
    var href = c.id != null ? FORM_URL + "?customer=" + encodeURIComponent(c.id) : null;
    if (window.__MARKET_VIEW__) {
      var entries = STATIC_PROJECTS[String(c.name == null ? "" : c.name).toUpperCase()];
      if (entries && entries.length) {
        return entries.map(function (e) {
          // Carry the prefill values on the link — there is no project row to read them
          // from, so the form takes them from the query string instead.
          var h = href
            ? href + "&pname=" + encodeURIComponent(e.name) + "&paddr=" + encodeURIComponent(e.address || "")
            : null;
          return tile(BLUE, ICON_RESTRICTED, up(c.name), esc(e.label), ["Recent Orders 0"], h);
        }).join("");
      }
      // Not in the map and no real projects — keep the customer on the board.
      return tile(BLUE, ICON_RESTRICTED, up(c.name), "NEW ORDER <br> W/O PROJECT", ["Recent Orders 0"], href);
    }
    return tile(BLUE, ICON_NOPROJECT, up(c.name), "NEW ORDER <br> W/O PROJECT", [], href);
  }
  // Green project tile — one per existing project → order form for that project. The
  // glyph is restricted vs unrestricted per the project's access flag.
  function projectTile(p) {
    var line2 = "Project " + (p.project_code == null ? "" : p.project_code) +
      " Customer " + (p.customer_code == null ? "" : p.customer_code);
    var icon = p.restricted ? ICON_RESTRICTED : ICON_UNRESTRICTED;
    var href = p.project_id != null ? FORM_URL + "?project=" + encodeURIComponent(p.project_id) : null;
    // Hercules: BLUE tile with a single "Recent Orders N" subtitle — no green, and no
    // "Project <code> Customer <code>" line. Every other tenant keeps D3's green tile.
    if (window.__MARKET_VIEW__) {
      // Live uses the locked (restricted) glyph on every tile of this board.
      return tile(
        BLUE, ICON_RESTRICTED, up(p.customer_name), up(p.project_name),
        ["Recent Orders " + Number(p.recent_orders || 0)], href
      );
    }
    return tile(
      GREEN, icon, up(p.customer_name), up(p.project_name),
      ["Recent Orders " + Number(p.recent_orders || 0), line2], href
    );
  }

  function tilesBox() { return document.getElementById(TILES_ID); }

  // Hercules shows a red instruction between the SEARCH button and the filter box.
  // Colour pixel-sampled from the live board: pure #FF0000.
  var PROMPT_ID = "obp-select-project-prompt";
  function showPrompt() {
    if (!window.__MARKET_VIEW__) return;
    if (document.getElementById(PROMPT_ID)) return;
    var d = document.createElement("div");
    d.id = PROMPT_ID;
    // 18px: at 14px this measured 469px wide against live's 587px, with both panels'
    // headings at 232px (same zoom, so the gap was real). Cap heights were 10px vs 13px,
    // which puts live at ~18px.
    d.style.cssText = "color:#FF0000; font-weight:bold; font-size:18px; margin:22px 0 0 0;";
    d.textContent = "PLEASE SELECT A PROJECT FOR THE ORDER YOU WANT TO PLACE";
    // Insert AFTER the search table, not inside the button's <td>. Inside the cell, the
    // row's hover highlight wrapped the prompt too; live highlights only the button row.
    var btn = document.getElementById("submit-button");
    if (btn) {
      var table = btn.closest ? btn.closest("table") : null;
      if (table && table.parentNode) {
        table.parentNode.insertBefore(d, table.nextSibling);
        return;
      }
      if (btn.parentNode) {
        btn.parentNode.insertBefore(d, btn.nextSibling);
        return;
      }
    }
    var filter = document.getElementById(FILTER_ID);
    if (filter && filter.parentNode) filter.parentNode.insertBefore(d, filter);
  }

  function render(data) {
    var box = tilesBox();
    if (!box) return;
    var customers = (data && data.customers) || [];
    var projects = (data && data.projects) || [];
    showPrompt();
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
      var k = String(c.code == null ? "" : c.code);
      var mine = byCode[k] || [];
      // Hercules lists PROJECTS — the live board shows a project tile per customer and no
      // separate "new order" tile. But a customer with NO project rows would then vanish
      // from the board entirely, so it still gets one tile. Other tenants keep D3's
      // customer-then-projects grouping unchanged.
      if (!window.__MARKET_VIEW__ || !mine.length) html += noProjectTile(c);
      mine.forEach(function (p) { html += projectTile(p); });
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
