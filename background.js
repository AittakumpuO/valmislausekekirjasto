"use strict";

// Edge handles the toggle and its own close control, including across worker restarts.
// No installation/update handler writes to the user's library.
chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true}).catch(() => {
  console.error("Sivupaneelin kuvaketoimintoa ei voitu ottaa käyttöön.");
});
