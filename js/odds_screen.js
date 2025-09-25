import { App } from "./app.js";
import { UI } from "./ui.js";

export const OddsScreen = {
  state: {
    currentGameData: null,
    sortConfig: { column: "bookmaker", direction: "asc" },
  },

  init() {
    const backBtn = document.getElementById("odds-screen-back-btn");
    backBtn.addEventListener("click", () => {
      this.state.currentGameData = null;
      this._render();
    });

    const toggle = document.getElementById("vig-free-toggle");
    toggle.addEventListener("change", () => this._render());

    const container = document.getElementById("odds-comparison-container");
    container.addEventListener("click", (e) => {
      const header = e.target.closest(".sortable-header");
      const gameCard = e.target.closest(".game-list-card");
      if (header) {
        this.handleSort(header.dataset.sort);
      } else if (gameCard) {
        const gameId = gameCard.dataset.id;
        const gameData = App.state.allGameData.find((g) => g.id === gameId);
        if (gameData) {
          const defaultMarket = ["moneyline", "spreads", "totals"].find(
            (m) => gameData[m]
          );
          this.show(gameData, defaultMarket);
        }
      }
    });
    this._render();
  },

  showById(id, marketType, isProp = false) {
    const item = isProp
      ? App.state.allPropData.find((p) => p.propId === id)
      : App.state.allGameData.find((g) => g.id === id);
    if (item) {
      this.show(item, marketType);
    } else {
      console.error(`OddsScreen could not find item with ID: ${id}`);
    }
  },

  show(item, marketType) {
    this.state.currentGameData = { item, marketType };
    this.state.sortConfig = { column: "bookmaker", direction: "asc" };
    const vigToggle = document.getElementById("vig-free-toggle");
    if (vigToggle) vigToggle.checked = false;
    this._render();
  },

  handleSort(column) {
    const { sortConfig } = this.state;
    let direction = "desc";
    if (sortConfig.column === column) {
      direction = sortConfig.direction === "asc" ? "desc" : "asc";
    } else if (column === "bookmaker") {
      direction = "asc";
    }
    this.state.sortConfig = { column, direction };
    this._render();
  },

  _render() {
    const titleEl = document.getElementById("odds-screen-title");
    const subtitleEl = document.getElementById("odds-screen-subtitle");
    const container = document.getElementById("odds-comparison-container");
    const backBtn = document.getElementById("odds-screen-back-btn");
    const vigToggleContainer = document
      .getElementById("vig-free-toggle")
      ?.closest(".flex");
    document.getElementById("best-line-summary").innerHTML = "";

    if (this.state.currentGameData) {
      backBtn.classList.remove("hidden");
      if (vigToggleContainer) vigToggleContainer.classList.remove("hidden");
      this._renderDetailView();
    } else {
      titleEl.innerHTML = `<h2>All Upcoming Games</h2>`;
      subtitleEl.textContent = "Select a game to view detailed odds";
      backBtn.classList.add("hidden");
      if (vigToggleContainer) vigToggleContainer.classList.add("hidden");
      this._renderGameList(container);
    }
  },

  _renderGameList(container) {
    container.innerHTML = "";
    if (App.state.allGameData.length === 0) {
      container.innerHTML = `<p class="text-center text-main-secondary">No upcoming games found.</p>`;
      return;
    }
    const grid = document.createElement("div");
    grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";
    App.state.allGameData
      .sort((a, b) => new Date(a.gameTime) - new Date(b.gameTime))
      .forEach((game) => {
        const card = this._createGameListCard(game);
        grid.appendChild(card);
      });
    container.appendChild(grid);
  },

  _createGameListCard(game) {
    const card = document.createElement("div");
    card.className =
      "game-list-card bg-tertiary p-4 rounded-lg cursor-pointer hover:bg-main-secondary transition";
    card.dataset.id = game.id;
    const logoA = App.helpers.getTeamLogoPath(game.teamA, game.sport);
    const logoB = App.helpers.getTeamLogoPath(game.teamB, game.sport);
    card.innerHTML = `<div class="flex items-center justify-between"><div><div class="flex items-center"><img src="${logoB}" class="h-8 w-8 mr-3 object-contain"><span class="font-bold text-main-primary">${
      game.teamB
    }</span></div><div class="flex items-center mt-2"><img src="${logoA}" class="h-8 w-8 mr-3 object-contain"><span class="font-bold text-main-primary">@ ${
      game.teamA
    }</span></div></div><div class="text-right text-xs text-main-secondary"><p>${
      game.sport
    }</p><p>${new Date(game.gameTime).toLocaleDateString()}</p><p>${new Date(
      game.gameTime
    ).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}</p></div></div>`;
    return card;
  },

  _renderDetailView() {
    if (this.state.currentGameData.item.player) {
      this._renderPropDetailView();
    } else {
      this._renderGameDetailView();
    }
  },

  _renderGameDetailView() {
    const { item: game, marketType } = this.state.currentGameData;
    const container = document.getElementById("odds-comparison-container");
    container.innerHTML = "";

    const titleEl = document.getElementById("odds-screen-title");
    const teamBLogo = App.helpers.getTeamLogoPath(game.teamB, game.sport);
    const teamALogo = App.helpers.getTeamLogoPath(game.teamA, game.sport);
    titleEl.innerHTML = `<div class="flex items-center justify-center space-x-4"><img src="${teamBLogo}" class="h-10 w-10 object-contain"> <span class="text-2xl font-bold">${game.teamB}</span> <span class="text-xl text-main-secondary">@</span> <span class="text-2xl font-bold">${game.teamA}</span> <img src="${teamALogo}" class="h-10 w-10 object-contain"></div>`;

    const subtitleEl = document.getElementById("odds-screen-subtitle");
    subtitleEl.textContent = `${new Date(game.gameTime).toLocaleString([], {
      dateStyle: "full",
      timeStyle: "short",
    })}`;

    const allLinesForMarket = (
      Array.isArray(game[marketType]) ? game[marketType] : [game[marketType]]
    ).filter(Boolean);
    if (marketType !== "moneyline" && allLinesForMarket[0]) {
      allLinesForMarket.sort((a, b) => a.point - b.point);
    }

    allLinesForMarket.forEach((specificLineData) => {
      if (
        !specificLineData ||
        !specificLineData.bookmakerOdds ||
        specificLineData.bookmakerOdds.length === 0
      )
        return;

      if (marketType !== "moneyline") {
        const lineHeader = document.createElement("h3");
        lineHeader.className =
          "text-xl font-bold text-main-primary mt-6 mb-3 border-b border-border-primary pb-2";
        const headerText = marketType === "spreads" ? "Spread" : "Total";
        lineHeader.textContent = `${headerText}: ${App.helpers.formatPoint(
          specificLineData.point
        )}`;
        container.appendChild(lineHeader);
      }

      const tableHTML = this._buildTableHTML(
        specificLineData.bookmakerOdds,
        game,
        marketType,
        specificLineData
      );
      container.insertAdjacentHTML("beforeend", tableHTML);
    });
  },

  _buildTableHTML(bookmakerData, item, marketType, lineData = null) {
    const sortConfig = this.state.sortConfig;
    const showVigFree = document.getElementById("vig-free-toggle").checked;

    const sortedBooks = [...bookmakerData].sort((a, b) => {
      const oddsA = showVigFree ? a.trueOdds : a.vigOdds || a.odds;
      const oddsB = showVigFree ? b.trueOdds : b.vigOdds || b.odds;
      if (!oddsA || !oddsB) return 0;
      let valA, valB;
      if (sortConfig.column === "bookmaker") {
        valA = a.bookmaker;
        valB = b.bookmaker;
      } else if (sortConfig.column === "sideA") {
        valA = App.helpers.americanToDecimal(
          oddsA.oddsA !== undefined ? oddsA.oddsA : oddsA.over
        );
        valB = App.helpers.americanToDecimal(
          oddsB.oddsA !== undefined ? oddsB.oddsA : oddsB.over
        );
      } else {
        valA = App.helpers.americanToDecimal(
          oddsA.oddsB !== undefined ? oddsA.oddsB : oddsA.under
        );
        valB = App.helpers.americanToDecimal(
          oddsB.oddsB !== undefined ? oddsB.oddsB : oddsB.under
        );
      }
      if (valA == null)
        valA = sortConfig.direction === "asc" ? Infinity : -Infinity;
      if (valB == null)
        valB = sortConfig.direction === "asc" ? Infinity : -Infinity;
      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    const getSortIndicator = (column) =>
      sortConfig.column === column
        ? sortConfig.direction === "asc"
          ? " ▲"
          : " ▼"
        : "";
    let headerA, headerB, sideA_sort_key, sideB_sort_key;

    if (marketType === "prop") {
      headerA = `<span>Over ${item.point}</span>`;
      headerB = `<span>Under ${item.point}</span>`;
      sideA_sort_key = `prop_over_${item.point}`;
      sideB_sort_key = `prop_under_${item.point}`;
    } else {
      // Game Lines
      sideA_sort_key = `${marketType}_A_${lineData.point}`;
      sideB_sort_key = `${marketType}_B_${lineData.point}`;
      if (marketType === "moneyline") {
        headerA = `<span>${item.teamA}</span>`;
        headerB = `<span>${item.teamB}</span>`;
      } else if (marketType === "spreads") {
        headerA = `<span>${item.teamA} ${App.helpers.formatPoint(
          lineData.point
        )}</span>`;
        headerB = `<span>${item.teamB} ${App.helpers.formatPoint(
          -lineData.point
        )}</span>`;
      } else {
        // Totals
        headerA = `<span>Over ${lineData.point}</span>`;
        headerB = `<span>Under ${lineData.point}</span>`;
      }
    }

    const rowsHTML = sortedBooks
      .map((book) => this.createTableRow(book, showVigFree))
      .join("");
    return `<table class="w-full text-left table-auto border-collapse odds-table"><thead><tr><th class="p-2 w-1/3 text-sm font-semibold text-main-secondary sortable-header cursor-pointer" data-sort="bookmaker">Bookmaker${getSortIndicator(
      "bookmaker"
    )}</th><th class="p-2 w-1/3 text-sm font-semibold text-main-secondary text-center sortable-header cursor-pointer" data-sort="sideA">${headerA}${getSortIndicator(
      "sideA"
    )}</th><th class="p-2 w-1/3 text-sm font-semibold text-main-secondary text-center sortable-header cursor-pointer" data-sort="sideB">${headerB}${getSortIndicator(
      "sideB"
    )}</th></tr></thead><tbody>${rowsHTML}</tbody></table>`;
  },

  createTableRow(book, showVigFree) {
    const oddsToDisplay =
      showVigFree && book.trueOdds ? book.trueOdds : book.vigOdds || book.odds;
    if (!oddsToDisplay) return "";
    const oddsA =
      oddsToDisplay.oddsA !== undefined
        ? oddsToDisplay.oddsA
        : oddsToDisplay.over;
    const oddsB =
      oddsToDisplay.oddsB !== undefined
        ? oddsToDisplay.oddsB
        : oddsToDisplay.under;

    if (oddsA == null && oddsB == null) return "";

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
      vigText = `Vig: ${(vig * 100).toFixed(2)}%`;
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

    return `<tr class="border-b border-border-primary"><td class="p-3 text-main-primary font-medium"><div class="flex items-center space-x-3"><img src="${logoSrc}" alt="${book.bookmaker}" class="h-8 w-8 object-contain" onerror="this.style.display='none'"><div><span>${book.bookmaker}${sharpIndicator}</span><span class="block text-xs text-main-secondary">${vigText}</span></div></div></td><td class="p-3 text-center"><span class="font-bold text-lg text-main-primary">${oddsAHTML}</span></td><td class="p-3 text-center"><span class="font-bold text-lg text-main-primary">${oddsBHTML}</span></td></tr>`;
  },

  _renderPropDetailView() {
    const { item: prop } = this.state.currentGameData;
    const container = document.getElementById("odds-comparison-container");
    const summaryContainer = document.getElementById("best-line-summary");

    if (!prop || !prop.bookmakerOdds) {
      container.innerHTML = `<p class="text-center text-main-secondary">No odds data available for this prop.</p>`;
      summaryContainer.innerHTML = "";
      return;
    }
    container.innerHTML = "";

    const titleEl = document.getElementById("odds-screen-title");
    titleEl.innerHTML = `<div class="text-2xl font-bold">${prop.player}</div>`;

    const subtitleEl = document.getElementById("odds-screen-subtitle");
    const marketName = prop.market
      .replace(/player_|_over_under/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .trim();
    subtitleEl.textContent = `${marketName} - ${prop.teamB} @ ${prop.teamA}`;

    const bookmakerData = [...prop.bookmakerOdds].map((book) => {
      const hasBothSides =
        book.odds && book.odds.over != null && book.odds.under != null;
      const vigOdds = { oddsA: book.odds.over, oddsB: book.odds.under };
      const trueOdds = hasBothSides
        ? App.helpers.calculateVigFreeLine(vigOdds)
        : null;
      return { ...book, vigOdds, trueOdds };
    });

    const tableHTML = this._buildTableHTML(bookmakerData, prop, "prop");
    container.innerHTML = tableHTML;
  },
};
