// js/ev_bets.js

import { App } from "./app.js";
import { Tracker } from "./tracker.js"; // Import the local tracker

export const EVBets = {
  state: {
    evBets: [],
  },

  init(viewElement) {
    this.view = viewElement;
    // This logic ensures the content and listeners are ready when the tab is clicked
    const evBetsTab = document.getElementById("tab-ev-bets");
    if (evBetsTab && !evBetsTab.hasAttribute('data-listener-added')) {
        evBetsTab.addEventListener("click", () => this.processAndDisplayEVBets());
        evBetsTab.setAttribute('data-listener-added', 'true');
    }
  },
  
  processAndDisplayEVBets() {
    this.calculateEVBets();
    this._populateFilters();
    this.renderEVBets();
    this.addEventListeners();
  },

  addEventListeners() {
    const controls = [
      "ev-bankroll", "ev-kelly-multiplier", "ev-book-filter", "ev-min-ev-filter",
      "ev-max-ev-filter", "ev-market-filter", "ev-min-odds-filter", "ev-max-odds-filter", "ev-search-filter",
    ];
    controls.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        const eventType = el.tagName === "SELECT" ? "change" : "input";
        el.addEventListener(eventType, () => this.renderEVBets());
      }
    });

    // Add a single, delegated event listener to the slate for all track buttons
    const slate = document.getElementById("ev-bets-slate");
    if (slate) {
        slate.addEventListener("click", (e) => {
            const trackBtn = e.target.closest(".btn-track-bet");
            if(trackBtn) {
                e.stopPropagation();
                this.handleTrackButtonClick(trackBtn);
            }
        });
    }
  },

  handleTrackButtonClick(btn) {
      // This function creates the bet object and sends it to your local tracker
      const betData = {
          teamA: btn.dataset.teamA,
          teamB: btn.dataset.teamB,
          sideName: btn.dataset.bet,
          odds: parseFloat(btn.dataset.odds),
          edge: parseFloat(btn.dataset.ev),
          stake: parseFloat(btn.dataset.stake),
          status: 'pending',
          timestamp: new Date(btn.dataset.gameTime).getTime()
      };
      
      Tracker.addBet(betData);

      btn.textContent = "Tracked!";
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-success');
      btn.disabled = true;
  },

  _populateFilters() {
    const bookSet = new Set(), marketSet = new Set();
    this.state.evBets.forEach((bet) => {
      bookSet.add(bet.book.bookmaker);
      marketSet.add(bet.marketKey);
    });

    const bookFilter = document.getElementById("ev-book-filter");
    if(bookFilter.options.length === 1) { // Only populate once
        Array.from(bookSet).sort().forEach((book) => {
            bookFilter.innerHTML += `<option value="${book}">${book}</option>`;
        });
    }

    const marketFilter = document.getElementById("ev-market-filter");
    if(marketFilter.options.length === 1) { // Only populate once
        Array.from(marketSet).sort().forEach((market) => {
            marketFilter.innerHTML += `<option value="${market}">${market.replace(/_/g, " ")}</option>`;
        });
    }
  },

  calculateEVBets() {
    this.state.evBets = [];
    const allData = [...App.state.allGameData, ...App.state.allPropData];

    allData.forEach(item => {
        const isProp = !!item.propId;
        const markets = isProp ? [item] : ['moneyline', 'spreads', 'totals'];

        markets.forEach(marketKey => {
            const lines = (isProp || marketKey === 'moneyline') ? [item] : (item[marketKey] || []);
            lines.forEach(line => {
                const consensus = line.evTabTrueOdds || line.trueOdds;
                if (!consensus || !line.bookmakerOdds) return;

                const trueProbA = App.helpers.americanToProb(consensus.oddsA);
                const trueProbB = App.helpers.americanToProb(consensus.oddsB);

                line.bookmakerOdds.forEach(book => {
                    if (book.vigOdds && book.vigOdds.oddsA != null) {
                        const evA = trueProbA * App.helpers.americanToDecimal(book.vigOdds.oddsA) - 1;
                        if (evA > 0) {
                            this.state.evBets.push({
                                type: "game", data: item, line, book, side: "A",
                                odds: book.vigOdds.oddsA, ev: evA, trueProb: trueProbA, marketKey,
                            });
                        }
                    }
                    if (book.vigOdds && book.vigOdds.oddsB != null) {
                        const evB = trueProbB * App.helpers.americanToDecimal(book.vigOdds.oddsB) - 1;
                        if (evB > 0) {
                            this.state.evBets.push({
                                type: "game", data: item, line, book, side: "B",
                                odds: book.vigOdds.oddsB, ev: evB, trueProb: trueProbB, marketKey,
                            });
                        }
                    }
                });
            });
        });
    });
  },

  renderEVBets() {
    const slate = document.getElementById("ev-bets-slate");
    const bankroll = parseFloat(document.getElementById("ev-bankroll").value) || 0;
    const kellyMultiplier = parseFloat(document.getElementById("ev-kelly-multiplier").value) || 0.5;
    const selectedBook = document.getElementById("ev-book-filter").value;
    const selectedMarket = document.getElementById("ev-market-filter").value;
    const searchTerm = document.getElementById("ev-search-filter").value.toLowerCase();
    const minEv = (parseFloat(document.getElementById("ev-min-ev-filter").value) || 0) / 100;
    const minOdds = parseFloat(document.getElementById("ev-min-odds-filter").value) || -Infinity;
    const maxOdds = parseFloat(document.getElementById("ev-max-odds-filter").value) || Infinity;

    const filteredBets = this.state.evBets.filter(bet => {
        const evCondition = bet.ev >= minEv;
        const bookCondition = selectedBook === "all" || bet.book.bookmaker === selectedBook;
        const marketCondition = selectedMarket === "all" || bet.marketKey === selectedMarket;
        const oddsCondition = bet.odds >= minOdds && bet.odds <= maxOdds;
        let searchCondition = true;
        if (searchTerm) {
            const teamA = bet.data.teamA.toLowerCase();
            const teamB = bet.data.teamB.toLowerCase();
            const player = (bet.data.player || "").toLowerCase();
            searchCondition = teamA.includes(searchTerm) || teamB.includes(searchTerm) || player.includes(searchTerm);
        }
        return evCondition && bookCondition && marketCondition && oddsCondition && searchCondition;
    });

    if (filteredBets.length === 0) {
      slate.innerHTML = `<p class="text-center text-main-secondary">No +EV bets found matching your criteria.</p>`;
      return;
    }
    
    slate.innerHTML = "";
    filteredBets.sort((a, b) => b.ev - a.ev);
    filteredBets.forEach(bet => {
      const card = this.createEVBetCard(bet, bankroll, kellyMultiplier);
      slate.appendChild(card);
    });
  },

  createEVBetCard(bet, bankroll, kellyMultiplier) {
    const card = document.createElement("div");
    card.className = "game-card p-4 rounded-lg";

    let stakeHtml = "", stakeValue = 0;
    if (bankroll > 0) {
        const p = bet.trueProb;
        const b = App.helpers.americanToDecimal(bet.odds) - 1;
        const q = 1 - p;
        if (b > 0) {
            const kellyFraction = ((b * p - q) / b) * kellyMultiplier;
            stakeValue = bankroll * kellyFraction;
            if (stakeValue > 0.01) {
                stakeHtml = `<div class="text-right"><p class="text-xl font-bold text-main-primary leading-none">$${stakeValue.toFixed(2)}</p></div>`;
            }
        }
    }

    let topHtml, bottomHtml, betDescription;
    if (bet.type === 'game') {
        const game = bet.data;
        if (bet.marketKey === "moneyline") {
            betDescription = bet.side === "A" ? game.teamA : game.teamB;
        } else if (bet.marketKey === "spreads") {
            const point = bet.side === "A" ? bet.line.point : -bet.line.point;
            const teamName = bet.side === "A" ? game.teamA : game.teamB;
            betDescription = `${teamName} ${App.helpers.formatPoint(point)}`;
        } else { // Totals
            betDescription = `${bet.side === "A" ? "Over" : "Under"} ${bet.line.point}`;
        }
        topHtml = `<p class="font-bold text-lg text-main-primary">${game.teamB} @ ${game.teamA}</p>`;
        bottomHtml = `<p class="font-bold text-lg text-accent-blue">${betDescription}</p>`;
    } else { // Prop
        const prop = bet.data;
        betDescription = `${prop.player} ${bet.side} ${prop.point}`;
        topHtml = `<p class="font-bold text-lg text-main-primary">${prop.player}</p>`;
        bottomHtml = `<p class="font-bold text-lg text-accent-blue">${betDescription}</p>`;
    }

    card.innerHTML = `
        <div class="flex justify-between items-start">
            <div class="flex-grow">${topHtml}</div>
            <div class="text-right flex-shrink-0 ml-4">
                <p class="font-semibold text-main-primary">${App.helpers.formatOdds(bet.odds)}</p>
                <p class="text-sm text-main-secondary">${bet.book.bookmaker}</p>
            </div>
        </div>
        <div class="p-3 rounded-md mt-2" style="background-color: var(--bg-secondary);">
            <div class="flex justify-between items-center">
                <div>
                    ${bottomHtml}
                    <div class="bg-green-500/20 rounded-full px-3 py-1 mt-1 inline-block">
                        <p class="font-bold text-sm text-green-400">+${(bet.ev * 100).toFixed(2)}% EV</p>
                    </div>
                </div>
                <div class="flex flex-col items-end">
                    ${stakeHtml}
                    <button class="btn btn-primary btn-sm mt-2 btn-track-bet"
                        data-team-a="${bet.data.teamA}" data-team-b="${bet.data.teamB}"
                        data-game-time="${bet.data.gameTime}" data-bet="${betDescription}"
                        data-odds="${bet.odds}" data-ev="${(bet.ev * 100).toFixed(2)}"
                        data-stake="${stakeValue.toFixed(2)}">
                        Track Bet
                    </button>
                </div>
            </div>
        </div>
    `;
    return card;
  },
};