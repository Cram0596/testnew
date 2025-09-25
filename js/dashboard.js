// js/dashboard.js

import { App } from "./app.js";
import { Tracker } from "./tracker.js";
import { OddsScreen } from "./odds_screen.js";
import { UI } from "./ui.js";

export const Dashboard = {
    state: {
        processedData: [],
        isWatchlistFilterActive: false,
    },

    init() {
        // Initial setup runs once
        this.loadAllData();
        this.addEventListeners();
    },

    addEventListeners() {
        // Centralized event listeners for dashboard controls
        const elementsToWatch = [
            App.elements.sportFilter,
            App.elements.sortBySelect,
            App.elements.watchlistFilterBtn,
            App.elements.globalBankrollInput,
            App.elements.globalKellyMultiplierInput,
        ];

        elementsToWatch.forEach(el => {
            if (el) {
                const eventType = (el.tagName === 'INPUT' || el.tagName === 'SELECT') ? 'change' : 'click';
                el.addEventListener(eventType, () => this.handleFilterOrSortChange());
            }
        });
        
        // Event delegation for dynamically created cards
        if (App.elements.gameSlate) {
            App.elements.gameSlate.addEventListener("click", (e) => {
                const starButton = e.target.closest(".watchlist-star");
                const quickTrackBtn = e.target.closest(".quick-track-btn");
                const card = e.target.closest(".game-card");

                if (starButton) {
                    this.handleWatchlistClick(starButton);
                } else if (quickTrackBtn) {
                    this.handleQuickTrack(quickTrackBtn);
                } else if (card) {
                    this.handleCardClick(card);
                }
            });
        }
    },

    handleFilterOrSortChange() {
        if (App.elements.watchlistFilterBtn) {
            this.state.isWatchlistFilterActive = App.elements.watchlistFilterBtn.classList.contains("active");
            if(event.currentTarget === App.elements.watchlistFilterBtn) {
                 this.state.isWatchlistFilterActive = !this.state.isWatchlistFilterActive;
                 App.elements.watchlistFilterBtn.classList.toggle("active", this.state.isWatchlistFilterActive);
            }
        }
        this.renderAll();
    },
    
    loadAllData() {
        App.elements.loadingSpinner.classList.add("hidden");
        
        try {
            if (App.state.allGameData.length === 0 && App.state.allPropData.length === 0) {
                throw new Error("No game data found. Please run 'node fetch-odds.js'.");
            }
            this.processData();
            this._populateFilters();
            this.renderAll();
        } catch (error) {
            if (App.elements.gameSlate) {
                App.elements.gameSlate.innerHTML = `<p class="text-center text-red-500 col-span-full">${error.message}</p>`;
            }
        }
    },

    processData() {
        // Combine and process both game and prop data into a single structure
        const combinedData = [];

        App.state.allGameData.forEach(game => {
            ['moneyline', 'spreads', 'totals'].forEach(market => {
                if (game[market]) {
                    const lines = Array.isArray(game[market]) ? game[market] : [game[market]];
                    lines.forEach(line => {
                        const metrics = this.calculateLineMetrics(line);
                        if(metrics.maxEdge > 0) {
                             combinedData.push({ ...game, market, line, ...metrics, type: 'game' });
                        }
                    });
                }
            });
        });
         this.state.processedData = combinedData;
    },

    _populateFilters() {
        const sportFilter = App.elements.sportFilter;
        if (sportFilter) {
            const allSports = [...new Set(App.state.allGameData.map(g => g.sport))];
            sportFilter.innerHTML = '<option value="all">All Sports</option>';
            allSports.forEach(sport => {
                if (sport) {
                    const option = document.createElement("option");
                    option.value = sport;
                    option.textContent = sport;
                    sportFilter.appendChild(option);
                }
            });
        }
    },

    renderAll() {
        // Master render function to update all parts of the dashboard
        const filteredData = this.getFilteredAndSortedData();

        this.renderGameSlate(filteredData);
        this.renderDashboardWidgets(filteredData);
    },

    getFilteredAndSortedData() {
        let data = [...this.state.processedData];
        const sport = App.elements.sportFilter?.value;
        const sortBy = App.elements.sortBySelect?.value;

        if (sport && sport !== 'all') {
            data = data.filter(item => item.sport === sport);
        }

        if (this.state.isWatchlistFilterActive) {
            data = data.filter(item => App.state.starredGames.includes(item.id));
        }

        if (sortBy === 'edge') {
            data.sort((a, b) => b.maxEdge - a.maxEdge);
        } else { // Default to gameTime
            data.sort((a, b) => new Date(a.gameTime) - new Date(b.gameTime));
        }
        
        return data;
    },
    
    renderGameSlate(data) {
        const slate = App.elements.gameSlate;
        if (!slate) return;
        
        slate.innerHTML = "";
        if (data.length === 0) {
            slate.innerHTML = `<p class="text-center text-main-secondary col-span-full">No games match your filters.</p>`;
            return;
        }

        data.forEach((item, index) => {
            const card = this.createCard(item);
            card.style.animationDelay = `${index * 50}ms`;
            slate.appendChild(card);
        });
    },
    
    renderDashboardWidgets(data) {
        this.renderWatchlist(data);
        this.renderTopPlays(data);
        this.renderBiggestEdges(data);
        this.renderVigHeatmap(data);
    },
    
    renderWatchlist(data) {
        const container = document.getElementById('watchlist-games');
        if (!container) return;
        container.innerHTML = `<h3 class="text-lg font-semibold text-main-primary mb-2">Watchlist Games</h3>`; // Reset
        const watchlistData = data.filter(item => App.state.starredGames.includes(item.id)).slice(0, 5);
        if(watchlistData.length === 0) {
            container.innerHTML += `<p class="text-sm text-main-secondary">No games on your watchlist.</p>`;
            return;
        }
        watchlistData.forEach(item => {
             container.innerHTML += `<p class="text-sm text-main-primary truncate">${item.teamA} vs ${item.teamB}</p>`;
        });
    },

    renderTopPlays(data) {
        const container = document.getElementById('top-plays');
        if (!container) return;
        container.innerHTML = `<h3 class="text-lg font-semibold text-main-primary mb-2">Top Plays</h3>`; // Reset

        const bankroll = parseFloat(App.elements.globalBankrollInput.value) || 0;
        const kelly = parseFloat(App.elements.globalKellyMultiplierInput.value) || 0;

        if (bankroll === 0 || kelly === 0) {
             container.innerHTML += `<p class="text-sm text-main-secondary">Enter bankroll to see plays.</p>`;
             return;
        }
        
        const plays = data.map(item => {
             const { side, stake } = this.getBestBet(item, bankroll, kelly);
             return { ...item, stake, bestSide: side };
        }).filter(item => item.stake > 0.01).sort((a, b) => b.stake - a.stake);

        if (plays.length === 0) {
            container.innerHTML += `<p class="text-sm text-main-secondary">No recommended plays found.</p>`;
            return;
        }

        plays.slice(0, 5).forEach(play => {
            const sideName = this.getSideName(play, play.bestSide);
            container.innerHTML += `<div class="flex justify-between text-sm"><p class="text-main-primary truncate">${sideName}</p><p class="font-bold text-accent-blue">$${play.stake.toFixed(2)}</p></div>`;
        });
    },

    renderBiggestEdges(data) {
        const container = document.getElementById('biggest-edges');
        if (!container) return;
        container.innerHTML = `<h3 class="text-lg font-semibold text-main-primary mb-2">Biggest Edges</h3>`; // Reset

        const topEdges = [...data].sort((a, b) => b.maxEdge - a.maxEdge).slice(0, 5);
        
        if(topEdges.length === 0) {
             container.innerHTML += `<p class="text-sm text-main-secondary">No edges found.</p>`;
             return;
        }

        topEdges.forEach(item => {
            const { side } = this.getBestBet(item, 1, 1);
            const sideName = this.getSideName(item, side);
            container.innerHTML += `<div class="flex justify-between text-sm"><p class="text-main-primary truncate">${sideName}</p><p class="font-bold text-green-500">+${(item.maxEdge * 100).toFixed(2)}%</p></div>`;
        });
    },
    
    renderVigHeatmap(data) {
         const container = document.getElementById('vig-heatmap');
         if (!container) return;
         container.innerHTML = `<h3 class="text-lg font-semibold text-main-primary mb-2">Vig Heatmap</h3>`; // Reset
         
         container.innerHTML += `<p class="text-sm text-main-secondary">Vig data not available.</p>`;
    },


    createCard(item) {
        const card = document.createElement("div");
        card.className = "game-card rounded-lg p-4 flex flex-col space-y-3 card-fade-in";
        card.dataset.id = item.id;
        card.dataset.item = JSON.stringify(item);
        
        const logoA = App.helpers.getTeamLogoPath(item.teamA, item.sport);
        const logoB = App.helpers.getTeamLogoPath(item.teamB, item.sport);
        const isStarred = App.state.starredGames.includes(item.id);

        card.innerHTML = `
            <div class="flex justify-between items-center">
                <div class="flex items-center space-x-2">
                    <img src="${logoA}" class="h-10 w-10 object-contain">
                    <p class="font-bold text-main-primary">${item.teamA}</p>
                </div>
                <p class="text-sm text-main-secondary">vs</p>
                <div class="flex items-center space-x-2">
                    <p class="font-bold text-main-primary">${item.teamB}</p>
                    <img src="${logoB}" class="h-10 w-10 object-contain">
                </div>
                 <button class="watchlist-star ${isStarred ? 'active' : ''}" data-game-id="${item.id}">
                    <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.975-2.888a1 1 0 00-1.176 0l-3.975-2.888c-.784.57-1.838-.196-1.539-1.118l1.518-4.674a1 1 0 00-.364-1.118L2.48 9.4c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.95-.69l1.519-4.674z"></path></svg>
                </button>
            </div>
            <div class="text-center">
                <p class="text-sm text-main-secondary">${new Date(item.gameTime).toLocaleString()}</p>
            </div>
            <div class="market-line-item p-3 rounded-md">
                <div class="flex justify-between items-center">
                    <span class="font-bold text-main-primary side-a-name">${this.getSideName(item, 'A')}</span>
                    <span class="text-main-primary side-a-prob">${(item.trueProbA * 100).toFixed(1)}%</span>
                </div>
                <div class="flex justify-between items-center mt-1">
                    <span class="font-bold text-main-primary side-b-name">${this.getSideName(item, 'B')}</span>
                    <span class="text-main-primary side-b-prob">${(item.trueProbB * 100).toFixed(1)}%</span>
                </div>
                <div class="recommendation-container"></div>
            </div>`;

        this.updateCardDisplay(card);
        return card;
    },
    
    updateCardDisplay(card) {
        const item = JSON.parse(card.dataset.item);
        const bankroll = parseFloat(App.elements.globalBankrollInput.value);
        const kellyMultiplier = parseFloat(App.elements.globalKellyMultiplierInput.value);
        const recContainer = card.querySelector(".recommendation-container");

        if (!recContainer || isNaN(bankroll) || bankroll <= 0 || isNaN(kellyMultiplier) || kellyMultiplier <= 0) {
            if (recContainer) recContainer.innerHTML = "";
            return;
        }

        const { side, stake, odds, edge } = this.getBestBet(item, bankroll, kellyMultiplier);

        if (stake > 0.01) {
            const sideName = this.getSideName(item, side);
            recContainer.innerHTML = `<div class="mt-2 border-t border-border-primary pt-2 flex items-center justify-between">
                <div>
                    <p class="font-bold text-sm text-accent-blue">${sideName}</p>
                    <p class="text-xs text-green-500">+${(edge * 100).toFixed(2)}% EV</p>
                </div>
                <div class="text-right">
                     <p class="text-xl font-bold text-main-primary leading-none">$${stake.toFixed(2)}</p>
                     <button class="quick-track-btn btn btn-primary btn-sm mt-1">Track</button>
                </div>
            </div>`;
        } else {
            recContainer.innerHTML = "";
        }
    },

    getBestBet(item, bankroll, kellyMultiplier) {
        let bestBet = { side: null, stake: 0, odds: 0, edge: 0 };
        
        if (item.edgeA > 0) {
            const p = item.trueProbA;
            const q = 1 - p;
            const b = App.helpers.americanToDecimal(item.line.marketOdds.oddsA) - 1;
            if (b > 0) {
                const kellyFraction = ((b * p - q) / b) * kellyMultiplier;
                const stake = bankroll * kellyFraction;
                if(stake > bestBet.stake) {
                    bestBet = { side: 'A', stake, odds: item.line.marketOdds.oddsA, edge: item.edgeA };
                }
            }
        }
        
        if (item.edgeB > 0) {
            const p = item.trueProbB;
            const q = 1 - p;
            const b = App.helpers.americanToDecimal(item.line.marketOdds.oddsB) - 1;
            if (b > 0) {
                const kellyFraction = ((b * p - q) / b) * kellyMultiplier;
                const stake = bankroll * kellyFraction;
                 if(stake > bestBet.stake) {
                    bestBet = { side: 'B', stake, odds: item.line.marketOdds.oddsB, edge: item.edgeB };
                }
            }
        }
        return bestBet;
    },
    
    getSideName(item, side) {
        if (item.market === 'moneyline') {
            return side === 'A' ? item.teamA : item.teamB;
        } else if (item.market === 'spreads') {
            const point = side === 'A' ? item.line.point : -item.line.point;
            const team = side === 'A' ? item.teamA : item.teamB;
            return `${team} ${App.helpers.formatPoint(point)}`;
        } else if (item.market === 'totals') {
            return `${side === 'A' ? 'Over' : 'Under'} ${item.line.point}`;
        }
        return 'N/A';
    },

    calculateLineMetrics(line) {
        if (!line.trueOdds || !line.marketOdds) return { maxEdge: -1 };
        const trueProbA = App.helpers.americanToProb(line.trueOdds.oddsA);
        const marketProbA = App.helpers.americanToProb(line.marketOdds.oddsA);
        const edgeA = trueProbA - marketProbA;

        const trueProbB = App.helpers.americanToProb(line.trueOdds.oddsB);
        const marketProbB = App.helpers.americanToProb(line.marketOdds.oddsB);
        const edgeB = trueProbB - marketProbB;
        
        return { edgeA, edgeB, maxEdge: Math.max(edgeA, edgeB), trueProbA, trueProbB };
    },
    
    handleWatchlistClick(starButton) {
        const gameId = starButton.dataset.gameId;
        const isStarred = App.state.starredGames.includes(gameId);

        if (isStarred) {
            App.state.starredGames = App.state.starredGames.filter(id => id !== gameId);
            starButton.classList.remove("active");
        } else {
            App.state.starredGames.push(gameId);
            starButton.classList.add("active");
        }
        localStorage.setItem("starredGames", JSON.stringify(App.state.starredGames));
        if(this.state.isWatchlistFilterActive) this.renderAll();
    },

    handleQuickTrack(trackButton) {
        const card = trackButton.closest('.game-card');
        const item = JSON.parse(card.dataset.item);
        const bankroll = parseFloat(App.elements.globalBankrollInput.value);
        const kellyMultiplier = parseFloat(App.elements.globalKellyMultiplierInput.value);
        const {side, stake, odds, edge} = this.getBestBet(item, bankroll, kellyMultiplier);

        const betData = {
            teamA: item.teamA,
            teamB: item.teamB,
            sideName: this.getSideName(item, side),
            odds: odds,
            edge: edge,
            stake: stake,
            status: 'pending',
            timestamp: new Date(item.gameTime).getTime()
        };
        
        Tracker.addBet(betData);
    },

    handleCardClick(card) {
        const item = JSON.parse(card.dataset.item);
        OddsScreen.showById(item.id, item.market, false);
        UI.activateTab(document.getElementById("tab-odds-screen"));
    }
};

