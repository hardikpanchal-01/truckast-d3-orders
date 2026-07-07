/*
 * Live client for the D3 "Delay Details" shell (ticket-status-details.html).
 * Reads the order id from /orders/{id}/delays, fetches /api/order-detail, and renders
 * the full per-load delay table (D3's TicketStatusDetails columns) from delay_loads.
 */
(function () {
  var parts = location.pathname.split("/").filter(Boolean); // ["orders","{id}","delays"]
  var oi = parts.indexOf("orders");
  var ID = oi >= 0 && parts[oi + 1] ? parts[oi + 1] : "";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function mdShort(s) {
    if (!s) return "";
    var p = String(s).slice(0, 10).split("-");
    return p.length === 3 ? Number(p[1]) + "/" + Number(p[2]) : "";
  }

  // Contractor Delay cell: red when positive (over allotment), green when ≤ 0 — like D3.
  function signed(v) {
    var color = Number(v) > 0 ? "red" : "green";
    return '<font color="' + color + '">' + esc(v) + "</font>";
  }

  function tableHtml(loads) {
    var head =
      "<thead><tr role=\"row\">" +
      "<th>Load Order</th><th>Ticket</th><th>Truck</th><th>Planned On Job</th><th>Actual On Job</th>" +
      "<th>Producer Delay</th><th>Begin Pour</th><th>End Pour</th><th>Scheduled End Pour</th>" +
      "<th>Spacing</th><th>Waiting To Pour</th><th>Pour Min Over</th><th>Contractor Delay</th><th>Plus Load</th>" +
      "</tr></thead>";
    var body = (loads || []).map(function (l) {
      var ticketCell = l.ticket_id
        ? '<a href="/orders/' + esc(ID) + "/tickets/" + esc(l.ticket_id) + '">' + esc(l.ticket) + "</a>"
        : esc(l.ticket);
      return "<tr class=\"gradeA\">" +
        '<td style="border-top:0">' + esc(l.order) + "</td>" +
        '<td style="border-top:0">' + ticketCell + "</td>" +
        '<td style="border-top:0">' + esc(l.truck) + "</td>" +
        '<td style="border-top:0">' + esc(l.planned_on_job) + "</td>" +
        '<td style="border-top:0">' + esc(l.actual_on_job) + "</td>" +
        '<td style="border-top:0">' + esc(l.prod_delay) + "</td>" +
        '<td style="border-top:0">' + esc(l.begin_pour) + "</td>" +
        '<td style="border-top:0">' + esc(l.end_pour) + "</td>" +
        '<td style="border-top:0">' + esc(l.scheduled_end_pour) + "</td>" +
        '<td style="border-top:0">' + esc(l.spacing) + "</td>" +
        '<td style="border-top:0">' + esc(l.wait_to_pour) + "</td>" +
        '<td style="border-top:0">' + esc(l.pour_min_over) + "</td>" +
        '<td style="border-top:0">' + signed(l.contractor_delay) + "</td>" +
        '<td style="border-top:0">' + esc(l.plus_load || "") + "</td>" +
        "</tr>";
    }).join("");
    // Plain table (id'd) — the D3 dataTables plugin, loaded in the bundle, wraps it with
    // the sortable headers + right-aligned Search box below.
    return '<table id="dd-table" cellpadding="0" cellspacing="0" border="0" class="table table-striped" style="width:100%">' +
      head + "<tbody>" + body + "</tbody></table>";
  }

  function render(d) {
    var sub = document.getElementById("d3-dd-subtitle");
    if (sub) sub.textContent = "ORDER " + d.order_code + "-" + mdShort(d.order_date);
    var host = document.getElementById("d3-delay-detail");
    if (!host) return;
    host.innerHTML = tableHtml(d.delay_loads);
    // Initialise D3's dataTable exactly as its TicketStatusDetails page does: no
    // paging, a Search filter, sortable columns — the sDom lays out search top-right.
    if (window.jQuery && window.jQuery.fn && window.jQuery.fn.dataTable) {
      try {
        window.jQuery("#dd-table").dataTable({
          sDom: "<'row'<'span6'l><'span6'f>r>t<'row'<'span6'><'span6'p>>",
          sPaginationType: "bootstrap",
          bPaginate: false,
          bFilter: true,
          bSort: true,
          oLanguage: { sLengthMenu: "_MENU_ records per page" },
        });
      } catch (e) {
        /* if dataTables isn't available, the plain striped table still renders */
      }
    }
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
})();
