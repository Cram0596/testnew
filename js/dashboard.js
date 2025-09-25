// js/dashboard.js

import { App } from "./app.js";
import { Tracker } from "./tracker.js";
import { System } from "./system.js";
import { OddsScreen } from "./odds_screen.js";
import { UI } from "./ui.js";

export const Dashboard = {
  state: {
    // We no longer need local copies of allGameData and allPropData here
    processedData: [],
    isWatchlistFilterActive: false,
  },
  init() {
    this.loadAllData(); // This function is now simplified
    const marketFilterBtn = document.getElementById("market-filter-button");
    const marketFilterOptions = document.getElementById(
      "market-filter-options"
    );
    marketFilterBtn.addEventListener("click", () =>
      marketFilterOptions.classList.toggle("hidden")
    );
    marketFilterOptions.addEventListener("click", (e) => {
      const button = e.target.closest(".market-filter-option");
      if (button) {
        document.getElementById("market-filter-selected-text").textContent =
          button.textContent;
        marketFilterBtn.dataset.value = button.dataset.value;
        marketFilterOptions.classList.add("hidden");
        this.filterAndDisplayData();
      }
    });
    document.addEventListener("click", (e) => {
      const marketFilter = document.getElementById("market-filter-custom");
      if (marketFilter && !marketFilter.contains(e.target)) {
        marketFilterOptions.classList.add("hidden");
      }
    });
    App.elements.watchlistFilterBtn.addEventListener("click", () => {
      this.state.isWatchlistFilterActive = !this.state.isWatchlistFilterActive;
      App.elements.watchlistFilterBtn.classList.toggle(
        "active",
        this.state.isWatchlistFilterActive
      );
      this.renderData();
    });
    App.elements.sportFilter.addEventListener("change", () =>
      this.filterAndDisplayData()
    );
    App.elements.sortBySelect.addEventListener("change", () =>
      this.renderData()
    );
    App.elements.globalBankrollInput.addEventListener("input", () =>
      this.updateAllCardCalculations()
    );
    App.elements.globalKellyMultiplierInput.addEventListener("input", () =>
      this.updateAllCardCalculations()
    );

    App.elements.gameSlate.addEventListener("click", (e) => {
      const starButton = e.target.closest(".watchlist-star");
      const quickTrackBtn = e.target.closest(".quick-track-btn");
      const pillBtn = e.target.closest(".spread-pill");
      const card = e.target.closest(".game-card");
      if (!card) return;
      if (starButton) {
        this.handleWatchlistClick(starButton);
      } else if (quickTrackBtn) {
        this.handleQuickTrack(quickTrackBtn);
      } else if (pillBtn) {
        this.handlePillClick(pillBtn);
      } else {
        this.handleCardClick(card);
      }
    });
  },

  handleCardClick(card) {
    const item = JSON.parse(card.dataset.item);
    const marketType = item.currentMarket;
    const isProp = !["moneyline", "spreads", "totals"].includes(marketType);
    const id = isProp ? item.propId : item.id;
    if (id && marketType) {
      OddsScreen.showById(id, marketType, isProp);
      const oddsScreenTab = document.getElementById("tab-odds-screen");
      UI.activateTab(oddsScreenTab);
    }
  },

  // MODIFIED: This function no longer fetches data. It just processes it from App.state.
  loadAllData() {
    App.elements.loadingSpinner.classList.add("hidden");
    App.elements.gameSlate.innerHTML = "";
    try {
      if (
        App.state.allGameData.length === 0 &&
        App.state.allPropData.length === 0
      ) {
        throw new Error("No game data loaded. Run fetch-odds.js.");
      }
      this._populateMarketFilter();
      this.filterAndDisplayData();
    } catch (error) {
      App.elements.gameSlate.innerHTML = `<p class="text-center text-red-500 col-span-full">${error.message}</p>`;
    } finally {
      App.elements.gameSlate.classList.remove("hidden");
    }
  },

  handlePillClick(pillButton) {
    const card = pillButton.closest(".game-card");
    const item = JSON.parse(card.dataset.item);
    const lineIndex = parseInt(pillButton.dataset.lineIndex);
    const marketType = item.currentMarket;
    const lines = item[marketType];
    const selectedLine = lines[lineIndex];
    if (!card || !selectedLine) return;
    card
      .querySelectorAll(".spread-pill")
      .forEach((btn) => btn.classList.remove("active"));
    pillButton.classList.add("active");
    const lineDisplay = card.querySelector(".market-line-item");
    const sideAName =
      marketType === "spreads"
        ? `${item.teamA} ${App.helpers.formatPoint(selectedLine.point)}`
        : `Over ${selectedLine.point}`;
    const sideBName =
      marketType === "spreads"
        ? `${item.teamB} ${App.helpers.formatPoint(-selectedLine.point)}`
        : `Under ${selectedLine.point}`;
    lineDisplay.querySelector(".side-a-name").textContent = sideAName;
    lineDisplay.querySelector(".side-b-name").textContent = sideBName;
    if (selectedLine.trueOdds) {
      const probA = (
        App.helpers.americanToProb(selectedLine.trueOdds.oddsA) * 100
      ).toFixed(2);
      const probB = (
        App.helpers.americanToProb(selectedLine.trueOdds.oddsB) * 100
      ).toFixed(2);
      lineDisplay.querySelector(".side-a-prob").textContent = `${probA}%`;
      lineDisplay.querySelector(".side-b-prob").textContent = `${probB}%`;
    }
    this.updateCardDisplay(card);
  },

  handleQuickTrack(trackButton) {
    const card = trackButton.closest(".game-card");
    const itemData = JSON.parse(card.dataset.item);
    const recContainer = trackButton.closest(".recommendation-container");
    const marketType = itemData.currentMarket;
    const gameLineMarkets = ["moneyline", "spreads", "totals"];
    let itemForModal = {
      ...itemData,
      isProp: !gameLineMarkets.includes(marketType),
    };

    if (!itemForModal.isProp) {
      const lines = itemData[marketType];
      const activePill = card.querySelector(".spread-pill.active");
      let lineData;
      if (activePill) {
        lineData = lines[parseInt(activePill.dataset.lineIndex)];
      } else {
        const defaultIndex =
          (marketType === "spreads" || marketType === "totals") &&
          lines.length > 1
            ? lines.reduce(
                (closestIndex, line, currentIndex) =>
                  Math.abs(line.point) < Math.abs(lines[closestIndex].point)
                    ? currentIndex
                    : closestIndex,
                0
              )
            : 0;
        lineData = lines[defaultIndex];
      }
      itemForModal.marketData = lineData;
    } else {
      itemForModal.marketData = itemData;
    }
    const side = recContainer.dataset.side;
    const stake = parseFloat(recContainer.dataset.stake);
    const odds = parseFloat(recContainer.dataset.odds);
    Tracker.openTrackPlayModal(itemForModal, side, stake, odds);
  },

  _populateMarketFilter() {
    const gameMarkets = ["moneyline", "spreads", "totals"];
    const propMarkets = [
      ...new Set(App.state.allPropData.map((p) => p.market)),
    ];
    const allMarkets = [...gameMarkets, ...propMarkets];
    const optionsContainer = document.getElementById("market-filter-options");
    optionsContainer.innerHTML = "";
    allMarkets.forEach((marketKey) => {
      if (!marketKey) return;
      const button = document.createElement("button");
      button.className = "market-filter-option";
      button.dataset.value = marketKey;
      button.textContent = marketKey
        .replace(/_/g, " ")
        .replace("h2h", "moneyline")
        .replace(/\b\w/g, (l) => l.toUpperCase());
      optionsContainer.appendChild(button);
    });

    const allSports = [
      ...new Set([
        ...App.state.allGameData.map((g) => g.sport),
        ...App.state.allPropData.map((p) => p.sport),
      ]),
    ];
    App.elements.sportFilter.innerHTML = "";
    App.elements.systemSportFilter.innerHTML =
      '<option value="all">All Sports</option>';
    allSports.forEach((sport) => {
      if (!sport) return;
      const option = document.createElement("option");
      option.value = sport;
      option.textContent = sport;
      App.elements.sportFilter.appendChild(option.cloneNode(true));
      App.elements.systemSportFilter.appendChild(option);
    });

    document.getElementById("market-filter-button").dataset.value = "moneyline";
    document.getElementById("market-filter-selected-text").textContent =
      "Moneyline";
  },

  filterAndDisplayData() {
    const sport = App.elements.sportFilter.value;
    const marketType = document.getElementById("market-filter-button").dataset
      .value;
    const gameLineMarkets = ["moneyline", "spreads", "totals"];
    if (gameLineMarkets.includes(marketType)) {
      this.state.processedData = App.state.allGameData
        .filter((game) => game.sport === sport && game[marketType])
        .map((game) => {
          const marketData = game[marketType];
          const lines = Array.isArray(marketData) ? marketData : [marketData];
          const processedLines = lines.map((line) => ({
            ...line,
            ...this.calculateLineMetrics(line),
          }));
          if (marketType === "spreads" || marketType === "totals") {
            processedLines.sort((a, b) => a.point - b.point);
          }
          const gameWithProcessedLines = {
            ...game,
            [marketType]: processedLines,
            currentMarket: marketType,
          };
          gameWithProcessedLines.maxEdge = Math.max(
            ...processedLines.map((l) => l.maxEdge),
            -Infinity
          );
          return gameWithProcessedLines;
        });
    } else {
      this.state.processedData = App.state.allPropData
        .filter((prop) => prop.sport === sport && prop.market === marketType)
        .map((prop) => {
          if (!prop.trueOdds || !prop.marketOdds || !prop.trueMarketOdds)
            return { ...prop, maxEdge: -1, currentMarket: marketType };

          const trueProbOver = App.helpers.americanToProb(prop.trueOdds.over);
          const trueMarketProbOver = App.helpers.americanToProb(
            prop.trueMarketOdds.over
          );
          prop.edgeOver = trueProbOver - trueMarketProbOver;
          prop.trueProbOver = trueProbOver;

          const trueProbUnder = App.helpers.americanToProb(prop.trueOdds.under);
          const trueMarketProbUnder = App.helpers.americanToProb(
            prop.trueMarketOdds.under
          );
          prop.edgeUnder = trueProbUnder - trueMarketProbUnder;
          prop.trueProbUnder = trueProbUnder;

          prop.maxEdge = Math.max(prop.edgeOver, prop.edgeUnder);
          return { ...prop, currentMarket: marketType };
        });
    }
    System.autoLogSystemPlays(this.state.processedData);
    this.renderData();
  },

  calculateLineMetrics(line) {
    if (!line.trueOdds || !line.trueMarketOdds)
      return {
        edgeA: -1,
        edgeB: -1,
        maxEdge: -1,
        trueProbA: null,
        trueProbB: null,
      };
    const trueProbA = App.helpers.americanToProb(line.trueOdds.oddsA);
    const trueMarketProbA = App.helpers.americanToProb(
      line.trueMarketOdds.oddsA
    );
    const edgeA = trueProbA - trueMarketProbA;
    const trueProbB = App.helpers.americanToProb(line.trueOdds.oddsB);
    const trueMarketProbB = App.helpers.americanToProb(
      line.trueMarketOdds.oddsB
    );
    const edgeB = trueProbB - trueMarketProbB;
    return {
      edgeA,
      edgeB,
      maxEdge: Math.max(edgeA, edgeB),
      trueProbA,
      trueProbB,
    };
  },

  renderData() {
    const sortBy = App.elements.sortBySelect.value;
    const showWatchlistOnly = this.state.isWatchlistFilterActive;
    const marketType = document.getElementById("market-filter-button").dataset
      .value;
    const gameLineMarkets = ["moneyline", "spreads", "totals"];
    let dataToRender = [...this.state.processedData];
    if (showWatchlistOnly) {
      const idKey = gameLineMarkets.includes(marketType) ? "id" : "propId";
      dataToRender = dataToRender.filter((item) =>
        App.state.starredGames.includes(item[idKey])
      );
    }
    if (sortBy === "time") {
      dataToRender.sort((a, b) => new Date(a.gameTime) - new Date(b.gameTime));
    } else if (sortBy === "edge") {
      dataToRender.sort((a, b) => b.maxEdge - a.maxEdge);
    }

    App.elements.gameSlate.innerHTML = "";
    if (dataToRender.length > 0) {
      dataToRender.forEach((item, index) => {
        const card = gameLineMarkets.includes(marketType)
          ? this.createCard(item)
          : this.createPropCard(item);
        card.classList.add("card-fade-in");
        card.style.animationDelay = `${index * 50}ms`;
        App.elements.gameSlate.appendChild(card);
      });
      this.updateAllCardCalculations();
    } else {
      App.elements.gameSlate.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center p-8 bg-tertiary rounded-lg"><svg class="h-12 w-12 text-main-secondary mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg><h3 class="text-lg font-semibold text-main-primary">No Games Found</h3><p class="text-main-secondary">There are no games that match your current filter settings.</p></div>`;
    }
  },

  createCard(game) {
    const card = document.createElement("div");
    card.className = "game-card rounded-lg p-4 flex flex-col space-y-3";
    card.dataset.id = game.id;
    card.dataset.item = JSON.stringify(game);
    const logoA = App.helpers.getTeamLogoPath(game.teamA, game.sport);
    const logoB = App.helpers.getTeamLogoPath(game.teamB, game.sport);
    card.innerHTML = `<div class="flex justify-between items-center"><div class="flex items-center space-x-2"><img src="${logoA}" class="h-10 w-10 object-contain"><p class="font-bold text-main-primary">${
      game.teamA
    }</p></div><div class="flex items-center space-x-2"><p class="font-bold text-main-primary">${
      game.teamB
    }</p><img src="${logoB}" class="h-10 w-10 object-contain"></div><button class="watchlist-star" data-game-id="${
      game.id
    }"><svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.975-2.888a1 1 0 00-1.176 0l-3.975-2.888c-.784.57-1.838-.196-1.539-1.118l1.518-4.674a1 1 0 00-.364-1.118L2.48 9.4c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.95-.69l1.519-4.674z"></path></svg></button></div><div class="text-center"><p class="text-sm text-main-secondary">${new Date(
      game.gameTime
    ).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}</p></div><div class="pill-selector-container"></div><div class="market-line-item p-3 rounded-md"><div class="flex justify-between items-center"><span class="font-bold text-main-primary side-a-name"></span> <span class="text-main-primary side-a-prob"></span></div><div class="flex justify-between items-center mt-1"><span class="font-bold text-main-primary side-b-name"></span><span class="text-main-primary side-b-prob"></span></div><div class="recommendation-container"></div></div>`;

    const lineDisplay = card.querySelector(".market-line-item");
    const marketType = game.currentMarket;
    const lines = game[marketType];
    if (lines && lines.length > 0) {
      const defaultIndex =
        marketType === "spreads" || marketType === "totals"
          ? lines.reduce(
              (closestIndex, line, currentIndex) =>
                Math.abs(line.point) < Math.abs(lines[closestIndex].point)
                  ? currentIndex
                  : closestIndex,
              0
            )
          : 0;
      const mainLine = lines[defaultIndex];
      const sideANameEl = lineDisplay.querySelector(".side-a-name");
      const sideBNameEl = lineDisplay.querySelector(".side-b-name");
      if (marketType === "moneyline") {
        sideANameEl.textContent = game.teamA;
        sideBNameEl.textContent = game.teamB;
      } else if (marketType === "spreads") {
        sideANameEl.textContent = `${game.teamA} ${App.helpers.formatPoint(
          mainLine.point
        )}`;
        sideBNameEl.textContent = `${game.teamB} ${App.helpers.formatPoint(
          -mainLine.point
        )}`;
      } else {
        sideANameEl.textContent = `Over ${mainLine.point}`;
        sideBNameEl.textContent = `Under ${mainLine.point}`;
      }

      if (mainLine.trueOdds) {
        lineDisplay.querySelector(".side-a-prob").textContent = `${(
          App.helpers.americanToProb(mainLine.trueOdds.oddsA) * 100
        ).toFixed(2)}%`;
        lineDisplay.querySelector(".side-b-prob").textContent = `${(
          App.helpers.americanToProb(mainLine.trueOdds.oddsB) * 100
        ).toFixed(2)}%`;
      }

      const pillContainer = card.querySelector(".pill-selector-container");
      if (
        (marketType === "spreads" || marketType === "totals") &&
        lines.length > 1
      ) {
        const pillSelector = document.createElement("div");
        pillSelector.className = "pill-selector";
        lines.forEach((line, index) => {
          const pill = document.createElement("button");
          pill.className = "spread-pill";
          pill.textContent = Math.abs(line.point);
          pill.dataset.lineIndex = index;
          if (index === defaultIndex) pill.classList.add("active");
          pillSelector.appendChild(pill);
        });
        pillContainer.appendChild(pillSelector);
      }
    }
    return card;
  },

  createPropCard(prop) {
    const card = document.createElement("div");
    card.className = "game-card rounded-lg p-4 flex flex-col space-y-3";
    card.dataset.id = prop.propId;
    card.dataset.item = JSON.stringify(prop);
    const marketName = prop.market
      .replace(/player_|_over_under/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .trim();
    card.innerHTML = `<div class="flex justify-between items-center"><div class="flex-grow"><p class="font-bold text-lg text-main-primary">${
      prop.player
    }</p><p class="text-sm text-main-secondary">${marketName}</p></div><div class="flex items-center space-x-2"><div class="flex flex-col items-center text-center"><img src="${App.helpers.getTeamLogoPath(
      prop.teamB,
      prop.sport
    )}" class="h-8 w-8 object-contain"><p class="font-bold text-xs text-main-primary mt-1 truncate">${
      prop.teamB
    }</p></div><div class="text-md font-bold text-main-secondary">@</div><div class="flex flex-col items-center text-center"><img src="${App.helpers.getTeamLogoPath(
      prop.teamA,
      prop.sport
    )}" class="h-8 w-8 object-contain"><p class="font-bold text-xs text-main-primary mt-1 truncate">${
      prop.teamA
    }</p></div></div></div><div class="text-center"><p class="text-sm text-main-secondary">${new Date(
      prop.gameTime
    ).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}</p></div><div class="market-line-item p-3 rounded-md"><div class="flex justify-between items-center"><span class="font-bold text-main-primary side-a-name">Over ${
      prop.point
    }</span><span class="text-main-primary side-a-prob">${(
      App.helpers.americanToProb(prop.trueOdds.over) * 100
    ).toFixed(
      2
    )}%</span></div><div class="flex justify-between items-center mt-1"><span class="font-bold text-main-primary side-b-name">Under ${
      prop.point
    }</span><span class="text-main-primary side-b-prob">${(
      App.helpers.americanToProb(prop.trueOdds.under) * 100
    ).toFixed(
      2
    )}%</span></div><div class="recommendation-container"></div></div>`;
    return card;
  },

  updateAllCardCalculations() {
    App.elements.gameSlate
      .querySelectorAll(".game-card")
      .forEach((card) => this.updateCardDisplay(card));
  },

  updateCardDisplay(card) {
    const item = JSON.parse(card.dataset.item);
    const bankroll = parseFloat(App.elements.globalBankrollInput.value);
    let kellyMultiplier = parseFloat(
      App.elements.globalKellyMultiplierInput.value
    );
    if (isNaN(kellyMultiplier) || kellyMultiplier <= 0) {
      kellyMultiplier = 0.5;
    }

    const recContainer = card.querySelector(".recommendation-container");
    if (!recContainer) return;
    if (isNaN(bankroll) || bankroll === 0) {
      recContainer.innerHTML = "";
      return;
    }

    const marketType = item.currentMarket;
    const gameLineMarkets = ["moneyline", "spreads", "totals"];
    let bestBetFound = null;
    let potentialBets = [];

    if (gameLineMarkets.includes(marketType)) {
      const lines = item[marketType];
      let lineData;
      if (
        (marketType === "spreads" || marketType === "totals") &&
        lines &&
        lines.length > 1
      ) {
        const activePill = card.querySelector(".spread-pill.active");
        const defaultIndex = lines.reduce(
          (closestIndex, line, currentIndex) =>
            Math.abs(line.point) < Math.abs(lines[closestIndex].point)
              ? currentIndex
              : closestIndex,
          0
        );
        const lineIndex = activePill
          ? parseInt(activePill.dataset.lineIndex)
          : defaultIndex;
        lineData = lines[lineIndex];
      } else {
        lineData = lines ? lines[0] : null;
      }

      if (!lineData) return;

      if (
        lineData.edgeA > 0 &&
        lineData.trueMarketOdds &&
        lineData.trueMarketOdds.oddsA !== null
      ) {
        const p = lineData.trueProbA;
        const q = lineData.trueProbB;
        const decimalOdds = App.helpers.americanToDecimal(
          lineData.trueMarketOdds.oddsA
        );
        const b = decimalOdds - 1;
        if (b > 0) {
          const kellyFraction = ((b * p - q) / b) * kellyMultiplier;
          potentialBets.push({
            side: "A",
            edge: lineData.edgeA,
            stake: bankroll * kellyFraction,
            odds: lineData.marketOdds.oddsA,
            point: lineData.point,
            bookmaker: "Market Consensus",
          });
        }
      }
      if (
        lineData.edgeB > 0 &&
        lineData.trueMarketOdds &&
        lineData.trueMarketOdds.oddsB !== null
      ) {
        const p = lineData.trueProbB;
        const q = lineData.trueProbA;
        const decimalOdds = App.helpers.americanToDecimal(
          lineData.trueMarketOdds.oddsB
        );
        const b = decimalOdds - 1;
        if (b > 0) {
          const kellyFraction = ((b * p - q) / b) * kellyMultiplier;
          potentialBets.push({
            side: "B",
            edge: lineData.edgeB,
            stake: bankroll * kellyFraction,
            odds: lineData.marketOdds.oddsB,
            point: lineData.point,
            bookmaker: "Market Consensus",
          });
        }
      }
    } else {
      if (!item.trueMarketOdds) return;
      if (item.edgeOver > 0 && item.trueMarketOdds.over !== null) {
        const p = item.trueProbOver;
        const q = item.trueProbUnder;
        const decimalOdds = App.helpers.americanToDecimal(
          item.trueMarketOdds.over
        );
        const b = decimalOdds - 1;
        if (b > 0) {
          const kellyFraction = ((b * p - q) / b) * kellyMultiplier;
          potentialBets.push({
            side: "A",
            edge: item.edgeOver,
            stake: bankroll * kellyFraction,
            odds: item.marketOdds.over,
            point: item.point,
            bookmaker: "Market Consensus",
          });
        }
      }
      if (item.edgeUnder > 0 && item.trueMarketOdds.under !== null) {
        const p = item.trueProbUnder;
        const q = item.trueProbOver;
        const decimalOdds = App.helpers.americanToDecimal(
          item.trueMarketOdds.under
        );
        const b = decimalOdds - 1;
        if (b > 0) {
          const kellyFraction = ((b * p - q) / b) * kellyMultiplier;
          potentialBets.push({
            side: "B",
            edge: item.edgeUnder,
            stake: bankroll * kellyFraction,
            odds: item.marketOdds.under,
            point: item.point,
            bookmaker: "Market Consensus",
          });
        }
      }
    }

    if (potentialBets.length > 0) {
      bestBetFound = potentialBets.reduce((best, current) =>
        current.edge > best.edge ? current : best
      );
    }

    if (bestBetFound && bestBetFound.stake > 0.01) {
      let sideNameForBet,
        teamLogo = null;
      const bankrollPercent = (bestBetFound.stake / bankroll) * 100;
      const bookmakerDisplay = `<span class="text-xs font-semibold text-main-secondary">Market Consensus</span>`;

      if (gameLineMarkets.includes(marketType)) {
        const game = item;
        if (marketType === "moneyline") {
          sideNameForBet = bestBetFound.side === "A" ? game.teamA : game.teamB;
        } else if (marketType === "spreads") {
          sideNameForBet =
            bestBetFound.side === "A"
              ? `${game.teamA} ${App.helpers.formatPoint(bestBetFound.point)}`
              : `${game.teamB} ${App.helpers.formatPoint(-bestBetFound.point)}`;
        } else {
          sideNameForBet =
            bestBetFound.side === "A"
              ? `Over ${bestBetFound.point}`
              : `Under ${bestBetFound.point}`;
        }
        teamLogo =
          bestBetFound.side === "A" && marketType !== "totals"
            ? App.helpers.getTeamLogoPath(game.teamA, game.sport)
            : bestBetFound.side === "B" && marketType !== "totals"
            ? App.helpers.getTeamLogoPath(game.teamB, game.sport)
            : null;
      } else {
        const prop = item;
        const marketName = prop.market
          .replace(/player_|_over_under/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase())
          .trim();
        sideNameForBet =
          bestBetFound.side === "A"
            ? `Over ${prop.point} ${marketName}`
            : `Under ${prop.point} ${marketName}`;
      }

      recContainer.dataset.side = bestBetFound.side;
      recContainer.dataset.stake = bestBetFound.stake.toFixed(2);
      recContainer.dataset.odds = bestBetFound.odds;
      recContainer.innerHTML = `<div class="mt-2 border-t border-border-primary pt-2 relative flex items-center space-x-3">${
        teamLogo
          ? `<img src="${teamLogo}" class="h-10 w-10 object-contain flex-shrink-0">`
          : ""
      }<div class="flex-grow"><p class="font-bold text-sm text-accent-blue">${sideNameForBet}</p><div class="flex items-end space-x-2"><p class="text-xl font-bold text-main-primary leading-none">$${bestBetFound.stake.toFixed(
        2
      )}</p><span class="text-xs text-main-secondary leading-none">(${bankrollPercent.toFixed(
        4
      )}% of bankroll)</span></div><div class="tooltip-container inline-block"><p class="text-xs text-green-500 cursor-help underline decoration-dotted leading-none">+${(
        bestBetFound.edge * 100
      ).toFixed(
        2
      )}% EV</p><span class="tooltip-text">Your "Edge" or Positive Expected Value (+EV)—your long-term profit advantage on this bet.</span></div></div><div class="flex flex-col items-center flex-shrink-0">${bookmakerDisplay}<button class="quick-track-btn h-7 w-7 rounded-full bg-green-500 hover:bg-green-600 text-white font-bold text-lg flex items-center justify-center transition" title="Track Bet">+</button></div></div>`;
    } else {
      recContainer.innerHTML = "";
    }
  },

  handleWatchlistClick(starButton) {
    const gameId = starButton.dataset.gameId;
    if (App.state.starredGames.includes(gameId)) {
      App.state.starredGames = App.state.starredGames.filter(
        (id) => id !== gameId
      );
      starButton.classList.remove("active");
    } else {
      App.state.starredGames.push(gameId);
    }
    localStorage.setItem(
      "starredGames",
      JSON.stringify(App.state.starredGames)
    );
  },
};
