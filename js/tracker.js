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
    
    const initialBankrollInput = document.getElementById('initial-bankroll-input');
    if (initialBankrollInput) {
        initialBankrollInput.value = this.state.initialBankroll;
        initialBankrollInput.addEventListener('change', () => {
            this.state.initialBankroll = parseFloat(initialBankrollInput.value) || 0;
            localStorage.setItem('initialBankroll', this.state.initialBankroll);
            this.renderPerformanceTracker();
        });
    }

    // Create and set up the Download and Upload buttons
    this.setupActionButtons();

    this.renderPerformanceTracker();

    if(App.elements.modalSaveBtn) {
        App.elements.modalSaveBtn.addEventListener("click", () =>
          this.saveTrackedBet()
        );
    }
    if(App.elements.modalCancelBtn) {
        App.elements.modalCancelBtn.addEventListener("click", () =>
          App.elements.logPlayModal.classList.add("hidden")
        );
    }
    
    if (App.elements.trackedPlaysList) {
        App.elements.trackedPlaysList.addEventListener("click", (e) => {
          const gradeBtn = e.target.closest(".grade-btn");
          const deleteBtn = e.target.closest(".delete-btn");

          if (gradeBtn) {
            const betId = parseInt(gradeBtn.dataset.id);
            const result = gradeBtn.dataset.result;
            this.gradeBet(betId, result);
          } else if (deleteBtn) {
            const betId = parseInt(deleteBtn.dataset.id);
            this.deleteBet(betId);
          }
        });
    }
  },

  setupActionButtons() {
    const refreshBtn = document.getElementById('refresh-tracker-btn');
    if (!refreshBtn) return;

    // Create Download Button
    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Download Bets (CSV)';
    downloadBtn.className = 'btn btn-secondary btn-sm ml-2';
    downloadBtn.addEventListener('click', () => this.downloadBets());
    refreshBtn.insertAdjacentElement('afterend', downloadBtn);

    // Create Upload Button
    const uploadBtn = document.createElement('button');
    uploadBtn.textContent = 'Upload Bets (CSV)';
    uploadBtn.className = 'btn btn-secondary btn-sm ml-2';
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv';
    fileInput.style.display = 'none';

    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    
    downloadBtn.insertAdjacentElement('afterend', uploadBtn);
    downloadBtn.insertAdjacentElement('afterend', fileInput);
  },
  
  handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
          const text = e.target.result;
          const bets = this.parseCSV(text);
          if (bets) {
              this.state.loggedBets = bets;
              localStorage.setItem("loggedBets", JSON.stringify(this.state.loggedBets));
              this.renderPerformanceTracker();
              alert('Bets uploaded successfully!');
          } else {
              alert('Failed to parse CSV. Please check the file format.');
          }
      };
      reader.readAsText(file);
      event.target.value = ''; // Reset file input
  },

  parseCSV(text) {
      try {
        const lines = text.trim().split('\n');
        const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const bets = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            let betObject = {};
            header.forEach((key, index) => {
                const value = values[index];
                // Convert numeric strings to numbers
                betObject[key] = !isNaN(parseFloat(value)) && isFinite(value) ? parseFloat(value) : value;
            });
            return betObject;
        });
        return bets;
      } catch (error) {
          console.error("CSV Parsing Error:", error);
          return null;
      }
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
  
  deleteBet(betId) {
    this.state.loggedBets = this.state.loggedBets.filter(bet => bet.id !== betId);
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

  gradeBet(betId, result) {
    const betIndex = this.state.loggedBets.findIndex(bet => bet.id === betId);
    if (betIndex !== -1) {
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
      totalProfit = 0,
      inPlay = 0;

    const sortedBets = [...bets].sort((a, b) => b.timestamp - a.timestamp);

    if (sortedBets.length === 0) {
      listElement.innerHTML =
        '<p class="text-center text-main-secondary">No bets tracked yet.</p>';
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
            <button class="grade-btn btn-danger btn-sm" data-id="${bet.id}" data-result="loss">Loss</button>
            <button class="delete-btn btn btn-danger btn-sm" data-id="${bet.id}">🗑️</button>`;
        } else {
          let statusClass = "text-main-secondary"; 
          if (bet.status === "win") statusClass = "text-green-500";
          if (bet.status === "loss") statusClass = "text-red-500";
          statusContainer.innerHTML = `<span class="font-bold ${statusClass}">${bet.status.toUpperCase()}</span>
           <button class="delete-btn btn btn-danger btn-sm" data-id="${bet.id}">🗑️</button>`;
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
    
    const totalBankrollEl = document.getElementById('tracker-total-bankroll');
    const inPlayEl = document.getElementById('tracker-in-play');
    const availableEl = document.getElementById('tracker-available');
    
    if (totalBankrollEl) totalBankrollEl.textContent = `$${totalBankroll.toFixed(2)}`;
    if (inPlayEl) inPlayEl.textContent = `$${inPlay.toFixed(2)}`;
    if (availableEl) {
        availableEl.textContent = `$${this.state.availableBankroll.toFixed(2)}`;
        availableEl.classList.toggle('text-green-500', this.state.availableBankroll >= 0);
        availableEl.classList.toggle('text-red-500', this.state.availableBankroll < 0);
    }

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
