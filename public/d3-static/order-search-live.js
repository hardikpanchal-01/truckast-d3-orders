/*
 * Client for the D3 "OrderSearch" replica (public/d3-static/order-search.html).
 * Seeds the two Kendo datepickers (start defaults to the ?date= the user came from,
 * else today; end defaults to the same day) and wires the SEARCH button to navigate to
 * OUR orders list — /orders?date=START&dateTo=END — instead of D3's form POST.
 */
(function () {
  function pad(n) { return String(n).padStart(2, "0"); }
  function mdy(d) { return pad(d.getMonth() + 1) + "/" + pad(d.getDate()) + "/" + d.getFullYear(); }
  function isoOf(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function fromISO(s) { var p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fromMdy(s) {
    var m = String(s || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? new Date(+m[3], +m[1] - 1, +m[2]) : null;
  }

  // Start date defaults to the day the user was viewing (?date=), else today.
  var q = new URLSearchParams(location.search);
  var startParam = q.get("date");
  var start = startParam ? fromISO(startParam) : new Date();

  function init() {
    // d3_complete_nohc.js bundles jQuery + Kendo; wait for them before wiring the pickers.
    if (!window.jQuery || !window.jQuery.fn || !window.jQuery.fn.kendoDatePicker) {
      setTimeout(init, 30);
      return;
    }
    var $ = window.jQuery;
    // Seed the input values BEFORE Kendo initialises so each widget adopts the date.
    $("#startdate-input").val(mdy(start));
    $("#enddate-input").val(mdy(start));
    $("#startdate-input").kendoDatePicker();
    $("#enddate-input").kendoDatePicker();
    if (typeof hideLoadingIndicator === "function") { try { hideLoadingIndicator(); } catch (e) {} }
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);

  // SEARCH → our orders list for the chosen range.
  window.doOrderSearch = function () {
    var sEl = document.getElementById("startdate-input");
    var eEl = document.getElementById("enddate-input");
    var sd = fromMdy(sEl && sEl.value);
    if (!sd) { alert("Please pick a valid start date."); return; }
    var ed = fromMdy(eEl && eEl.value) || sd;
    if (ed < sd) ed = sd; // end before start → clamp to start
    // D3 returns a MAXIMUM of 30 days from the start date — clamp the window to match.
    var maxEnd = new Date(sd);
    maxEnd.setDate(sd.getDate() + 30);
    if (ed > maxEnd) ed = maxEnd;
    var url = "/orders?date=" + encodeURIComponent(isoOf(sd)) + "&dateTo=" + encodeURIComponent(isoOf(ed));
    (window.top || window).location.href = url;
  };
})();
