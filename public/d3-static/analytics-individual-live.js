// Analytics Individual User page live data loading via AJAX - D3 exact match
(function($) {
    'use strict';

    // Get URL parameter
    function getUrlParameter(name) {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
        var results = regex.exec(location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Format number
    function formatNumber(num) {
        if (num === null || num === undefined) return '';
        return Number(num).toLocaleString();
    }

    // Create orders viewed row
    function createOrderRow(order, index) {
        var rowClass = index % 2 === 0 ? 'even gradeA' : 'odd gradeA';
        return '<tr class="' + rowClass + '">' +
            '<td style="border-top:0">' + escapeHtml(order.scheduledDate) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(order.orderNumber) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(order.viewedCY) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(order.status) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(order.viewDate) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(order.otherViewers) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(order.project) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(order.contractorCompanies) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(order.businessUnit) + '</td>' +
        '</tr>';
    }

    // Create tickets viewed row
    function createTicketRow(ticket, index) {
        var rowClass = index % 2 === 0 ? 'even gradeA' : 'odd gradeA';
        return '<tr class="' + rowClass + '">' +
            '<td style="border-top:0">' + escapeHtml(ticket.scheduledDate) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(ticket.orderNumber) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(ticket.ticketNumber) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(ticket.viewedCY) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(ticket.status) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(ticket.viewDate) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(ticket.otherViewers) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(ticket.project) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(ticket.contractorCompanies) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(ticket.businessUnit) + '</td>' +
        '</tr>';
    }

    // Initialize area chart
    function initAreaChart(containerId, title, series) {
        Highcharts.setOptions({
            global: {
                useUTC: true,
                timezoneOffset: 0
            }
        });

        $('#' + containerId).highcharts({
            chart: {
                type: 'area',
                zoomType: 'x',
                spacingRight: 10,
                spacingLeft: 10,
                spacingTop: 10,
                spacingBottom: 10
            },
            colors: ['#434348', '#90ed7d', '#7cb5ec', '#f7a35c', '#8085e9', '#f15c80', '#e4d354', '#8085e8', '#8d4653', '#91e8e1'],
            title: {
                text: title
            },
            subtitle: {
                text: document.ontouchstart === undefined ? 'Click and drag in the plot area to zoom in' : 'Drag your finger over the plot to zoom in'
            },
            xAxis: {
                type: 'datetime',
                minRange: 345600000,
                title: {
                    text: null
                }
            },
            yAxis: {
                min: 0,
                title: {
                    text: ''
                }
            },
            tooltip: {
                shared: false
            },
            legend: {
                enabled: true
            },
            credits: {
                enabled: false
            },
            plotOptions: {
                spline: {
                    marker: {
                        enabled: true
                    }
                },
                area: {
                    lineWidth: 1,
                    marker: {
                        enabled: false
                    },
                    shadow: false,
                    states: {
                        hover: {
                            lineWidth: 1
                        }
                    },
                    threshold: null
                }
            },
            series: series
        });
    }

    // Initialize DataTables (only if not already initialized)
    function initDataTables() {
        if ($.fn.dataTable) {
            // Check if already initialized and destroy first
            if ($.fn.DataTable.isDataTable('#orders-viewed-table')) {
                $('#orders-viewed-table').DataTable().destroy();
            }
            $('#orders-viewed-table').dataTable({
                "sDom": "<'row'<'span6'l><'span6'f>r>t<'row'<'span6'i><'span6'p>>",
                "sPaginationType": "bootstrap",
                "bPaginate": true,
                "bFilter": true,
                "bSort": false,
                "oLanguage": {
                    "sLengthMenu": "_MENU_ records per page"
                }
            });

            if ($.fn.DataTable.isDataTable('#tickets-viewed-table')) {
                $('#tickets-viewed-table').DataTable().destroy();
            }
            $('#tickets-viewed-table').dataTable({
                "sDom": "<'row'<'span6'l><'span6'f>r>t<'row'<'span6'i><'span6'p>>",
                "sPaginationType": "bootstrap",
                "bPaginate": true,
                "bFilter": true,
                "bSort": false,
                "oLanguage": {
                    "sLengthMenu": "_MENU_ records per page"
                }
            });

            if ($.fn.DataTable.isDataTable('#screen-view-table')) {
                $('#screen-view-table').DataTable().destroy();
            }
            $('#screen-view-table').dataTable({
                "sDom": "<'row'<'span6'l><'span6'f>r>t<'row'<'span6'i><'span6'p>>",
                "sPaginationType": "bootstrap",
                "bPaginate": true,
                "bFilter": true,
                "bSort": true,
                "oLanguage": {
                    "sLengthMenu": "_MENU_ records per page"
                }
            });
        }
    }

    // Load user data
    function loadUserData() {
        var userId = getUrlParameter('SUserID');
        if (!userId) {
            displayError('Error', 'No user ID specified');
            return;
        }

        showLoadingIndicator();

        $.ajax({
            url: '/api/analytics/individual?userId=' + encodeURIComponent(userId),
            type: 'GET',
            dataType: 'json'
        }).done(function(response) {
            hideLoadingIndicator();

            if (!response.success) {
                displayError('Error', response.error || 'Failed to load user data');
                return;
            }

            var user = response.data;

            // Set page title
            $('#user-title').html('<strong>' + escapeHtml(user.name) + '</strong>');
            document.title = 'Analytics - ' + user.name;

            // Populate user info
            $('#user-name').text(user.name || '');
            $('#user-username').text(user.username || '');
            $('#user-email').text(user.email || '');
            $('#user-phone').text(user.phone || '');
            $('#user-region').text(user.region || '');
            $('#user-type').text(user.type || '');
            $('#user-company').text(user.company || '');

            // Permissions
            var perms = user.permissions || {};
            $('#perm-truckast').text(perms.truckast ? 'Y' : 'N');
            $('#perm-rollout').text(perms.rollout ? 'Y' : 'N');
            $('#perm-publish').text(perms.publish ? 'Y' : 'N');
            $('#perm-projects').text(perms.projects ? 'Y' : 'N');
            $('#perm-order').text(perms.order ? 'Y' : 'N');
            $('#perm-admin').text(perms.admin ? 'Y' : 'N');

            // Stats
            $('#user-viewed-orders').text(user.viewedOrders || 0);
            $('#user-viewed-order-volume').text(user.viewedOrderVolume || '');
            $('#user-viewed-tickets').text(user.viewedTickets || 0);
            $('#user-viewed-ticket-volume').text(user.viewedTicketVolume || '');
            $('#user-social-posts').text(user.socialPosts || 0);
            $('#user-social-comments').text(user.socialComments || 0);
            $('#user-picture-uploads').text(user.pictureUploads || 0);
            $('#user-order-requests').text(user.orderRequests || 0);
            $('#user-order-request-posts').text(user.orderRequestPosts || 0);
            $('#user-invited-by').text(user.invitedBy || '');
            $('#user-invite-date').text(user.inviteDate || '');
            $('#user-last-access').text(user.lastAccess || '');
            $('#user-access-range').text(user.accessRange || '');
            $('#user-last-order-date').text(user.lastOrderDate || '');

            // Screen view title
            $('#screen-view-title').text((user.type || 'PRODUCER').toUpperCase() + ' SCREEN VIEW');

            // Orders viewed table
            if (user.ordersViewed && user.ordersViewed.length > 0) {
                var ordersHtml = '';
                for (var i = 0; i < user.ordersViewed.length; i++) {
                    ordersHtml += createOrderRow(user.ordersViewed[i], i);
                }
                $('#orders-viewed-tbody').html(ordersHtml);
            }

            // Tickets viewed table
            if (user.ticketsViewed && user.ticketsViewed.length > 0) {
                var ticketsHtml = '';
                for (var i = 0; i < user.ticketsViewed.length; i++) {
                    ticketsHtml += createTicketRow(user.ticketsViewed[i], i);
                }
                $('#tickets-viewed-tbody').html(ticketsHtml);
            }

            // Initialize DataTables
            initDataTables();

            // Initialize charts
            initAreaChart('personviewedvolume', 'Last 100 Orders Volume Viewed By Person', [
                {
                    type: 'area',
                    name: 'Ordered Volume By Contractor',
                    connectNulls: true,
                    data: user.ordersVolumeChart || []
                },
                {
                    type: 'area',
                    name: 'Viewed Volume By Person',
                    connectNulls: true,
                    data: user.viewedVolumeChart || []
                }
            ]);

            initAreaChart('viewedticketvolume', 'Last 100 Tickets Volume Viewed By Person', [
                {
                    type: 'area',
                    name: 'Ticketed volume by contractor',
                    connectNulls: true,
                    data: user.ticketVolumeChart || []
                },
                {
                    type: 'area',
                    name: 'Viewed Ticketed volume by person',
                    connectNulls: true,
                    data: user.viewedTicketVolumeChart || []
                }
            ]);

            initAreaChart('screenviewovertime', 'Screen View Over Time', user.screenViewChart || []);

        }).fail(function(xhr, status, error) {
            hideLoadingIndicator();
            displayError('Error', 'Failed to load user data: ' + error);
        });
    }

    // Excel download functions
    window.downloadOrdersExcel = function() {
        var userId = getUrlParameter('SUserID');
        alert('Excel download for orders viewed coming soon. User ID: ' + userId);
    };

    window.downloadTicketsExcel = function() {
        var userId = getUrlParameter('SUserID');
        alert('Excel download for tickets viewed coming soon. User ID: ' + userId);
    };

    // Refresh function
    window.d3Refresh = function() {
        loadUserData();
    };

    // Initialize on document ready
    $(document).ready(function() {
        loadUserData();
    });

})(jQuery);
