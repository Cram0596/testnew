import { UI } from "./ui.js";
import { Dashboard } from "./dashboard.js";
import { EVBets } from "./ev_bets.js";
import { OddsScreen } from "./odds_screen.js";
import { Tracker } from "./tracker.js";
import { System } from "./system.js";

const App = {
  elements: {
    dashboardView: document.getElementById("dashboard-view"),
    evBetsView: document.getElementById("ev-bets-view"),
    oddsScreenView: document.getElementById("odds-screen-view"),
    trackerRecord: document.getElementById("tracker-record"),
    trackerPl: document.getElementById("tracker-pl"),
    trackerRoi: document.getElementById("tracker-roi"),
    trackedPlaysList: document.getElementById("tracked-plays-list"),
    systemTrackerRecord: document.getElementById("system-tracker-record"),
    systemTrackerPl: document.getElementById("system-tracker-pl"),
    systemTrackerRoi: document.getElementById("system-tracker-roi"),
    systemTrackedPlaysList: document.getElementById(
      "system-tracked-plays-list"
    ),
    systemSportFilter: document.getElementById("system-sport-filter"),
    systemMarketFilter: document.getElementById("system-market-filter"),
    simulateResultsBtn: document.getElementById("simulate-results-btn"),
  },

  init() {
    UI.init();
    Dashboard.init(this.elements.dashboardView);
    EVBets.init(this.elements.evBetsView);
    OddsScreen.init(this.elements.oddsScreenView);
    Tracker.init();
    System.init();
    console.log("NOVA Sports Capital Initialized");
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());