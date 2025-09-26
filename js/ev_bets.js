// js/ev_bets.js

import { App } from "./app.js";
import { Tracker } from "./tracker.js";

export const EVBets = {
  state: {
    evBets: [],
    modalSortConfig: { column: "bookmaker", direction: "asc" },
  },

  init(viewElement) {
      this.view = viewElement;
      this.processAndDisplayEVBets();
  },

  processAndDisplayEVBets() {
    this.state.evBets = this.calculateEVBets();
    this.renderEVBets();
    this.addEventListeners();
  },
  
  addEventListeners() {
    const controls = [
      "ev-bankroll",
      "ev-kelly-multiplier",
      "ev-book-filter",
      "ev-min-ev-filter",
      "ev-max-ev-filter",
      "ev-market-filter",
      "ev-search-filter",
    ];
    controls.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        const eventType = el.tagName === 'INPUT' && el.type === 'text' ? 'input' : 'change';
        el.addEventListener(eventType, () => this.renderEVBets());
      }
    });

    const slate = document.getElementById("ev-bets-slate");
    if (slate) {
      slate.addEventListener("click", (e) => {
        const trackBtn = e.target.closest(".btn-track-bet");
        if (trackBtn) {
            e.stopPropagation();
            this.handleTrackButtonClick(trackBtn);
        }
      });
    }
  },

  handleTrackButtonClick(btn) {
    const betData = {
      teamA: btn.dataset.teamA,
      teamB: btn.dataset.teamB,
      sideName: btn.dataset.bet,
      odds: parseFloat(btn.dataset.odds),
      edge: parseFloat(btn.dataset.ev),
      stake: parseFloat(btn.dataset.stake),
      status: "pending",
      timestamp: new Date(btn.dataset.gameTime).getTime(),
    };
    
    // **FIXED**: This now correctly calls the main tracker module
    Tracker.addBet(betData);

    btn.textContent = "Tracked!";
    btn.classList.remove("btn-primary");
    btn.classList.add("btn-success"); // Changed for better visual feedback
    btn.disabled = true;
  },

  calculateEVBets() {
    const allData = [...App.state.allGameData, ...App.state.allPropData];
    const evBets = [];

    allData.forEach(item => {
        const isProp = !!item.propId;
        const markets = isProp ? [item.market] : ['moneyline', 'spreads', 'totals'];

        markets.forEach(marketKey => {
            const lines = (isProp || marketKey === 'moneyline') ? [item] : item[marketKey] || [];
            lines.forEach(line => {
                if(!line.marketOdds) return;
                const sides = isProp ? ['over', 'under'] : ['oddsA', 'oddsB'];
                sides.forEach(sideKey => {
                    const odds = line.marketOdds[sideKey];
                    if (odds === null) return;
                    
                    const trueOddsKey = isProp ? `trueOdds_${sideKey}` : (sideKey === 'oddsA' ? 'oddsA' : 'oddsB');
                    const trueOdds = line.trueOdds ? line.trueOdds[trueOddsKey] : null;
                    if(trueOdds === null) return;

                    const marketProb = App.helpers.americanToProb(odds);
                    const trueProb = App.helpers.americanToProb(trueOdds);
                    const ev = trueProb - marketProb;

                    if (ev > 0) {
                        evBets.push({
                            ev,
                            trueProb,
                            odds,
                            book: { bookmaker: line.bookmaker, lastUpdate: line.lastUpdate },
                            marketKey,
                            data: item,
                            line: isProp ? null : line,
                            side: isProp ? (sideKey === 'over' ? 'Over' : 'Under') : (sideKey === 'oddsA' ? 'A' : 'B'),
                            type: isProp ? 'prop' : 'game'
                        });
                    }
                });
            });
        });
    });
    return evBets;
  },

  renderEVBets() {
    const slate = document.getElementById("ev-bets-slate");
    if (!slate) return;
    
    const bankroll = parseFloat(document.getElementById('ev-bankroll')?.value) || Tracker.state.availableBankroll;
    document.getElementById('ev-bankroll').value = bankroll.toFixed(2);
    
    const kellyMultiplier = parseFloat(document.getElementById("ev-kelly-multiplier")?.value) || 0.5;
    const selectedBook = document.getElementById("ev-book-filter")?.value;
    const minEv = (parseFloat(document.getElementById("ev-min-ev-filter")?.value) || 0) / 100;
    const maxEvInput = document.getElementById("ev-max-ev-filter");
    const maxEv = maxEvInput?.value ? parseFloat(maxEvInput.value) / 100 : Infinity;
    const selectedMarket = document.getElementById("ev-market-filter")?.value;
    const searchTerm = document.getElementById("ev-search-filter")?.value.toLowerCase();

    const filteredBets = this.state.evBets.filter(bet => {
        const evCondition = bet.ev >= minEv && bet.ev <= maxEv;
        const bookCondition = selectedBook === "all" || bet.book.bookmaker === selectedBook;
        const marketCondition = selectedMarket === "all" || bet.marketKey === selectedMarket;
        let searchCondition = true;
        if (searchTerm) {
            const teamA = bet.data.teamA.toLowerCase();
            const teamB = bet.data.teamB.toLowerCase();
            const player = (bet.data.player || "").toLowerCase();
            searchCondition = teamA.includes(searchTerm) || teamB.includes(searchTerm) || player.includes(searchTerm);
        }
        return evCondition && bookCondition && marketCondition && searchCondition;
    });

    if (filteredBets.length === 0) {
      slate.innerHTML = `<p class="text-center text-main-secondary col-span-full">No +EV bets found matching your criteria.</p>`;
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
    card.dataset.id = bet.type === "prop" ? bet.data.propId : bet.data.id;
    card.dataset.market = bet.marketKey;
    card.dataset.isProp = bet.type === "prop";
    card.dataset.point = bet.type === 'game' && bet.line ? bet.line.point : bet.data.point;

    const logoSrc = `images/logos/${bet.book.bookmaker}.png`;

    let stakeHtml = "", stakeValue = 0;
    if (bankroll > 0) {
        const p = bet.trueProb;
        const q = 1 - p;
        const b = App.helpers.americanToDecimal(bet.odds) - 1;
        if (b > 0) {
            const kellyFraction = ((b * p - q) / b) * kellyMultiplier;
            stakeValue = bankroll * kellyFraction;
            if (stakeValue > 0.01) {
                stakeHtml = `<div class="text-right">
                    <p class="text-xl font-bold text-main-primary leading-none">$${stakeValue.toFixed(2)}</p>
                    <p class="text-xs text-main-secondary leading-none">(${(kellyFraction * 100).toFixed(2)}% Kelly)</p>
                </div>`;
            }
        }
    }
    
    let topHtml, bottomHtml, betDescription;
    if (bet.type === "prop") {
      const prop = bet.data;
      const propMarketName = prop.market.replace("player_", "").replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
      topHtml = `<p class="font-bold text-lg text-main-primary">${prop.player}</p><p class="text-sm text-main-secondary">${prop.teamB} @ ${prop.teamA}</p>`;
      betDescription = `${bet.side} ${prop.point} ${propMarketName}`;
      bottomHtml = `<p class="font-bold text-lg text-accent-blue">${betDescription}</p>`;
    } else {
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
      topHtml = `<p class="font-bold text-lg text-main-primary">${game.teamB} @ ${game.teamA}</p><p class="text-sm text-main-secondary">${game.sport}</p>`;
      bottomHtml = `<p class="font-bold text-lg text-accent-blue">${betDescription}</p>`;
    }

    card.innerHTML = `
        <div class="flex justify-between items-start">
            <div class="flex-grow">${topHtml}</div>
            <div class="text-right flex-shrink-0 ml-4 flex items-center space-x-3">
                <div>
                    <p class="font-semibold text-main-primary">${App.helpers.formatOdds(bet.odds)}</p>
                    <p class="text-sm text-main-secondary">${bet.book.bookmaker}</p>
                </div>
                <img src="${logoSrc}" alt="${bet.book.bookmaker}" class="h-10 w-10 object-contain rounded-md" onerror="this.style.display='none'">
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
                    ${stakeValue > 0.01 ? `<button class="btn btn-primary btn-sm mt-2 btn-track-bet"
                        data-team-a="${bet.data.teamA}"
                        data-team-b="${bet.data.teamB}"
                        data-game-time="${bet.data.gameTime}"
                        data-bet="${betDescription}"
                        data-odds="${bet.odds}"
                        data-ev="${(bet.ev * 100).toFixed(2)}"
                        data-stake="${stakeValue.toFixed(2)}">
                        Track Bet
                    </button>` : ''}
                </div>
            </div>
        </div>`;
    return card;
  },
};