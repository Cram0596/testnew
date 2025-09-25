import { App } from "./app.js";
import { Tracker } from "./tracker.js";

export const System = {
  state: {
    systemPlays: [],
  },

  init() {
    this.state.systemPlays =
      JSON.parse(localStorage.getItem("systemPlays")) || [];
    this.renderSystemPerformance();

    App.elements.simulateResultsBtn.addEventListener("click", () =>
      this.simulateSystemResults()
    );
    App.elements.systemSportFilter.addEventListener("change", () =>
      this.renderSystemPerformance()
    );
    App.elements.systemMarketFilter.addEventListener("change", () =>
      this.renderSystemPerformance()
    );
  },

  autoLogSystemPlays(processedData) {
    if (!processedData || typeof processedData.forEach !== "function") {
      console.error("autoLogSystemPlays was called with invalid data.");
      return;
    }

    const gameLineMarkets = ["moneyline", "spreads", "totals"];

    processedData.forEach((item) => {
      const marketType = item.currentMarket;

      if (gameLineMarkets.includes(marketType)) {
        // Handle Game Lines
        const lines = item[marketType];
        if (!lines) return;
        lines.forEach((line) => {
          if (line.edgeA > 0)
            this._logPlay(item, "A", marketType, line, line.edgeA);
          if (line.edgeB > 0)
            this._logPlay(item, "B", marketType, line, line.edgeB);
        });
      } else {
        // Handle Player Props
        if (item.edgeOver > 0)
          this._logPlay(item, "A", marketType, item, item.edgeOver);
        if (item.edgeUnder > 0)
          this._logPlay(item, "B", marketType, item, item.edgeUnder);
      }
    });
    localStorage.setItem("systemPlays", JSON.stringify(this.state.systemPlays));
    this.renderSystemPerformance();
  },

  _logPlay(item, side, marketType, lineData, edge) {
    const gameLineMarkets = ["moneyline", "spreads", "totals"];
    const isProp = !gameLineMarkets.includes(marketType);

    const idSuffix = isProp ? lineData.point : lineData.point || "ml";
    const betId = `${item.id || item.propId}-${marketType}-${idSuffix}-${side}`;

    if (this.state.systemPlays.find((p) => p.id === betId)) return;
    if (!lineData.marketOdds) return;

    let sideName, odds, point;

    if (side === "A") {
      // Corresponds to Team A for games, Over for props/totals
      odds = isProp ? lineData.marketOdds.over : lineData.marketOdds.oddsA;
      point = lineData.point;
      if (isProp) {
        sideName = `Over ${lineData.point}`;
      } else if (marketType === "moneyline") {
        sideName = item.teamA;
      } else if (marketType === "spreads") {
        sideName = `${item.teamA} ${App.helpers.formatPoint(lineData.point)}`;
      } else {
        // Totals
        sideName = `Over ${lineData.point}`;
      }
    } else {
      // Corresponds to Team B for games, Under for props/totals
      odds = isProp ? lineData.marketOdds.under : lineData.marketOdds.oddsB;
      point = lineData.point;
      if (isProp) {
        sideName = `Under ${lineData.point}`;
      } else if (marketType === "moneyline") {
        sideName = item.teamB;
      } else if (marketType === "spreads") {
        sideName = `${item.teamB} ${App.helpers.formatPoint(-lineData.point)}`;
      } else {
        // Totals
        sideName = `Under ${lineData.point}`;
      }
    }

    this.state.systemPlays.push({
      id: betId,
      sport: item.sport,
      marketType,
      gameId: item.id || item.gameId,
      teamA: item.teamA,
      teamB: item.teamB,
      player: item.player || null,
      sideName,
      odds,
      point,
      edge: edge * 100,
      stake: 1,
      status: "pending",
      timestamp: new Date(item.gameTime).getTime(),
    });
  },

  simulateSystemResults() {
    this.state.systemPlays.forEach((play) => {
      if (play.status === "pending" && new Date(play.timestamp) < new Date()) {
        const marketProb = App.helpers.americanToProb(play.odds);
        const edgeDecimal = play.edge / 100;
        const winProb = marketProb + edgeDecimal;
        play.status = Math.random() < winProb ? "win" : "loss";
      }
    });
    localStorage.setItem("systemPlays", JSON.stringify(this.state.systemPlays));
    this.renderSystemPerformance();
  },

  renderSystemPerformance() {
    const sport = App.elements.systemSportFilter.value;
    const market = App.elements.systemMarketFilter.value;

    let filteredPlays = this.state.systemPlays;
    if (sport !== "all") {
      filteredPlays = filteredPlays.filter((p) => p.sport === sport);
    }
    if (market !== "all") {
      filteredPlays = filteredPlays.filter((p) => p.marketType === market);
    }

    Tracker._renderTrackerUI(
      App.elements.systemTrackedPlaysList,
      filteredPlays,
      App.elements.systemTrackerRecord,
      App.elements.systemTrackerPl,
      App.elements.systemTrackerRoi
    );
  },
};
