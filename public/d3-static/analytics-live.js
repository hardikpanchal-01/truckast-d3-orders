// Analytics page live data loading via AJAX - D3 exact match
(function($) {
    'use strict';

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Create region tile HTML - D3 exact format with TRUCKAST logo
    function createRegionTile(region) {
        return '<div class="tile" style="position: relative; background-color: #458b00; cursor: default">' +
            '<img src="/Images/dogear.png" style="position: absolute; right: 0px; bottom: 0px; display: none;" />' +
            '<div class="tileContainer">' +
                '<div class="tileIcon"><img src="/Images/truckast_512.png" /></div>' +
                '<div class="tileInfoSection">' +
                    '<div class="tileCell">' +
                        '<div class="tileSuperTitle">PRODUCER : ' + region.producerCount + '</div>' +
                        '<div class="tileTitle">' + escapeHtml(region.name) + '</div>' +
                        '<div class="tileSubTitle">CONTRACTOR : ' + region.contractorCount + '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    }

    // Create contractor row HTML - D3 exact format with Y/N columns
    function createContractorRow(user, index) {
        var rowClass = index % 2 === 0 ? 'even gradeA' : 'odd gradeA';
        var permissions = user.permissions || {};
        var detailUrl = '/d3-static/analytics-individual.html?SUserID=' + user.id;

        return '<tr class="' + rowClass + '">' +
            '<td style="border-top:0"><a href="' + detailUrl + '">' + escapeHtml(user.fullName) + '</a></td>' +
            '<td style="border-top:0">' + escapeHtml(user.username) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(user.customer) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(user.account) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(user.region) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(user.lastAccess) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(user.invitedBy) + '</td>' +
            '<td style="border-top:0">' + (permissions.truckast ? 'Y' : 'N') + '</td>' +
            '<td style="border-top:0">' + (permissions.rollout ? 'Y' : 'N') + '</td>' +
            '<td style="border-top:0">' + (permissions.publish ? 'Y' : 'N') + '</td>' +
            '<td style="border-top:0">' + (permissions.projects ? 'Y' : 'N') + '</td>' +
            '<td style="border-top:0">' + (permissions.order ? 'Y' : 'N') + '</td>' +
            '<td style="border-top:0">' + (permissions.admin ? 'Y' : 'N') + '</td>' +
            '<td style="border-top:0">' + (permissions.analytics ? 'Y' : 'N') + '</td>' +
        '</tr>';
    }

    // Create producer row HTML - D3 exact format with Y/N columns
    function createProducerRow(user, index) {
        var rowClass = index % 2 === 0 ? 'even gradeA' : 'odd gradeA';
        var permissions = user.permissions || {};
        var detailUrl = '/d3-static/analytics-individual.html?SUserID=' + user.id;

        return '<tr class="' + rowClass + '">' +
            '<td style="border-top:0"><a href="' + detailUrl + '">' + escapeHtml(user.name) + '</a></td>' +
            '<td style="border-top:0">' + escapeHtml(user.username) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(user.truckastRole) + '</td>' +
            '<td style="border-top:0">' + escapeHtml(user.lastAccess) + '</td>' +
            '<td style="border-top:0">' + (permissions.truckast ? 'Y' : 'N') + '</td>' +
            '<td style="border-top:0">' + (permissions.publish ? 'Y' : 'N') + '</td>' +
            '<td style="border-top:0">' + (permissions.projects ? 'Y' : 'N') + '</td>' +
            '<td style="border-top:0">' + (permissions.order ? 'Y' : 'N') + '</td>' +
            '<td style="border-top:0">' + (permissions.admin ? 'Y' : 'N') + '</td>' +
        '</tr>';
    }

    // Initialize DataTables
    function initDataTables() {
        if ($.fn.dataTable) {
            $('#contractor-table').dataTable({
                "sDom": "<'row'<'span6'l><'span6'f>r>t<'row'<'span6'i><'span6'p>>",
                "sPaginationType": "bootstrap",
                "bPaginate": true,
                "bFilter": true,
                "bSort": false,
                "oLanguage": {
                    "sLengthMenu": "_MENU_ records per page"
                }
            });

            $('#producer-table').dataTable({
                "sDom": "<'row'<'span6'l><'span6'f>r>t<'row'<'span6'i><'span6'p>>",
                "sPaginationType": "bootstrap",
                "bPaginate": true,
                "bFilter": true,
                "bSort": false,
                "oLanguage": {
                    "sLengthMenu": "_MENU_ records per page"
                }
            });
        }
    }

    // Load analytics data
    function loadAnalyticsData() {
        showLoadingIndicator();

        // Load all data in parallel
        $.when(
            $.ajax({ url: '/api/analytics/stats', type: 'GET', dataType: 'json' }),
            $.ajax({ url: '/api/analytics/regions', type: 'GET', dataType: 'json' }),
            $.ajax({ url: '/api/analytics/contractors', type: 'GET', dataType: 'json' }),
            $.ajax({ url: '/api/analytics/producers', type: 'GET', dataType: 'json' })
        ).done(function(statsRes, regionsRes, contractorsRes, producersRes) {
            hideLoadingIndicator();

            // Stats
            var stats = statsRes[0];
            if (stats && stats.success && stats.data) {
                $('#stat-total-users').text(stats.data.totalUsers || 0);
                $('#stat-total-contractors').text(stats.data.totalContractors || 0);
                $('#stat-total-producers').text(stats.data.totalProducers || 0);
            }

            // Regions
            var regions = regionsRes[0];
            if (regions && regions.success && regions.data) {
                var regionsHtml = '';
                for (var i = 0; i < regions.data.length; i++) {
                    regionsHtml += createRegionTile(regions.data[i]);
                }
                $('#region-tiles').html(regionsHtml);
            }

            // Contractors
            var contractors = contractorsRes[0];
            if (contractors && contractors.success && contractors.data) {
                var contractorHtml = '';
                for (var i = 0; i < contractors.data.length; i++) {
                    contractorHtml += createContractorRow(contractors.data[i], i);
                }
                $('#contractor-tbody').html(contractorHtml);
            }

            // Producers
            var producers = producersRes[0];
            if (producers && producers.success && producers.data) {
                var producerHtml = '';
                for (var i = 0; i < producers.data.length; i++) {
                    producerHtml += createProducerRow(producers.data[i], i);
                }
                $('#producer-tbody').html(producerHtml);
            }

            // Initialize DataTables after data is loaded
            initDataTables();

        }).fail(function(xhr, status, error) {
            hideLoadingIndicator();
            displayError('Error', 'Failed to load analytics data: ' + error);
        });
    }

    // Excel download functions (placeholder)
    window.downloadContractorExcel = function() {
        alert('Excel download for contractor users coming soon.');
    };

    window.downloadProducerExcel = function() {
        alert('Excel download for producer users coming soon.');
    };

    // Initialize on document ready
    $(document).ready(function() {
        loadAnalyticsData();
    });

})(jQuery);
