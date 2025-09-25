// js/ev_bets.js

import { App } from "./app.js";

export const EVBets = {
  state: {
    evBets: [],
    modalSortConfig: { column: "bookmaker", direction: "asc" },
  },

  init() {
    // This new logic manages the member selector
    const memberSelector = document.getElementById("member-selector");
    if (memberSelector) {
      const savedMember = localStorage.getItem("selectedMember");
      if (savedMember) {
        memberSelector.value = savedMember;
      }
      memberSelector.addEventListener("change", () => {
        localStorage.setItem("selectedMember", memberSelector.value);
      });
    }

    const evBetsTab = document.getElementById("tab-ev-bets");
    if (evBetsTab) {
      evBetsTab.addEventListener(
        "click",
        () => this.processAndDisplayEVBets(),
        {
          once: true,
        }
      );
    }
    const controls = [
      "ev-bankroll",
      "ev-kelly-multiplier",
      "ev-book-filter",
      "ev-min-ev-filter",
      "ev-max-ev-filter",
      "ev-market-filter",
    ];
    controls.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("change", () => this.renderEVBets());
    });
    const searchInput = document.getElementById("ev-search-filter");
    if (searchInput) {
      searchInput.addEventListener("input", () => this.renderEVBets());
    }
    const slate = document.getElementById("ev-bets-slate");
    if (slate) {
      slate.addEventListener("click", (e) => {
        const card = e.target.closest(".game-card");
        // Ensure the modal doesn't open if the track button is clicked
        if (card && card.dataset.id && !e.target.closest(".btn-track-sheet")) {
          this.handleEVCardClick(card);
        }
      });
    }
  },

  handleEVCardClick(card) {
    const id = card.dataset.id;
    const marketType = card.dataset.market;
    const isProp = card.dataset.isProp === "true";
    const point = parseFloat(card.dataset.point);
    const item = isProp
      ? App.state.allPropData.find((p) => p.propId === id)
      : App.state.allGameData.find((g) => g.id === id);
    if (!item) return;
    let lineData;
    if (isProp || marketType === "moneyline") {
      lineData = item;
    } else {
      lineData = item[marketType]?.find((l) => l.point === point);
    }
    if (lineData) {
      this.showOddsModal(item, lineData, marketType, isProp);
    }
  },

  showOddsModal(item, lineData, marketType, isProp) {
    const modal = document.getElementById("odds-modal");
    const titleEl = document.getElementById("odds-modal-title");
    const subtitleEl = document.getElementById("odds-modal-subtitle");
    const tableContainer = document.getElementById(
      "odds-modal-table-container"
    );
    const closeBtn = document.getElementById("odds-modal-close-btn");
    const vigToggle = document.getElementById("modal-vig-free-toggle");

    this.state.modalSortConfig = { column: "bookmaker", direction: "asc" };
    vigToggle.checked = false;

    if (isProp) {
      titleEl.textContent = item.player;
      const marketName = marketType
        .replace(/player_|_over_under/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase())
        .trim();
      subtitleEl.textContent = `${marketName} (${item.point}) - ${item.teamB} @ ${item.teamA}`;
    } else {
      titleEl.textContent = `${item.teamB} @ ${item.teamA}`;
      const marketName =
        marketType.charAt(0).toUpperCase() + marketType.slice(1);
      const pointText =
        marketType !== "moneyline" ? ` (${lineData.point})` : "";
      subtitleEl.textContent = `${marketName}${pointText}`;
    }

    const renderTable = () => {
      tableContainer.innerHTML = this._buildOddsComparisonTable(
        item,
        lineData,
        marketType,
        isProp
      );
    };
    renderTable();

    const vigToggleListener = () => renderTable();
    vigToggle.addEventListener("change", vigToggleListener);

    const sortListener = (e) => {
      const header = e.target.closest(".sortable-header");
      if (header) {
        const column = header.dataset.sort;
        const { modalSortConfig } = this.state;
        let direction = "desc";
        if (modalSortConfig.column === column) {
          direction = modalSortConfig.direction === "asc" ? "desc" : "asc";
        } else if (column === "bookmaker") {
          direction = "asc";
        }
        this.state.modalSortConfig = { column, direction };
        renderTable();
      }
    };
    tableContainer.addEventListener("click", sortListener);

    modal.classList.remove("hidden");
    const closeModal = () => {
      modal.classList.add("hidden");
      vigToggle.removeEventListener("change", vigToggleListener);
      tableContainer.removeEventListener("click", sortListener);
    };
    closeBtn.addEventListener("click", closeModal, { once: true });
    modal.addEventListener(
      "click",
      (e) => {
        if (e.target === modal) closeModal();
      },
      { once: true }
    );
  },

  _buildOddsComparisonTable(item, lineData, marketType, isProp) {
    const bookmakerData = lineData?.bookmakerOdds || [];
    const showVigFree = document.getElementById(
      "modal-vig-free-toggle"
    ).checked;
    const { modalSortConfig } = this.state;

    let bestDecimalA = 0,
      bestDecimalB = 0;
    bookmakerData.forEach((book) => {
      const odds =
        showVigFree && book.trueOdds
          ? book.trueOdds
          : book.vigOdds || book.odds;
      if (!odds) return;
      const oddsA = odds.oddsA !== undefined ? odds.oddsA : odds.over;
      const oddsB = odds.oddsB !== undefined ? odds.oddsB : odds.under;
      if (oddsA !== null) {
        const decA = App.helpers.americanToDecimal(oddsA);
        if (decA > bestDecimalA) bestDecimalA = decA;
      }
      if (oddsB !== null) {
        const decB = App.helpers.americanToDecimal(oddsB);
        if (decB > bestDecimalB) bestDecimalB = decB;
      }
    });

    const getSortValue = (book, column) => {
      if (column === "bookmaker") return book.bookmaker;
      const oddsData = showVigFree ? book.trueOdds : book.vigOdds;
      if (!oddsData) return null;
      let americanOdds;
      if (column === "sideA") {
        americanOdds =
          oddsData.oddsA !== undefined ? oddsData.oddsA : oddsData.over;
      } else {
        americanOdds =
          oddsData.oddsB !== undefined ? oddsData.oddsB : oddsData.under;
      }
      return americanOdds !== null
        ? App.helpers.americanToDecimal(americanOdds)
        : null;
    };

    const sortedBooks = [...bookmakerData].sort((a, b) => {
      let valA = getSortValue(a, modalSortConfig.column);
      let valB = getSortValue(b, modalSortConfig.column);
      if (valA == null)
        valA = modalSortConfig.direction === "asc" ? Infinity : -Infinity;
      if (valB == null)
        valB = modalSortConfig.direction === "asc" ? Infinity : -Infinity;
      if (valA < valB) return modalSortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return modalSortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    const getSortIndicator = (column) =>
      modalSortConfig.column === column
        ? modalSortConfig.direction === "asc"
          ? " ▲"
          : " ▼"
        : "";
    let headerA, headerB;

    if (isProp) {
      headerA = `Over ${item.point}`;
      headerB = `Under ${item.point}`;
    } else {
      if (marketType === "moneyline") {
        headerA = item.teamA;
        headerB = item.teamB;
      } else if (marketType === "spreads") {
        headerA = `${item.teamA} ${App.helpers.formatPoint(lineData.point)}`;
        headerB = `${item.teamB} ${App.helpers.formatPoint(-lineData.point)}`;
      } else {
        headerA = `Over ${lineData.point}`;
        headerB = `Under ${lineData.point}`;
      }
    }

    const rowsHTML = sortedBooks
      .map((book) =>
        this._createOddsTableRow(book, showVigFree, bestDecimalA, bestDecimalB)
      )
      .join("");

    return `<table class="w-full text-left table-auto border-collapse odds-table">
                <thead>
                    <tr>
                        <th class="p-2 w-1/3 text-sm font-semibold text-main-secondary sortable-header cursor-pointer" data-sort="bookmaker">Bookmaker${getSortIndicator(
                          "bookmaker"
                        )}</th>
                        <th class="p-2 w-1/3 text-sm font-semibold text-main-secondary text-center sortable-header cursor-pointer" data-sort="sideA">${headerA}${getSortIndicator(
      "sideA"
    )}</th>
                        <th class="p-2 w-1/3 text-sm font-semibold text-main-secondary text-center sortable-header cursor-pointer" data-sort="sideB">${headerB}${getSortIndicator(
      "sideB"
    )}</th>
                    </tr>
                </thead>
                <tbody>${rowsHTML}</tbody>
            </table>`;
  },

  _createOddsTableRow(book, showVigFree, bestDecimalA, bestDecimalB) {
    const oddsToDisplay =
      showVigFree && book.trueOdds ? book.trueOdds : book.vigOdds;
    if (!oddsToDisplay) return "";
    const oddsA =
      oddsToDisplay.oddsA !== undefined
        ? oddsToDisplay.oddsA
        : oddsToDisplay.over;
    const oddsB =
      oddsToDisplay.oddsB !== undefined
        ? oddsToDisplay.oddsB
        : oddsToDisplay.under;
    if (oddsA == null && oddsB == null) return "<tr><td colspan='3'></td></tr>"; // Return empty row

    const decA = oddsA !== null ? App.helpers.americanToDecimal(oddsA) : 0;
    const decB = oddsB !== null ? App.helpers.americanToDecimal(oddsB) : 0;
    const isBestA =
      Math.abs(decA - bestDecimalA) < 0.0001 ? "best-odds-highlight" : "";
    const isBestB =
      Math.abs(decB - bestDecimalB) < 0.0001 ? "best-odds-highlight" : "";

    let vigText = "Vig: --";
    if (
      !showVigFree &&
      book.vigOdds &&
      book.vigOdds.oddsA != null &&
      book.vigOdds.oddsB != null
    ) {
      const vig = App.helpers.calculateVig(
        book.vigOdds.oddsA,
        book.vigOdds.oddsB
      );
      vigText = `Vig: ${(vig * 100).toFixed(4)}%`;
    }

    const sharpIndicator =
      book.type === "sharp"
        ? '<span class="text-xs text-accent-red font-bold" title="Sharp Bookmaker"> S</span>'
        : "";
    const logoSrc = `images/logos/${book.bookmaker}.png`;
    const oddsAHTML =
      oddsA != null
        ? App.helpers.formatOdds(oddsA)
        : '<span class="text-main-secondary">-</span>';
    const oddsBHTML =
      oddsB != null
        ? App.helpers.formatOdds(oddsB)
        : '<span class="text-main-secondary">-</span>';

    return `<tr class="border-b border-border-primary">
                <td class="p-3 text-main-primary font-medium">
                    <div class="flex items-center space-x-3">
                        <img src="${logoSrc}" alt="${book.bookmaker}" class="h-8 w-8 object-contain" onerror="this.style.display='none'">
                        <div>
                            <span>${book.bookmaker}${sharpIndicator}</span>
                            <span class="block text-xs text-main-secondary">${vigText}</span>
                        </div>
                    </div>
                </td>
                <td class="p-3 text-center ${isBestA}"><span class="font-bold text-lg text-main-primary">${oddsAHTML}</span></td>
                <td class="p-3 text-center ${isBestB}"><span class="font-bold text-lg text-main-primary">${oddsBHTML}</span></td>
            </tr>`;
  },

  processAndDisplayEVBets() {
    const slate = document.getElementById("ev-bets-slate");
    slate.innerHTML = `<p class="text-main-secondary text-center">Scanning all markets for +EV bets...</p>`;
    try {
      this.calculateEVBets();
      this._populateFilters();
      this.renderEVBets();
    } catch (err) {
      console.error(err);
      slate.innerHTML = `<p class="text-center text-red-500">${err.message}</p>`;
    }
  },
  _populateFilters() {
    const bookSet = new Set(),
      marketSet = new Set();
    this.state.evBets.forEach((bet) => {
      bookSet.add(bet.book.bookmaker);
      marketSet.add(bet.marketKey);
    });
    const bookFilter = document.getElementById("ev-book-filter");
    bookFilter.innerHTML = '<option value="all">All Books</option>';
    Array.from(bookSet)
      .sort()
      .forEach((book) => {
        bookFilter.innerHTML += `<option value="${book}">${book}</option>`;
      });
    const marketFilter = document.getElementById("ev-market-filter");
    marketFilter.innerHTML = '<option value="all">All Markets</option>';
    Array.from(marketSet)
      .sort()
      .forEach((market) => {
        marketFilter.innerHTML += `<option value="${market}">${market.replace(
          /_/g,
          " "
        )}</option>`;
      });
  },
  calculateEVBets() {
    this.state.evBets = [];
    App.state.allPropData.forEach((prop) => {
      if (!prop.trueOdds || !prop.bookmakerOdds) return;
      const trueProbOver = App.helpers.americanToProb(prop.trueOdds.over);
      const trueProbUnder = App.helpers.americanToProb(prop.trueOdds.under);
      prop.bookmakerOdds.forEach((book) => {
        if (book.vigOdds && book.vigOdds.over != null) {
          const evOver =
            trueProbOver * App.helpers.americanToDecimal(book.vigOdds.over) - 1;
          this.state.evBets.push({
            type: "prop",
            data: prop,
            book,
            side: "Over",
            odds: book.vigOdds.over,
            ev: evOver,
            trueProb: trueProbOver,
            marketKey: prop.market,
          });
        }
        if (book.vigOdds && book.vigOdds.under != null) {
          const evUnder =
            trueProbUnder * App.helpers.americanToDecimal(book.vigOdds.under) -
            1;
          this.state.evBets.push({
            type: "prop",
            data: prop,
            book,
            side: "Under",
            odds: book.vigOdds.under,
            ev: evUnder,
            trueProb: trueProbUnder,
            marketKey: prop.market,
          });
        }
      });
    });
    App.state.allGameData.forEach((game) => {
      ["moneyline", "spreads", "totals"].forEach((marketKey) => {
        if (!game[marketKey]) return;
        const lines = Array.isArray(game[marketKey])
          ? game[marketKey]
          : [game[marketKey]];
        lines.forEach((line) => {
          if (!line.trueOdds || !line.bookmakerOdds) return;
          const trueProbA = App.helpers.americanToProb(line.trueOdds.oddsA);
          const trueProbB = App.helpers.americanToProb(line.trueOdds.oddsB);
          line.bookmakerOdds.forEach((book) => {
            if (book.vigOdds && book.vigOdds.oddsA != null) {
              const evA =
                trueProbA * App.helpers.americanToDecimal(book.vigOdds.oddsA) -
                1;
              this.state.evBets.push({
                type: "game",
                data: game,
                line,
                book,
                side: "A",
                odds: book.vigOdds.oddsA,
                ev: evA,
                trueProb: trueProbA,
                marketKey,
              });
            }
            if (book.vigOdds && book.vigOdds.oddsB != null) {
              const evB =
                trueProbB * App.helpers.americanToDecimal(book.vigOdds.oddsB) -
                1;
              this.state.evBets.push({
                type: "game",
                data: game,
                line,
                book,
                side: "B",
                odds: book.vigOdds.oddsB,
                ev: evB,
                trueProb: trueProbB,
                marketKey,
              });
            }
          });
        });
      });
    });
  },
  renderEVBets() {
    const slate = document.getElementById("ev-bets-slate");
    slate.innerHTML = "";
    const bankroll =
      parseFloat(document.getElementById("ev-bankroll").value) || 0;
    const kellyMultiplier =
      parseFloat(document.getElementById("ev-kelly-multiplier").value) || 0.5;
    const selectedBook = document.getElementById("ev-book-filter").value;
    const minEv =
      (parseFloat(document.getElementById("ev-min-ev-filter").value) || 0) /
      100;
    const maxEvInput = document.getElementById("ev-max-ev-filter");
    const maxEv = maxEvInput.value
      ? parseFloat(maxEvInput.value) / 100
      : Infinity;
    const selectedMarket = document.getElementById("ev-market-filter").value;
    const searchTerm = document
      .getElementById("ev-search-filter")
      .value.toLowerCase();
    const filteredBets = this.state.evBets.filter((bet) => {
      const evCondition = bet.ev >= minEv && bet.ev <= maxEv;
      const bookCondition =
        selectedBook === "all" || bet.book.bookmaker === selectedBook;
      const marketCondition =
        selectedMarket === "all" || bet.marketKey === selectedMarket;
      let searchCondition = true;
      if (searchTerm) {
        const teamA = bet.data.teamA.toLowerCase();
        const teamB = bet.data.teamB.toLowerCase();
        const player = (bet.data.player || "").toLowerCase();
        searchCondition =
          teamA.includes(searchTerm) ||
          teamB.includes(searchTerm) ||
          player.includes(searchTerm);
      }
      return evCondition && bookCondition && marketCondition && searchCondition;
    });
    if (filteredBets.length === 0) {
      slate.innerHTML = `<p class="text-center text-main-secondary">No +EV bets found matching your criteria.</p>`;
      return;
    }
    filteredBets.sort((a, b) => b.ev - a.ev);
    filteredBets.forEach((bet) => {
      const card = this.createEVBetCard(bet, bankroll, kellyMultiplier);
      slate.appendChild(card);
    });
  },

  // js/ev_bets.js
  createEVBetCard(bet, bankroll, kellyMultiplier) {
    const card = document.createElement("div");
    card.className = "game-card p-4 rounded-lg";
    card.dataset.id = bet.type === "prop" ? bet.data.propId : bet.data.id;
    card.dataset.market = bet.marketKey;
    card.dataset.isProp = bet.type === "prop";
    card.dataset.point =
      bet.type === "game" && bet.line ? bet.line.point : bet.data.point;

    const logoSrc = `images/logos/${bet.book.bookmaker}.png`;

    let topHtml,
      bottomHtml,
      stakeHtml = "",
      stakeValue = 0;
    if (bankroll > 0) {
      const p = bet.trueProb;
      const q = 1 - p;
      const b = App.helpers.americanToDecimal(bet.odds) - 1;
      if (b > 0) {
        const kellyFraction = ((b * p - q) / b) * kellyMultiplier;
        stakeValue = bankroll * kellyFraction;
        if (stakeValue > 0.01) {
          stakeHtml = `<div class="text-right"><p class="text-xl font-bold text-main-primary leading-none">$${stakeValue.toFixed(
            2
          )}</p><p class="text-xs text-main-secondary leading-none">(${(
            kellyFraction * 100
          ).toFixed(4)}% of bankroll)</p></div>`;
        }
      }
    }
    if (bet.type === "prop") {
      const prop = bet.data;
      const propMarketName = prop.market
        .replace("player_", "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
      topHtml = `<p class="font-bold text-lg text-main-primary">${prop.player}</p><p class="text-sm text-main-secondary">${prop.teamB} @ ${prop.teamA}</p>`;
      bottomHtml = `<p class="font-bold text-lg text-accent-blue">${bet.side} ${prop.point} ${propMarketName}</p>`;
    } else {
      const game = bet.data;
      let sideName;
      if (bet.marketKey === "moneyline") {
        sideName = bet.side === "A" ? game.teamA : game.teamB;
      } else if (bet.marketKey === "spreads") {
        const point = bet.side === "A" ? bet.line.point : -bet.line.point;
        const teamName = bet.side === "A" ? game.teamA : game.teamB;
        sideName = `${teamName} ${App.helpers.formatPoint(point)}`;
      } else {
        sideName = `${bet.side === "A" ? "Over" : "Under"} ${bet.line.point}`;
      }
      topHtml = `<p class="font-bold text-lg text-main-primary">${game.teamB} @ ${game.teamA}</p><p class="text-sm text-main-secondary">${game.sport}</p>`;
      bottomHtml = `<p class="font-bold text-lg text-accent-blue">${sideName}</p>`;
    }

    const gameDescription = `${bet.data.teamB} @ ${bet.data.teamA}`;
    const betDescription = bottomHtml.replace(/<[^>]*>/g, "");

    card.innerHTML = `<div class="flex justify-between items-start cursor-pointer ev-card-clickable-area">
                        <div class="flex-grow">${topHtml}</div>
                        <div class="text-right flex-shrink-0 ml-4 flex items-center space-x-3">
                            <div>
                                <p class="font-semibold text-main-primary">${App.helpers.formatOdds(
                                  bet.odds
                                )}</p>
                                <p class="text-sm text-main-secondary">${
                                  bet.book.bookmaker
                                }</p>
                            </div>
                            <img src="${logoSrc}" alt="${
      bet.book.bookmaker
    }" class="h-10 w-10 object-contain rounded-md" onerror="this.style.display='none'">
                        </div>
                      </div>
                      <div class="p-3 rounded-md mt-2" style="background-color: var(--bg-secondary);">
                        <div class="flex justify-between items-center">
                            <div class="cursor-pointer ev-card-clickable-area">
                                ${bottomHtml}
                                <div class="bg-green-500/20 rounded-full px-3 py-1 mt-1 inline-block">
                                    <p class="font-bold text-sm text-green-400">+${(
                                      bet.ev * 100
                                    ).toFixed(2)}% EV</p>
                                </div>
                            </div>
                            <div class="flex flex-col items-end">
                                ${stakeHtml}
                                <button class="btn-track-sheet mt-2 px-3 py-1 bg-accent-blue text-white text-xs font-semibold rounded-md hover:bg-blue-500 transition"
                                    data-sport="${bet.data.sport}"
                                    data-game="${gameDescription}"
                                    data-bet="${betDescription}"
                                    data-odds="${bet.odds}"
                                    data-bookmaker="${bet.book.bookmaker}"
                                    data-ev="${(bet.ev * 100).toFixed(2)}"
                                    data-stake="${stakeValue.toFixed(2)}">
                                    Track to Sheet
                                </button>
                            </div>
                        </div>
                      </div>`;

    const trackBtn = card.querySelector(".btn-track-sheet");
    trackBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const btn = e.target;
      const selectedMember = document.getElementById("member-selector").value;

      // Format data for Airtable API
      const airtableData = {
        fields: {
          Timestamp: new Date().toISOString(),
          Sport: btn.dataset.sport,
          Game: btn.dataset.game,
          Bet: btn.dataset.bet,
          Odds: parseFloat(btn.dataset.odds),
          Bookmaker: btn.dataset.bookmaker,
          EV_Percent: parseFloat(btn.dataset.ev),
          Stake: parseFloat(btn.dataset.stake),
          Status: "Pending",
          Member: selectedMember,
        },
      };

      btn.textContent = "Saving...";
      btn.disabled = true;

      const { airtableApiKey, airtableBaseId, airtableTableName } = App.config;
      const url = `https://api.airtable.com/v0/${airtableBaseId}/${airtableTableName}`;

      fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${airtableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ records: [airtableData] }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Airtable response was not ok");
          }
          return response.json();
        })
        .then(() => {
          btn.textContent = "Saved!";
          btn.classList.replace("bg-accent-blue", "bg-green-600");
        })
        .catch((error) => {
          console.error("Error tracking bet to Airtable:", error);
          btn.textContent = "Error!";
          btn.classList.replace("bg-accent-blue", "bg-red-600");
        });
    });

    card.querySelectorAll(".ev-card-clickable-area").forEach((area) => {
      area.addEventListener("click", () => this.handleEVCardClick(card));
    });

    return card;
  },
};
