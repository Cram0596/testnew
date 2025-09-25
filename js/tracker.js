// js/tracker.js
// Handles the "My Performance Tracker" tab, including logging personal bets.

import { App } from "./app.js";

export const Tracker = {
  state: {
    loggedBets: [],
    currentBetToLog: null,
  },

  init() {
    this.state.loggedBets =
      JSON.parse(localStorage.getItem("loggedBets")) || [];
    this.renderPerformanceTracker();

    App.elements.modalSaveBtn.addEventListener("click", () =>
      this.saveTrackedBet()
    );
    App.elements.modalCancelBtn.addEventListener("click", () =>
      App.elements.logPlayModal.classList.add("hidden")
    );
    App.elements.trackedPlaysList.addEventListener("click", (e) => {
      if (e.target.classList.contains("grade-btn")) {
        const betId = parseInt(e.target.dataset.id);
        const result = e.target.dataset.result;
        this.gradeBet(betId, result);
      }
    });
  },

  renderPerformanceTracker() {
    this._renderTrackerUI(
      App.elements.trackedPlaysList,
      this.state.loggedBets,
      App.elements.trackerRecord,
      App.elements.trackerPl,
      App.elements.trackerRoi
    );
  },

  openTrackPlayModal(item, side, stake, odds) {
    this.state.currentBetToLog = { item, side };
    App.elements.modalTitle.textContent = `Track Your Play`;
    App.elements.modalGameInfo.textContent = `${item.teamB} @ ${item.teamA}`;

    const marketData = item.marketData;
    let sideAName, sideBName;

    if (item.isProp) {
      sideAName = `Over ${marketData.point}`;
      sideBName = `Under ${marketData.point}`;
    } else {
      const marketType = item.currentMarket;
      if (marketType === "moneyline") {
        sideAName = item.teamA;
        sideBName = item.teamB;
      } else if (marketType === "spreads") {
        sideAName = `${item.teamA} ${App.helpers.formatPoint(
          marketData.point
        )}`;
        sideBName = `${item.teamB} ${App.helpers.formatPoint(
          -marketData.point
        )}`;
      } else {
        // totals
        sideAName = `Over ${marketData.point}`;
        sideBName = `Under ${marketData.point}`;
      }
    }

    App.elements.modalSelection.innerHTML = `
            <option value="A">${sideAName}</option>
            <option value="B">${sideBName}</option>`;
    App.elements.modalSelection.value = side;
    App.elements.modalStake.value = stake.toFixed(2);
    App.elements.modalOdds.value = App.helpers.formatOdds(odds);
    App.elements.logPlayModal.classList.remove("hidden");
  },

  saveTrackedBet() {
    if (!this.state.currentBetToLog) return;

    const stake = parseFloat(App.elements.modalStake.value);
    const odds = parseFloat(App.elements.modalOdds.value);
    const selectedSide = App.elements.modalSelection.value;
    const { item } = this.state.currentBetToLog;

    const selectedSideName =
      selectedSide === "A"
        ? App.elements.modalSelection.options[0].text
        : App.elements.modalSelection.options[1].text;

    const edge =
      selectedSide === "A" ? item.marketData.edgeA : item.marketData.edgeB;

    const bet = {
      id: Date.now(),
      teamA: item.teamA,
      teamB: item.teamB,
      sideName: selectedSideName,
      odds: odds,
      edge: edge * 100,
      stake: stake,
      status: "pending",
      timestamp: new Date(item.gameTime).getTime(),
    };

    this.state.loggedBets.push(bet);
    localStorage.setItem("loggedBets", JSON.stringify(this.state.loggedBets));
    this.renderPerformanceTracker();
    App.elements.logPlayModal.classList.add("hidden");
  },

  gradeBet(betId, result) {
    const betIndex = this.state.loggedBets.findIndex((b) => b.id === betId);
    if (betIndex > -1) {
      this.state.loggedBets[betIndex].status = result;
      localStorage.setItem("loggedBets", JSON.stringify(this.state.loggedBets));
      this.renderPerformanceTracker();
    }
  },

  _renderTrackerUI(listElement, bets, recordEl, plEl, roiEl) {
    if (!listElement || !recordEl || !plEl || !roiEl) return;
    listElement.innerHTML = "";
    let wins = 0,
      losses = 0,
      pushes = 0,
      totalWagered = 0,
      totalProfit = 0;

    const sortedBets = [...bets].sort((a, b) => b.timestamp - a.timestamp);

    if (sortedBets.length === 0) {
      listElement.innerHTML =
        '<p class="text-center text-main-secondary">No bets tracked yet.</p>';
      recordEl.textContent = "0 - 0";
      plEl.textContent = "$0.00";
      plEl.className = "text-2xl font-bold text-main-primary";
      roiEl.textContent = "0.00%";
      return;
    }

    sortedBets.forEach((bet) => {
      const cardTemplate = App.elements.trackedPlayCardTemplate;
      if (!cardTemplate) return;

      const cardContent = cardTemplate.content.cloneNode(true);
      const cardRoot = cardContent.querySelector(".tracked-play-card");
      if (!cardRoot) return;

      const teamInfoEl = cardRoot.querySelector(".font-bold.text-main-primary");
      const dateInfoEl = cardRoot.querySelector(".text-sm.text-main-secondary");
      const playDetailsEl = cardRoot.querySelector(".play-details");
      const edgeDetailsEl = cardRoot.querySelector(".edge-details");
      const statusContainer = cardRoot.querySelector(".status-container");

      if (teamInfoEl) teamInfoEl.textContent = `${bet.teamB} @ ${bet.teamA}`; // Corrected Line
      if (dateInfoEl)
        dateInfoEl.textContent = new Date(bet.timestamp).toLocaleString();
      if (playDetailsEl)
        playDetailsEl.textContent = `$${bet.stake.toFixed(2)} on ${
          bet.sideName
        } at ${App.helpers.formatOdds(bet.odds)}`;
      if (edgeDetailsEl && !isNaN(bet.edge))
        edgeDetailsEl.textContent = `${bet.edge.toFixed(2)}%`;

      if (statusContainer) {
        if (bet.status === "pending") {
          statusContainer.innerHTML = `
            <button class="grade-btn btn btn-success btn-sm" data-id="${bet.id}" data-result="win">Win</button>
            <button class="grade-btn btn btn-secondary btn-sm" data-id="${bet.id}" data-result="push">Push</button>
            <button class="grade-btn btn-danger btn-sm" data-id="${bet.id}" data-result="loss">Loss</button>`;
        } else {
          let statusClass = "text-main-secondary"; // Default for push
          if (bet.status === "win") statusClass = "text-green-500";
          if (bet.status === "loss") statusClass = "text-red-500";
          statusContainer.innerHTML = `<span class="font-bold ${statusClass}">${bet.status.toUpperCase()}</span>`;
        }
      }

      if (bet.status !== "pending") {
        totalWagered += bet.stake;
        if (bet.status === "win") {
          wins++;
          totalProfit +=
            bet.stake * (App.helpers.americanToDecimal(bet.odds) - 1);
        } else if (bet.status === "loss") {
          losses++;
          totalProfit -= bet.stake;
        } else if (bet.status === "push") {
          pushes++;
        }
      }
      listElement.appendChild(cardContent);
    });

    recordEl.textContent = `${wins} - ${losses}${
      pushes > 0 ? ` - ${pushes}` : ""
    }`;
    plEl.textContent = `${totalProfit >= 0 ? "+" : ""}$${totalProfit.toFixed(
      2
    )}`;
    plEl.className = `text-2xl font-bold ${
      totalProfit > 0
        ? "text-green-500"
        : totalProfit < 0
        ? "text-red-500"
        : "text-main-primary"
    }`;
    const roi = totalWagered > 0 ? (totalProfit / totalWagered) * 100 : 0;
    roiEl.textContent = `${roi.toFixed(4)}%`;
  },
};
