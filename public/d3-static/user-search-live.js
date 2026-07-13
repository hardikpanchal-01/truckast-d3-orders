/*
 * Live client for the D3 "User Search" shell (public/d3-static/user-search.html).
 * Searches users by name, email, or phone via /api/admin/users/search and renders
 * the results as D3-style tiles with status-based colors.
 *
 * Status Colors (matching D3 exactly):
 *   - Green #458b00: User has logged in (LOGGED IN ON) - Completed.png icon
 *   - Yellow #f7bb00: User signed up but hasn't logged in (SIGNED UP) - Paused.png icon
 *   - Red #c43926: User was invited but hasn't logged in (INVITED ON) - Scheduled.png icon
 *   - Red #c43926: User was deleted (DELETED BY) - Cancelled.png icon
 */
(function () {
  var ASSET = "/d3-static/JobsForFixedNodeID_files";

  // Status configuration matching D3 exactly
  var STATUS_CONFIG = {
    logged_in: {
      color: "#458b00",      // Green
      icon: "Completed.png", // Checkmark
      label: "LOGGED IN ON"
    },
    signed_up: {
      color: "#f7bb00",      // Yellow
      icon: "Paused.png",    // Pause icon
      label: "SIGNED UP"
    },
    invited: {
      color: "#c43926",      // Red
      icon: "Scheduled.png", // Calendar icon
      label: "INVITED ON"
    },
    deleted: {
      color: "#c43926",      // Red
      icon: "Cancelled.png", // X icon
      label: "DELETED BY"
    }
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Tile click handler
  window.tileInvoke = function (url) {
    window.location.href = url;
  };

  // Create a tile for a user result with status colors
  function createUserTile(user) {
    var status = user.status || "invited";
    var config = STATUS_CONFIG[status] || STATUS_CONFIG.invited;

    var bgColor = config.color;
    var iconSrc = ASSET + "/" + config.icon;
    var name = esc(user.name || "");
    var email = esc(user.email || "");
    var statusLabel = user.status_label || config.label;
    var statusDate = user.status_date || "";
    var topLine = statusLabel + (statusDate ? " " + statusDate : "");
    var href = "/admin/users/" + user.id;

    return (
      '<div class="tile" style="position: relative; background-color: ' + bgColor + '; cursor: pointer" onclick="tileInvoke(\'' + href + '\');">' +
        '<img src="' + ASSET + '/dogear.png" style="position: absolute; right: 0px; bottom: 0px; display: block;" />' +
        '<div class="tileContainer">' +
          '<div class="tileIcon"><img src="' + iconSrc + '" /></div>' +
          '<div class="tileInfoSection">' +
            '<div class="tileCell">' +
              '<div class="tileSuperTitle">' + esc(topLine) + '</div>' +
              '<div class="tileTitle">' + name.toUpperCase() + '</div>' +
              '<div class="tileSubTitle">' + email + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // Create "No Results" tile
  function createNoResultsTile() {
    return (
      '<div class="tile" style="position: relative; background-color: rgb(255, 255, 255); cursor: default; display: block;">' +
        '<img src="' + ASSET + '/dogear.png" style="position: absolute; right: 0px; bottom: 0px; display: none;" />' +
        '<div class="tileContainer">' +
          '<div class="tileIcon"><img src="' + ASSET + '/Cancelled.png" /></div>' +
          '<div class="tileInfoSection">' +
            '<div class="tileCell">' +
              '<div class="tileSuperTitle"></div>' +
              '<div class="tileTitle">NO RESULTS</div>' +
              '<div class="tileSubTitle"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // Search users via API
  function searchUsers(query) {
    if (!query || query.trim().length === 0) {
      document.getElementById("results-tiles").innerHTML = "";
      return;
    }

    // Show loading indicator if available
    if (typeof showLoadingIndicator === "function") {
      showLoadingIndicator();
    }

    var xhr = new XMLHttpRequest();
    xhr.open("GET", "/api/admin/users/search?q=" + encodeURIComponent(query), true);
    xhr.setRequestHeader("Accept", "application/json");

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;

      // Hide loading indicator
      if (typeof hideLoadingIndicator === "function") {
        hideLoadingIndicator();
      }

      if (xhr.status === 200) {
        try {
          var response = JSON.parse(xhr.responseText);
          var tilesHtml = "";

          if (response.success && response.data && response.data.length > 0) {
            for (var i = 0; i < response.data.length; i++) {
              tilesHtml += createUserTile(response.data[i]);
            }
          } else {
            tilesHtml = createNoResultsTile();
          }

          document.getElementById("results-tiles").innerHTML = tilesHtml;
        } catch (e) {
          console.error("Failed to parse response:", e);
          document.getElementById("results-tiles").innerHTML = createNoResultsTile();
        }
      } else {
        console.error("Search failed:", xhr.status);
        document.getElementById("results-tiles").innerHTML = createNoResultsTile();

        // Show error box if available
        var errorBox = document.getElementById("error-box");
        if (errorBox) {
          errorBox.style.display = "block";
          document.getElementById("error-title").innerHTML = "Error";
          document.getElementById("error-text").innerHTML = "Failed to search users. Please try again.";
        }
      }
    };

    xhr.send();
  }

  // Wire up the search form
  function init() {
    var searchInput = document.getElementById("searchtext");
    var submitButton = document.getElementById("submit-button");

    if (submitButton) {
      submitButton.onclick = function () {
        var query = searchInput ? searchInput.value : "";
        searchUsers(query);
      };
    }

    if (searchInput) {
      searchInput.onkeypress = function (e) {
        if (e.which === 13 || e.keyCode === 13) {
          searchUsers(searchInput.value);
          return false;
        }
      };
    }

    // Wire up local filter search
    var filterInput = document.getElementById("filter-search");
    if (filterInput) {
      filterInput.onkeyup = function () {
        var filter = filterInput.value.toUpperCase();
        var tiles = document.querySelectorAll("#results-tiles .tile");
        for (var i = 0; i < tiles.length; i++) {
          var text = tiles[i].textContent || tiles[i].innerText;
          if (text.toUpperCase().indexOf(filter) > -1) {
            tiles[i].style.display = "block";
          } else {
            tiles[i].style.display = "none";
          }
        }
      };
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
