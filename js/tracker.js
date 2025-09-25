// js/tracker.js

import { App } from "./app.js";

export const Tracker = {
  state: {
    loggedBets: [],
    currentBetToLog: null,
    initialBankroll: 1000,
    availableBankroll: 1000,
  },

  init() {
    this.state.loggedBets =
      JSON.parse(localStorage.getItem("loggedBets")) || [];
    const savedBankroll = localStorage.getItem('initialBankroll');
    if (savedBankroll) {
        this.state.initialBankroll = parseFloat(savedBankroll);
    }
    
    // Setup Download Button
    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Download Bets (CSV)';
    downloadBtn.className = 'btn btn-secondary btn-sm';
    downloadBtn.addEventListener('click', () => this.downloadBets());
    document.getElementById('refresh-tracker-btn').insertAdjacentElement('afterend', downloadBtn);


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
  
  addBet(betData) {
      const newBet = {
          id: Date.now(),
          ...betData
      };
      this.state.loggedBets.unshift(newBet);
      localStorage.setItem("loggedBets", JSON.stringify(this.state.loggedBets));
      this.renderPerformanceTracker();
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
    // ... (This function remains the same)
  },

  saveTrackedBet() {
    // ... (This function remains the same)
  },

  gradeBet(betId, result) {
    // ... (This function remains the same)
  },

  _renderTrackerUI(listElement, bets, recordEl, plEl, roiEl) {
    // ... (This function is modified to update availableBankroll)
    if (!listElement || !recordEl || !plEl || !roiEl) return;
    listElement.innerHTML = "";
    let wins = 0,
      losses = 0,
      pushes = 0,
      totalWagered = 0,
      totalProfit = 0,
      inPlay = 0;

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

      if (teamInfoEl) teamInfoEl.textContent = `${bet.teamB} @ ${bet.teamA}`;
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
          let statusClass = "text-main-secondary"; 
          if (bet.status === "win") statusClass = "text-green-500";
          if (bet.status === "loss") statusClass = "text-red-500";
          statusContainer.innerHTML = `<span class="font-bold ${statusClass}">${bet.status.toUpperCase()}</span>`;
        }
      }

      if (bet.status === "pending") {
          inPlay += bet.stake;
      } else {
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
    roiEl.textContent = `${roi.toFixed(2)}%`;
    
    const totalBankroll = this.state.initialBankroll + totalProfit;
    this.state.availableBankroll = totalBankroll - inPlay;
    document.getElementById('tracker-total-bankroll').textContent = `$${totalBankroll.toFixed(2)}`;
    document.getElementById('tracker-in-play').textContent = `$${inPlay.toFixed(2)}`;
    document.getElementById('tracker-available').textContent = `$${this.state.availableBankroll.toFixed(2)}`;

  },
  
  downloadBets() {
    const bets = this.state.loggedBets;
    if (bets.length === 0) {
      alert("No bets to download.");
      return;
    }
    const header = Object.keys(bets[0]).join(',');
    const csv = bets.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
    const csvContent = `data:text/csv;charset=utf-8,${header}\n${csv}`;
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "my_bets.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};