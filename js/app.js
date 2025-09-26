// js/app.js

import { Dashboard } from "./dashboard.js";
import { EVBets } from "./ev_bets.js";
import { Tracker } from "./tracker.js";
import { System } from "./system.js";
import { UI } from "./ui.js";
import { OddsScreen } from "./odds_screen.js";
import { TEAM_LOGO_MAP } from "./mappings.js";

export const App = {
  config: {
    // Airtable Details Removed
  },
  elements: {
    themeToggle: document.getElementById("theme-toggle"),
    themeIconSun: document.getElementById("theme-icon-sun"),
    themeIconMoon: document.getElementById("theme-icon-moon"),
    tabs: document.querySelectorAll(".tab-btn"),
    views: document.querySelectorAll(".view"),
    mainViewsContainer: document.getElementById("main-views-container"),
    gameSlate: document.getElementById("game-slate"),
    loadingSpinner: document.getElementById("loading-spinner"),
    sportFilter: document.getElementById("sport-filter"),
    sortBySelect: document.getElementById("sort-by"),
    watchlistFilterBtn: document.getElementById("watchlist-filter-btn"),
    globalBankrollInput: document.getElementById("global-bankroll"),
    globalKellyMultiplierInput: document.getElementById(
      "global-kelly-multiplier"
    ),
    evBetsView: document.getElementById("ev-bets-view"),
    oddsScreenView: document.getElementById("odds-screen-view"),
    dashboardView: document.getElementById("dashboard-view"),
    trackerRecord: document.getElementById("tracker-record"),
    trackerPl: document.getElementById("tracker-pl"),
    trackerRoi: document.getElementById("tracker-roi"),
    trackedPlaysList: document.getElementById("tracked-plays-list"),
    logPlayModal: document.getElementById("log-play-modal"),
    modalTitle: document.getElementById("modal-title"),
    modalGameInfo: document.getElementById("modal-game-info"),
    modalSelection: document.getElementById("modal-selection"),
    modalOdds: document.getElementById("modal-odds"),
    modalStake: document.getElementById("modal-stake"),
    modalCancelBtn: document.getElementById("modal-cancel-btn"),
    modalSaveBtn: document.getElementById("modal-save-btn"),
    trackedPlayCardTemplate: document.getElementById(
      "tracked-play-card-template"
    ),
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
  state: {
    starredGames: JSON.parse(localStorage.getItem("starredGames")) || [],
    allGameData: [],
    allPropData: [],
  },
  helpers: {
    americanToProb(odds) {
      if (odds === null || typeof odds === "undefined") return 0;
      if (odds >= 100) return 100 / (odds + 100);
      return Math.abs(odds) / (Math.abs(odds) + 100);
    },
    americanToDecimal(odds) {
      if (odds >= 100) return odds / 100 + 1;
      return 100 / Math.abs(odds) + 1;
    },
    decimalToAmerican(decimalOdds) {
      if (decimalOdds >= 2.0) {
        return (decimalOdds - 1) * 100;
      }
      return -100 / (decimalOdds - 1);
    },
    calculateVig(oddsA, oddsB) {
      if (oddsA === null || oddsB === null) return 0;
      const probA = this.americanToProb(oddsA);
      const probB = this.americanToProb(oddsB);
      const totalProb = probA + probB;
      if (totalProb <= 1) return 0;
      return totalProb - 1;
    },
    probToAmerican(prob) {
      if (!prob || prob <= 0 || prob >= 1) return null;
      let odds;
      if (prob >= 0.5) {
        odds = -((prob / (1 - prob)) * 100);
      } else {
        odds = 100 / prob - 100;
      }
      return parseFloat(odds.toFixed(4));
    },
    calculateVigFreeLine(odds) {
      if (!odds || odds.oddsA === null || odds.oddsB === null) return null;
      const probA = this.americanToProb(odds.oddsA);
      const probB = this.americanToProb(odds.oddsB);
      const totalProb = probA + probB;
      if (totalProb <= 0) return null;
      const vigFreeProbA = probA / totalProb;
      return {
        oddsA: this.probToAmerican(vigFreeProbA),
        oddsB: this.probToAmerican(1 - vigFreeProbA),
      };
    },
    formatPoint(point) {
      if (point > 0) return `+${point}`;
      return point;
    },
    formatOdds(odds) {
      if (odds > 0) return `+${Math.round(odds)}`;
      return Math.round(odds);
    },
    LEAGUE_FOLDER_MAP: {
      NFL: "nfl",
      "NFL Football": "nfl", 
      americanfootball_nfl: "nfl", 
      "NCAAF Football": "ncaaf",
      americanfootball_ncaaf: "ncaaf",
      NCAAB: "ncaab",
      MLB: "mlb",
      WNBA: "wnba",
    },
    getTeamLogoPath(teamName, sportTitle) {
      const leagueFolder =
        this.LEAGUE_FOLDER_MAP[sportTitle] || sportTitle.toLowerCase();
      const simplifiedName = teamName
        .toLowerCase()
        .replace(/ \(.+\)/, "")
        .trim();
      const fullNameKey = teamName.toLowerCase().trim();
      const canonicalName =
        TEAM_LOGO_MAP[fullNameKey] || TEAM_LOGO_MAP[simplifiedName];
      if (canonicalName) {
        return `images/team_logos/${leagueFolder}/${canonicalName}.png`;
      }
      console.warn(
        `No logo mapping found for '${teamName}' in sport '${sportTitle}'.`
      );
      return `images/team_logos/default-logo.png`;
    },
  },

  async init() {
    this.elements.loadingSpinner.classList.remove("hidden");
    try {
      const [gameData, propData] = await Promise.all([
        fetch("games.json").then((res) => {
          if (!res.ok) throw new Error("Could not find games.json.");
          return res.json();
        }),
        fetch("player_props.json").then((res) => {
          if (!res.ok) return { props: [] };
          return res.json();
        }),
      ]);
      const now = new Date();
      
      // **FIXED**: Directly assign gameData since it's already an array
      this.state.allGameData = (gameData || []).filter(
        (g) => new Date(g.gameTime) > now
      );
      this.state.allPropData = (propData.props || []).filter(
        (p) => new Date(p.gameTime) > now
      );
      
      UI.init();
      Dashboard.init();
      EVBets.init(this.elements.evBetsView);
      Tracker.init();
      System.init();
      OddsScreen.init(this.elements.oddsScreenView);
      console.log("NOVA Sports Capital Initialized");

    } catch (error) {
      console.error("Failed to load initial data:", error);
      if (this.elements.gameSlate) {
          this.elements.gameSlate.innerHTML = `<p class="text-center text-red-500 col-span-full">${error.message}</p>`;
      }
    } finally {
      this.elements.loadingSpinner.classList.add("hidden");
    }
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());