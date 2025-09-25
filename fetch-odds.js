const axios = require("axios");
const fs = require("fs");

// --- Configuration ---
const ODDS_API_KEY = "7421b6a7d7b2c413ccb592182d5e2ca5";
const REGIONS = "us,us2,eu,au,us_ex";
const ODDS_FORMAT = "american";
const REQUEST_DELAY = 1000;
const FETCH_DAYS_AHEAD = 3;
const ALT_LINE_RANGE_LIMIT = 1.0; // For spreads and totals, limit alt lines to this range from main line

const MARKET_DEFINITIONS = {
  gameLines: ["h2h", "spreads", "totals"],
  alternateLines: ["alternate_spreads", "alternate_totals"],
  nflPlayerProps: [
    "player_passing_yds",
    "player_pass_tds",
    "player_pass_completions",
    "player_pass_attempts",
    "player_pass_interceptions",
    "player_rushing_yds",
    "player_rush_attempts",
    "player_receiving_yds",
    "player_receptions",
    "player_anytime_td",
  ],
  nbaPlayerProps: [
    "player_points",
    "player_rebounds",
    "player_assists",
    "player_threes",
    "player_steals",
    "player_blocks",
    "player_turnovers",
  ],
  mlbBattingProps: [
    "batter_home_runs",
    "batter_hits",
    "batter_total_bases",
    "batter_rbis",
    "batter_runs_scored",
  ],
  mlbPitchingProps: [
    "pitcher_strikeouts",
    "pitcher_hits_allowed",
    "pitcher_walks",
    "pitcher_earned_runs",
  ],
};

// To enable a sport, uncomment its block.
const SPORT_CONFIG = {
  // americanfootball_nfl: {
  //   markets: [
  //     "gameLines",
  //     // "alternateLines",
  //     // "nflPlayerProps"
  //   ],
  // },
  // americanfootball_ncaaf: {
  //   markets: [
  //     "gameLines",
  //     // "alternateLines"
  //   ],
  // },
  basketball_nba: {
    markets: [
      "gameLines",
      // "alternateLines",
      // "nbaPlayerProps",
    ],
  },
  baseball_mlb: {
    markets: [
      "gameLines",
      // "alternateLines",
      // "mlbBattingProps",
      // "mlbPitchingProps",
    ],
  },
};

const GAME_LINE_BOOK_WEIGHTS = {
  pinnacle: {
    type: "sharp",
    weights: {
      default: 3.0,
      americanfootball_nfl: 3.0,
      americanfootball_ncaaf: 2.8,
    },
  },
  novig: {
    type: "sharp",
    weights: {
      default: 1.25,
      basketball_wnba: 1.85,
      americanfootball_nfl: 2.75,
      americanfootball_ncaaf: 2.5,
    },
  },
  prophetx: {
    type: "sharp",
    weights: {
      default: 2.0,
      baseball_mlb: 2.0,
      americanfootball_nfl: 2.9,
      americanfootball_ncaaf: 2.75,
    },
  },
  lowvig: {
    type: "sharp",
    weights: { default: 2.0, americanfootball_nfl: 1.5, baseball_mlb: 1.5 },
  },
  betonlineag: {
    type: "sharp",
    weights: {
      default: 2.0,
      baseball_mlb: 1.5,
      americanfootball_nfl: 2.0,
      americanfootball_ncaaf: 1.5,
    },
  },
  fanduel: {
    type: "market",
    weights: { default: 0.1, mma_mixed_martial_arts: 0.5 },
  },
  draftkings: {
    type: "market",
    weights: {
      default: 0.25,
      mma_mixed_martial_arts: 0.1,
      americanfootball_ncaaf: 0.1,
    },
  },
  williamhill_us: {
    type: "market",
    weights: { default: 0.3, baseball_mlb: 0.5, mma_mixed_martial_arts: 0.75 },
  },
  betmgm: {
    type: "market",
    weights: {
      default: 1.5,
      baseball_mlb: 1.65,
      basketball_wnba: 1.25,
      americanfootball_nfl: 1.75,
      americanfootball_ncaaf: 1.75,
    },
  },
  espnbet: {
    type: "market",
    weights: {
      default: 1.25,
      baseball_mlb: 0.75,
      mma_mixed_martial_arts: 1.0,
      basketball_wnba: 0.75,
    },
  },
  fanatics: {
    type: "market",
    weights: {
      default: 1.25,
      baseball_mlb: 0.75,
      mma_mixed_martial_arts: 1.0,
      basketball_wnba: 0.9,
      americanfootball_nfl: 1.5,
      americanfootball_ncaaf: 1.4,
    },
  },
  hardrockbet: {
    type: "market",
    weights: {
      default: 1.25,
      baseball_mlb: 1.65,
      mma_mixed_martial_arts: 1.75,
      americanfootball_nfl: 1.75,
      americanfootball_ncaaf: 1.75,
    },
  },
  bet365_us: {
    type: "market",
    weights: {
      default: 1.25,
      mma_mixed_martial_arts: 2.0,
      americanfootball_nfl: 1.3,
      americanfootball_ncaaf: 1.3,
    },
  },
  betrivers: {
    type: "market",
    weights: {
      default: 2.25,
      baseball_mlb: 4.75,
      mma_mixed_martial_arts: 2.5,
      basketball_wnba: 3.25,
      americanfootball_nfl: 4.75,
      americanfootball_ncaaf: 4.75,
    },
  },
  ballybet: {
    type: "market",
    weights: {
      default: 2.25,
      baseball_mlb: 4.75,
      mma_mixed_martial_arts: 2.5,
      basketball_wnba: 3.25,
      americanfootball_nfl: 4.65,
      americanfootball_ncaaf: 4.65,
    },
  },
  fliff: {
    type: "market",
    weights: {
      default: 1.0,
      baseball_mlb: 4.25,
      basketball_wnba: 3.0,
      americanfootball_nfl: 2.3,
      americanfootball_ncaaf: 2.5,
    },
  },
};

const PROP_BOOK_WEIGHTS = {
  pinnacle: {
    type: "sharp",
    weights: {
      default: 3.0,
      baseball_mlb: 2.6,
      americanfootball_nfl: 2.8,
      americanfootball_ncaaf: 2.8,
    },
  },
  novig: {
    type: "sharp",
    weights: {
      default: 1.25,
      baseball_mlb: 2.5,
      americanfootball_nfl: 3.55,
      americanfootball_ncaaf: 2.5,
    },
  },
  prophetx: {
    type: "sharp",
    weights: {
      default: 2.0,
      baseball_mlb: 2.0,
      americanfootball_nfl: 3.1,
      americanfootball_ncaaf: 2.75,
    },
  },
  lowvig: { type: "sharp", weights: { default: 2.0, baseball_mlb: 1.75 } },
  betonlineag: {
    type: "sharp",
    weights: {
      default: 2.0,
      baseball_mlb: 1.75,
      americanfootball_nfl: 2.25,
      americanfootball_ncaaf: 2.0,
    },
  },
  fanduel: {
    type: "sharp",
    weights: { default: 1, baseball_mlb: 2.75, americanfootball_nfl: 1.75 },
  },
  draftkings: {
    type: "sharp",
    weights: {
      default: 0.2,
      mma_mixed_martial_arts: 0.1,
      americanfootball_ncaaf: 0.1,
    },
  },
  williamhill_us: {
    type: "market",
    weights: { default: 0.3, baseball_mlb: 0.5, mma_mixed_martial_arts: 0.75 },
  },
  betmgm: {
    type: "market",
    weights: {
      default: 2.5,
      baseball_mlb: 2.0,
      basketball_wnba: 1.25,
      americanfootball_nfl: 4.45,
      americanfootball_ncaaf: 2.75,
    },
  },
  espnbet: {
    type: "market",
    weights: {
      default: 1.25,
      mma_mixed_martial_arts: 1.0,
      basketball_wnba: 0.75,
    },
  },
  fanatics: {
    type: "market",
    weights: {
      default: 1.25,
      baseball_mlb: 1.75,
      mma_mixed_martial_arts: 1.0,
      basketball_wnba: 0.9,
      americanfootball_nfl: 2.97,
      americanfootball_ncaaf: 1.5,
    },
  },
  hardrockbet: {
    type: "market",
    weights: {
      default: 1.25,
      baseball_mlb: 1.75,
      mma_mixed_martial_arts: 1.75,
      americanfootball_nfl: 4.9,
      americanfootball_ncaaf: 1.7,
    },
  },
  bet365_us: {
    type: "market",
    weights: {
      default: 1.25,
      mma_mixed_martial_arts: 2.0,
      americanfootball_nfl: 1.3,
      americanfootball_ncaaf: 1.3,
    },
  },
  betrivers: {
    type: "market",
    weights: {
      default: 2.25,
      baseball_mlb: 3,
      mma_mixed_martial_arts: 2.5,
      basketball_wnba: 4,
      americanfootball_nfl: 5.25,
      americanfootball_ncaaf: 4.5,
    },
  },
  ballybet: {
    type: "market",
    weights: {
      default: 2.25,
      baseball_mlb: 3,
      mma_mixed_martial_arts: 2.5,
      basketball_wnba: 4,
      americanfootball_nfl: 4.0,
      americanfootball_ncaaf: 4.5,
    },
  },
  fliff: {
    type: "market",
    weights: {
      default: 1.0,
      baseball_mlb: 1.05,
      basketball_wnba: 1.5,
      americanfootball_nfl: 1.25,
      americanfootball_ncaaf: 0.75,
    },
  },
};

const americanToImplied = (odds) => {
  if (odds === null || typeof odds === "undefined") return 0;
  if (odds >= 100) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
};
const probToAmerican = (prob) => {
  if (!prob || prob <= 0 || prob >= 1) return null;
  let odds;
  if (prob >= 0.5) {
    odds = -((prob / (1 - prob)) * 100);
  } else {
    odds = 100 / prob - 100;
  }
  return parseFloat(odds.toFixed(4));
};
const calculateVigFreeLine = (odds) => {
  if (!odds || odds.oddsA === null || odds.oddsB === null) return null;
  const probA = americanToImplied(odds.oddsA);
  const probB = americanToImplied(odds.oddsB);
  const totalProb = probA + probB;
  if (totalProb <= 0) return null;
  const vigFreeProbA = probA / totalProb;
  return {
    oddsA: probToAmerican(vigFreeProbA),
    oddsB: probToAmerican(1 - vigFreeProbA),
  };
};
function calculateConsensusLine(oddsArray, removeVig = false) {
  if (!oddsArray || oddsArray.length === 0) return null;
  let totalWeight = 0;
  let weightedProbA = 0;
  let weightedProbB = 0;
  for (const item of oddsArray) {
    const probA = americanToImplied(item.oddsA);
    const probB = americanToImplied(item.oddsB);
    if (probA === 0 || probB === 0) continue;
    const weight = item.weight || 1.0;
    weightedProbA += probA * weight;
    weightedProbB += probB * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return null;
  let consensusProbA = weightedProbA / totalWeight;
  let consensusProbB = weightedProbB / totalWeight;
  if (removeVig) {
    const totalProb = consensusProbA + consensusProbB;
    if (totalProb > 0) {
      consensusProbA /= totalProb;
      consensusProbB /= totalProb;
    }
  }
  return {
    oddsA: probToAmerican(consensusProbA),
    oddsB: probToAmerican(consensusProbB),
  };
}

function processAllData(allGames) {
  const processedGameLines = [];
  const propsMap = new Map();
  for (const game of allGames) {
    const gameData = {
      id: game.id,
      sport: game.sport_title,
      teamA: game.home_team,
      teamB: game.away_team,
      gameTime: game.commence_time,
    };
    let hasGameLines = false;
    const allMarkets = game.bookmakers.flatMap((b) =>
      b.markets.map((m) => ({ ...m, bookmaker: b.key }))
    );

    const moneylineOdds = allMarkets.filter((m) => m.key === "h2h");
    if (moneylineOdds.length > 0) {
      const consensus = processMoneylineMarket(
        game,
        moneylineOdds,
        GAME_LINE_BOOK_WEIGHTS
      );
      if (consensus) {
        gameData.moneyline = [consensus];
        hasGameLines = true;
      }
    }

    const allSpreadOdds = allMarkets.filter(
      (m) => m.key === "spreads" || m.key === "alternate_spreads"
    );
    const allTotalOdds = allMarkets.filter(
      (m) => m.key === "totals" || m.key === "alternate_totals"
    );

    if (allSpreadOdds.length > 0) {
      const processedLines = processGroupedMarket(
        game,
        allSpreadOdds,
        GAME_LINE_BOOK_WEIGHTS,
        "spreads"
      );
      if (processedLines) {
        gameData.spreads = processedLines;
        hasGameLines = true;
      }
    }
    if (allTotalOdds.length > 0) {
      const processedLines = processGroupedMarket(
        game,
        allTotalOdds,
        GAME_LINE_BOOK_WEIGHTS,
        "totals"
      );
      if (processedLines) {
        gameData.totals = processedLines;
        hasGameLines = true;
      }
    }

    if (hasGameLines) {
      const marketsToFilter = ["spreads", "totals"];
      for (const market of marketsToFilter) {
        if (gameData[market] && gameData[market].length > 1) {
          let mainLinePoint = null;
          let maxBooks = 0;
          gameData[market].forEach((line) => {
            if (line.bookmakerOdds.length > maxBooks) {
              maxBooks = line.bookmakerOdds.length;
              mainLinePoint = line.point;
            }
          });
          if (mainLinePoint !== null) {
            const lowerBound = mainLinePoint - ALT_LINE_RANGE_LIMIT;
            const upperBound = mainLinePoint + ALT_LINE_RANGE_LIMIT;
            gameData[market] = gameData[market].filter(
              (line) => line.point >= lowerBound && line.point <= upperBound
            );
          }
        }
      }
      processedGameLines.push(gameData);
    }
    const propMarkets = allMarkets.filter(
      (m) =>
        m.key.startsWith("player_") ||
        m.key.startsWith("batter_") ||
        m.key.startsWith("pitcher_")
    );
    for (const market of propMarkets) {
      for (const outcome of market.outcomes) {
        const propKey = `${game.id}-${market.key}-${outcome.description}-${outcome.point}`;
        if (!propsMap.has(propKey)) {
          propsMap.set(propKey, {
            propId: propKey,
            gameId: game.id,
            sport: game.sport_title,
            gameTime: game.commence_time,
            teamA: game.home_team,
            teamB: game.away_team,
            player: outcome.description,
            market: market.key,
            point: outcome.point,
            odds: [],
          });
        }
        propsMap
          .get(propKey)
          .odds.push({ ...outcome, bookmaker: market.bookmaker });
      }
    }
  }
  const processedPlayerProps = [];
  for (const propData of propsMap.values()) {
    const processedProp = processPropMarket(propData, PROP_BOOK_WEIGHTS);
    if (processedProp) {
      delete propData.odds;
      processedPlayerProps.push({ ...propData, ...processedProp });
    }
  }
  return { processedGameLines, processedPlayerProps };
}

function processMoneylineMarket(game, allOddsForMarket, bookWeights) {
  const sharpOdds = [];
  const marketOddsList = [];
  const allBookmakerOdds = [];
  for (const market of allOddsForMarket) {
    const bookConfig = bookWeights[market.bookmaker];
    if (!bookConfig) continue;
    const outcomeA = market.outcomes.find((o) => o.name === game.home_team);
    const outcomeB = market.outcomes.find((o) => o.name === game.away_team);
    if (outcomeA && outcomeB) {
      const weight =
        bookConfig.weights[game.sport_key] || bookConfig.weights.default;
      const oddsData = {
        oddsA: outcomeA.price,
        oddsB: outcomeB.price,
        weight: weight,
      };
      const vigFreeLine = calculateVigFreeLine(oddsData);
      allBookmakerOdds.push({
        bookmaker: market.bookmaker,
        type: bookConfig.type,
        vigOdds: { oddsA: outcomeA.price, oddsB: outcomeB.price },
        trueOdds: vigFreeLine,
      });
      if (bookConfig.type === "sharp") sharpOdds.push(oddsData);
      else marketOddsList.push(oddsData);
    }
  }
  if (sharpOdds.length === 0 || marketOddsList.length === 0) return null;
  const trueOdds = calculateConsensusLine(sharpOdds, true);
  const marketOdds = calculateConsensusLine(marketOddsList, false);
  const trueMarketOdds = calculateConsensusLine(marketOddsList, true);
  if (!trueOdds || !marketOdds || !trueMarketOdds) return null;
  return {
    trueOdds,
    marketOdds,
    trueMarketOdds,
    bookmakerOdds: allBookmakerOdds,
  };
}

function processGroupedMarket(game, allOddsForMarket, bookWeights, marketKey) {
  const outcomesByBookmaker = new Map();
  for (const market of allOddsForMarket) {
    if (!outcomesByBookmaker.has(market.bookmaker)) {
      outcomesByBookmaker.set(market.bookmaker, []);
    }
    outcomesByBookmaker.get(market.bookmaker).push(...market.outcomes);
  }

  const linesByPoint = new Map();
  for (const [bookmaker, allOutcomes] of outcomesByBookmaker.entries()) {
    const homeOutcomes = allOutcomes.filter(
      (o) =>
        o.name === game.home_team ||
        (marketKey === "totals" && o.name === "Over")
    );
    const awayOutcomes = allOutcomes.filter(
      (o) =>
        o.name === game.away_team ||
        (marketKey === "totals" && o.name === "Under")
    );

    const seenPoints = new Set();
    homeOutcomes.forEach((homeOutcome) => {
      if (seenPoints.has(homeOutcome.point)) return;

      const oppositePoint =
        marketKey === "spreads" ? -homeOutcome.point : homeOutcome.point;
      const awayOutcome = awayOutcomes.find((o) => o.point === oppositePoint);

      if (awayOutcome) {
        const point = homeOutcome.point;
        if (!linesByPoint.has(point)) {
          linesByPoint.set(point, []);
        }
        linesByPoint.get(point).push({ bookmaker, homeOutcome, awayOutcome });
        seenPoints.add(point);
      }
    });
  }

  const processedLines = [];
  for (const [point, bookmakerLines] of linesByPoint.entries()) {
    const sharpOdds = [];
    const marketOddsList = [];
    const allBookmakerOdds = [];

    for (const line of bookmakerLines) {
      const bookConfig = bookWeights[line.bookmaker];
      if (!bookConfig) continue;

      const weight =
        bookConfig.weights[game.sport_key] || bookConfig.weights.default;
      const oddsData = {
        oddsA: line.homeOutcome.price,
        oddsB: line.awayOutcome.price,
        weight,
      };
      const vigFreeLine = calculateVigFreeLine(oddsData);

      allBookmakerOdds.push({
        bookmaker: line.bookmaker,
        type: bookConfig.type,
        vigOdds: {
          oddsA: line.homeOutcome.price,
          oddsB: line.awayOutcome.price,
        },
        trueOdds: vigFreeLine,
      });

      if (bookConfig.type === "sharp") {
        sharpOdds.push(oddsData);
      } else {
        marketOddsList.push(oddsData);
      }
    }

    // --- CORRECTED LOGIC ---
    // Only require sharp odds to be present to calculate a true line.
    if (sharpOdds.length > 0 && allBookmakerOdds.length > 0) {
      const trueOdds = calculateConsensusLine(sharpOdds, true);

      // Market odds are optional; calculate if possible, otherwise they'll be null.
      const marketOdds =
        marketOddsList.length > 0
          ? calculateConsensusLine(marketOddsList, false)
          : null;
      const trueMarketOdds =
        marketOddsList.length > 0
          ? calculateConsensusLine(marketOddsList, true)
          : null;

      // Only require trueOdds for the line to be valid.
      if (trueOdds) {
        processedLines.push({
          point,
          trueOdds,
          marketOdds,
          trueMarketOdds,
          bookmakerOdds: allBookmakerOdds,
        });
      }
    }
  }
  return processedLines.length > 0 ? processedLines : null;
}

function processPropMarket(propData, bookWeights) {
  const sharpOver = [],
    sharpUnder = [],
    marketOver = [],
    marketUnder = [];
  const bookmakerOdds = [];
  const tempBookOdds = {};

  propData.odds.forEach((o) => {
    if (!tempBookOdds[o.bookmaker]) tempBookOdds[o.bookmaker] = {};
    tempBookOdds[o.bookmaker][o.name.toLowerCase()] = o.price;
  });

  for (const bookmaker in tempBookOdds) {
    const bookConfig = bookWeights[bookmaker];
    if (bookConfig) {
      const bookData = {
        bookmaker,
        type: bookConfig.type,
        vigOdds: {
          over: tempBookOdds[bookmaker].over,
          under: tempBookOdds[bookmaker].under,
        },
      };
      // Calculate and add the individual trueOdds for this book
      const oddsPair = {
        oddsA: bookData.vigOdds.over,
        oddsB: bookData.vigOdds.under,
      };
      bookData.trueOdds = calculateVigFreeLine(oddsPair);
      bookmakerOdds.push(bookData);
    }
  }

  for (const book of bookmakerOdds) {
    const bookConfig = bookWeights[book.bookmaker];
    if (!bookConfig) continue;
    const weight =
      bookConfig.weights[propData.sport] || bookConfig.weights.default;
    const poolOver = bookConfig.type === "sharp" ? sharpOver : marketOver;
    const poolUnder = bookConfig.type === "sharp" ? sharpUnder : marketUnder;
    if (book.vigOdds.over) poolOver.push({ odds: book.vigOdds.over, weight });
    if (book.vigOdds.under)
      poolUnder.push({ odds: book.vigOdds.under, weight });
  }

  const calculateConsensus = (overPool, underPool, removeVig) => {
    if (overPool.length === 0 || underPool.length === 0) return null;
    let weightedOverProb = 0,
      totalOverWeight = 0;
    overPool.forEach((item) => {
      weightedOverProb += americanToImplied(item.odds) * item.weight;
      totalOverWeight += item.weight;
    });
    let avgOverProb =
      totalOverWeight > 0 ? weightedOverProb / totalOverWeight : 0;

    let weightedUnderProb = 0,
      totalUnderWeight = 0;
    underPool.forEach((item) => {
      weightedUnderProb += americanToImplied(item.odds) * item.weight;
      totalUnderWeight += item.weight;
    });
    let avgUnderProb =
      totalUnderWeight > 0 ? weightedUnderProb / totalUnderWeight : 0;

    if (removeVig) {
      const totalProb = avgOverProb + avgUnderProb;
      if (totalProb > 0) {
        avgOverProb /= totalProb;
        avgUnderProb = 1 - avgOverProb;
      }
    }
    return {
      over: probToAmerican(avgOverProb),
      under: probToAmerican(avgUnderProb),
    };
  };

  const trueOdds = calculateConsensus(sharpOver, sharpUnder, true);
  const marketOdds = calculateConsensus(marketOver, marketUnder, false);
  const trueMarketOdds = calculateConsensus(marketOver, marketUnder, true);

  if (!trueOdds || bookmakerOdds.length === 0) return null;

  return { trueOdds, marketOdds, trueMarketOdds, bookmakerOdds };
}

async function getLiveOdds() {
  if (!ODDS_API_KEY) {
    console.error("ERROR: Please add your key from The Odds API.");
    return;
  }
  let args = process.argv.slice(2);
  let cliMarkets = null;
  let daysAhead = FETCH_DAYS_AHEAD;

  const marketsIndex = args.indexOf("--markets");
  if (marketsIndex !== -1) {
    if (args.length > marketsIndex + 1) {
      cliMarkets = args[marketsIndex + 1];
      args.splice(marketsIndex, 2);
      console.log(
        `--- Market override: Fetching only '${cliMarkets}' markets ---`
      );
    }
  }
  const daysIndex = args.indexOf("--days");
  if (daysIndex !== -1) {
    if (args.length > daysIndex + 1) {
      const parsedDays = parseInt(args[daysIndex + 1], 10);
      if (!isNaN(parsedDays) && parsedDays > 0) {
        daysAhead = parsedDays;
        args.splice(daysIndex, 2);
      }
    }
  }

  const targetTeams = args;
  const isSpecificGameSearch = targetTeams.length > 0;
  console.log("\n--- Phase 1: Fetching all upcoming game IDs ---");
  let upcomingEvents = [];
  try {
    const eventRequests = Object.keys(SPORT_CONFIG).map((sport) => {
      const url = `https://api.the-odds-api.com/v4/sports/${sport}/events?apiKey=${ODDS_API_KEY}`;
      return axios.get(url);
    });
    const eventResponses = await Promise.all(eventRequests);
    eventResponses.forEach((response) => {
      if (response.data) upcomingEvents = upcomingEvents.concat(response.data);
    });
    console.log(`Found ${upcomingEvents.length} total upcoming events.`);
  } catch (error) {
    console.error(
      "API Request for events failed:",
      error.response ? error.response.data : error.message
    );
    return;
  }

  const now = new Date();
  const endDate = new Date();
  endDate.setDate(now.getDate() + daysAhead);
  const originalEventCount = upcomingEvents.length;
  upcomingEvents = upcomingEvents.filter((event) => {
    const eventTime = new Date(event.commence_time);
    return eventTime > now && eventTime < endDate;
  });
  console.log(`--- Filtering events within the next ${daysAhead} days ---`);
  console.log(
    `Filtered from ${originalEventCount} down to ${upcomingEvents.length} events.`
  );

  if (isSpecificGameSearch) {
    if (targetTeams.length % 2 !== 0) {
      console.error("Error: Please provide teams in pairs.");
      return;
    }
    const targetPairs = [];
    for (let i = 0; i < targetTeams.length; i += 2) {
      targetPairs.push({
        teamA: targetTeams[i].toLowerCase(),
        teamB: targetTeams[i + 1].toLowerCase(),
      });
    }
    console.log(
      `--- Specific Game Search Mode: Looking for ${targetPairs.length} game(s) ---`
    );
    const foundEvents = upcomingEvents.filter((event) => {
      const home = event.home_team.toLowerCase();
      const away = event.away_team.toLowerCase();
      return targetPairs.some(
        (pair) =>
          (home.includes(pair.teamA) && away.includes(pair.teamB)) ||
          (home.includes(pair.teamB) && away.includes(pair.teamA))
      );
    });
    if (foundEvents.length === 0) {
      console.error(
        "\nError: Could not find any matching games for the teams provided in the specified date range."
      );
      return;
    }
    console.log(`\nFound ${foundEvents.length} matching event(s).`);
    upcomingEvents = foundEvents;
  }
  if (upcomingEvents.length === 0) {
    console.log("No upcoming games found to fetch odds for.");
    return;
  }

  console.log("\n--- Phase 2: Fetching detailed odds for each event ---");
  let allGamesData = [];
  try {
    for (const event of upcomingEvents) {
      const sportConfig = SPORT_CONFIG[event.sport_key];
      if (!sportConfig) continue;

      // This is the updated logic to build the market string
      const marketsToFetch =
        cliMarkets ||
        sportConfig.markets
          .flatMap((category) => MARKET_DEFINITIONS[category] || [])
          .join(",");

      if (marketsToFetch.length === 0) {
        console.log(
          `No markets configured for event: ${event.home_team} vs ${event.away_team}. Skipping.`
        );
        continue;
      }

      const url = `https://api.the-odds-api.com/v4/sports/${event.sport_key}/events/${event.id}/odds?apiKey=${ODDS_API_KEY}&regions=${REGIONS}&markets=${marketsToFetch}&oddsFormat=${ODDS_FORMAT}`;
      const response = await axios.get(url);
      if (response.data) {
        allGamesData.push(response.data);
        console.log(
          `Fetched odds for event: ${event.home_team} vs ${event.away_team}`
        );
      }
      if (upcomingEvents.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY));
      }
    }
    console.log(
      `\nSuccessfully fetched detailed odds for ${allGamesData.length} event(s).`
    );
  } catch (error) {
    console.error(
      "API Request for detailed odds failed:",
      error.response ? error.response.data : error.message
    );
    return;
  }

  console.log("\n--- Phase 3: Processing all data ---");
  const { processedGameLines, processedPlayerProps } =
    processAllData(allGamesData);
  const dataToSave = {
    lastUpdated: new Date().toISOString(),
    games: processedGameLines,
  };
  fs.writeFileSync("games.json", JSON.stringify(dataToSave, null, 2));
  console.log(
    `\nSuccessfully saved ${processedGameLines.length} processed game lines to games.json`
  );
  const propsToSave = {
    lastUpdated: new Date().toISOString(),
    props: processedPlayerProps,
  };
  fs.writeFileSync("player_props.json", JSON.stringify(propsToSave, null, 2));
  console.log(
    `Successfully saved ${processedPlayerProps.length} processed player props to player_props.json`
  );
}

getLiveOdds();
