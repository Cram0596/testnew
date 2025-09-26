const axios = require("axios");
const fs = require("fs");

// --- Configuration ---
const ODDS_API_KEY = "ed63bd22ecf8ad019b69608e25b5c9c3";
const REGIONS = "us,us2,eu,au,us_ex";
const ODDS_FORMAT = "american";
const REQUEST_DELAY = 1000;
const FETCH_DAYS_AHEAD = 5;
const ALT_LINE_RANGE_LIMIT = 1.0; // For spreads and totals, limit alt lines to this range from main line
const MIN_ODDS_LIMIT = -5000;
const MAX_ODDS_LIMIT = 5000;
// Set a value to null to disable that filter.
const PREFILTER_MIN_ODDS = null; // Example: Ignores games with odds below.
const PREFILTER_MAX_ODDS = null; // Example: Ignores games with odds above.

const ONE_WAY_PROP_MARKETS = [
  "player_anytime_td",
  "player_1st_td",
  "player_last_td",
  "batter_home_runs",
  "batter_first_home_run",
  "pitcher_record_a_win",
];
const MARKET_DEFINITIONS = {
  gameLines: ["h2h", "spreads", "totals"],
  alternateLines: ["alternate_spreads", "alternate_totals"],

  // --- American Football Props ---
  footballPassingProps: [
    "player_pass_yds",
    "player_pass_tds",
    "player_pass_attempts",
    "player_pass_completions",
    "player_pass_interceptions",
    "player_pass_longest_completion",
  ],
  footballRushingProps: [
    "player_rush_yds",
    "player_rush_attempts",
    "player_rush_longest",
  ],
  footballReceivingProps: [
    "player_reception_yds", // REVERTED: This is the correct key
    "player_receptions",
    "player_reception_longest",
  ],
  footballComboProps: [
    "player_pass_rush_yds",
    "player_rush_reception_yds",
    "player_pass_rush_reception_yds",
  ],
  footballTdScorerProps: [
    "player_pass_tds",
    "player_rush_tds",
    "player_reception_tds",
    "player_pass_rush_reception_tds",
    "player_rush_reception_tds",
  ],
  footballKickingProps: [
    "player_kicking_points",
    "player_field_goals",
    "player_pats",
  ],
  footballDefensiveProps: [
    "player_tackles_assists",
    "player_solo_tackles",
    "player_sacks",
    "player_defensive_interceptions",
  ],
  footballOneWayProps: ["player_anytime_td", "player_1st_td", "player_last_td"],

  // --- Alternate American Football Props ---
  footballAlternatePassingProps: [
    "player_pass_yds_alternate",
    "player_pass_tds_alternate",
    "player_pass_attempts_alternate",
    "player_pass_completions_alternate",
    "player_pass_interceptions_alternate",
    "player_pass_longest_completion_alternate",
  ],
  footballAlternateRushingProps: [
    "player_rush_yds_alternate",
    "player_rush_attempts_alternate",
    "player_rush_longest_alternate",
  ],
  footballAlternateReceivingProps: [
    "player_reception_yds_alternate", // REVERTED: This is the correct key
    "player_receptions_alternate",
    "player_reception_longest_alternate",
  ],
  footballAlternateComboProps: [
    "player_pass_rush_yds_alternate",
    "player_rush_reception_yds_alternate",
    "player_pass_rush_reception_yds_alternate",
  ],
  footballAlternateKickingProps: [
    "player_kicking_points_alternate",
    "player_field_goals_alternate",
    "player_pats_alternate",
  ],
  footballAlternateDefensiveProps: [
    "player_tackles_assists_alternate",
    "player_solo_tackles_alternate",
    "player_sacks_alternate",
  ],

  // --- NBA Player Props ---
  nbaPlayerProps: [
    "player_points",
    "player_rebounds",
    "player_assists",
    "player_threes",
    "player_steals",
    "player_blocks",
    "player_turnovers",
  ],

  // --- MLB Player Props ---
  mlbBattingProps: [
    "batter_home_runs",
    "batter_hits",
    "batter_total_bases",
    "batter_rbis",
    "batter_runs_scored",
    "batter_hits_runs_rbis",
    "batter_singles",
    "batter_doubles",
    "batter_triples",
    "batter_walks",
    "batter_strikeouts",
    "batter_stolen_bases",
  ],
  mlbPitchingProps: [
    "pitcher_strikeouts",
    "pitcher_hits_allowed",
    "pitcher_walks",
    "pitcher_earned_runs",
    "pitcher_outs",
  ],
  mlbOneWayProps: ["batter_first_home_run", "pitcher_record_a_win"],
  mlbAlternateBattingProps: [
    "batter_total_bases_alternate",
    "batter_home_runs_alternate",
    "batter_hits_alternate",
    "batter_rbis_alternate",
    "batter_walks_alternate",
    "batter_strikeouts_alternate",
    "batter_runs_scored_alternate",
    "batter_singles_alternate",
    "batter_doubles_alternate",
    "batter_triples_alternate",
  ],
  mlbAlternatePitchingProps: [
    "pitcher_hits_allowed_alternate",
    "pitcher_walks_alternate",
    "pitcher_strikeouts_alternate",
  ],
};

// To enable a sport, uncomment its block.
const SPORT_CONFIG = {
  americanfootball_nfl: {
    markets: [
      "gameLines",
      // "alternateLines",
      // "footballPassingProps",
      // "footballRushingProps",
      // "footballReceivingProps",
      // "footballComboProps",
      // "footballTdScorerProps",
      // "footballKickingProps",
      // "footballDefensiveProps",
      // "footballOneWayProps",
      // "footballAlternatePassingProps",
      // "footballAlternateRushingProps",
      // "footballAlternateReceivingProps",
      // "footballAlternateComboProps",
      // "footballAlternateKickingProps",
      // "footballAlternateDefensiveProps",
    ],
  },
  // americanfootball_ncaaf: {
  //   markets: ["gameLines", "alternateLines"],
  // },
  // basketball_nba: {
  //   markets: ["gameLines", "alternateLines", "nbaPlayerProps"],
  // },
  // baseball_mlb: {
  //   markets: [
  //     "gameLines",
  //     "mlbBattingProps",
  //     "mlbPitchingProps",
  //     "mlbOneWayProps",
  //     "mlbAlternateBattingProps",
  //     "mlbAlternatePitchingProps",
  //   ],
  // },
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
  bet365_au: {
    type: "market",
    weights: {
      default: 1.25,
      baseball_mlb: 1.65,
      mma_mixed_martial_arts: 1.75,
      americanfootball_nfl: 1.75,
      americanfootball_ncaaf: 1.75,
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
  bet365_au: {
    type: "market",
    weights: {
      default: 1.25,
      baseball_mlb: 1.75,
      mma_mixed_martial_arts: 1.75,
      americanfootball_nfl: 4.9,
      americanfootball_ncaaf: 1.7,
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

const EV_TAB_WEIGHTS = {
  // --- Tier 1: The Benchmark Sharp Book (Total: 14.4578%) ---
  pinnacle: { type: "sharp", weights: { default: 3.0 } }, // 14.4578%

  // --- Tier 2: Premier Sharp Books (Total: 24.0964%) ---
  betonlineag: { type: "sharp", weights: { default: 2.5 } }, // 12.0482%
  fanduel: { type: "market", weights: { default: 2.5 } }, // 12.0482%

  // --- Tier 3: Sharp Exchanges (Total: 28.9157%) ---
  novig: { type: "sharp", weights: { default: 2.0 } }, // 9.6386%
  prophetx: { type: "sharp", weights: { default: 2.0 } }, // 9.6386%
  lowvig: { type: "sharp", weights: { default: 2.0 } }, // 9.6386%

  // --- Tier 4: Top-Tier Market Makers (Total: 8.4337%) ---
  draftkings: { type: "market", weights: { default: 1.75 } }, // 8.4337%

  // --- Tier 5: Major Market Books (Total: 4.8193%) ---
  williamhill_us: { type: "market", weights: { default: 1.0 } }, // 4.8193%

  // --- Tier 6: Standard Market Books (Total: 14.4578%) ---
  espnbet: { type: "market", weights: { default: 0.75 } }, // 3.6145%
  fanatics: { type: "market", weights: { default: 0.75 } }, // 3.6145%
  hardrockbet: { type: "market", weights: { default: 0.75 } }, // 3.6145%
  bet365_au: { type: "market", weights: { default: 0.75 } }, // 3.6145%

  // --- Tier 7: Softer / Smaller Books (Total: 4.8193%) ---
  betmgm: { type: "market", weights: { default: 0.25 } }, // 1.2048%
  betrivers: { type: "market", weights: { default: 0.25 } }, // 1.2048%
  ballybet: { type: "market", weights: { default: 0.25 } }, // 1.2048%
  fliff: { type: "market", weights: { default: 0.25 } }, // 1.2048%
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
function calculateConsensus(overPool, underPool, removeVig) {
  if (overPool.length === 0 || underPool.length === 0) return null;

  let weightedOverProb = 0,
    totalOverWeight = 0;
  overPool.forEach((item) => {
    weightedOverProb += americanToImplied(item.odds) * item.weight;
    totalOverWeight += item.weight;
  });
  const avgOverProb =
    totalOverWeight > 0 ? weightedOverProb / totalOverWeight : 0;

  let weightedUnderProb = 0,
    totalUnderWeight = 0;
  underPool.forEach((item) => {
    weightedUnderProb += americanToImplied(item.odds) * item.weight;
    totalUnderWeight += item.weight;
  });
  const avgUnderProb =
    totalUnderWeight > 0 ? weightedUnderProb / totalUnderWeight : 0;

  let finalOverProb = avgOverProb;
  if (removeVig) {
    const totalProb = avgOverProb + avgUnderProb;
    if (totalProb > 1) {
      // Only remove vig if total probability is over 100%
      finalOverProb = avgOverProb / totalProb;
    }
  }

  return {
    over: probToAmerican(finalOverProb),
    under: probToAmerican(1 - finalOverProb),
  };
}
function processAllData(allGames) {
  const processedGameLines = [];
  const propsMap = new Map();
  const oneWayMarketsMap = new Map(); // For markets like TD scorers

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

    // --- Game Line Processing (No Change) ---
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
    const allTotalOdds = allMarkets.filter(
      (m) => m.key === "totals" || m.key === "alternate_totals"
    );
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
      // Filtering alternate lines logic... (No Change)
      processedGameLines.push(gameData);
    }

    // --- Prop Market Processing (UPDATED) ---
    const propMarkets = allMarkets.filter(
      (m) =>
        m.key.startsWith("player_") ||
        m.key.startsWith("batter_") ||
        m.key.startsWith("pitcher_")
    );

    for (const market of propMarkets) {
      // Check if this is a one-way market
      if (ONE_WAY_PROP_MARKETS.includes(market.key)) {
        const marketId = `${game.id}-${market.key}`;
        if (!oneWayMarketsMap.has(marketId)) {
          oneWayMarketsMap.set(marketId, {
            gameId: game.id,
            sport: game.sport_title,
            gameTime: game.commence_time,
            teamA: game.home_team,
            teamB: game.away_team,
            market: market.key,
            outcomes: [],
          });
        }
        oneWayMarketsMap.get(marketId).outcomes.push(
          ...market.outcomes.map((o) => ({
            ...o,
            bookmaker: market.bookmaker,
          }))
        );
      } else {
        // It's a two-way market (Over/Under)
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
  }

  // Process all the collected props
  let processedPlayerProps = [];
  for (const propData of propsMap.values()) {
    const processedProp = processPropMarket(propData, PROP_BOOK_WEIGHTS);
    if (processedProp) {
      delete propData.odds;
      processedPlayerProps.push({ ...propData, ...processedProp });
    }
  }

  // NEW: Process all the one-way markets
  for (const oneWayMarketData of oneWayMarketsMap.values()) {
    const processedOneWayProps = processOneWayMarket(
      oneWayMarketData,
      PROP_BOOK_WEIGHTS
    );
    if (processedOneWayProps) {
      processedPlayerProps.push(...processedOneWayProps);
    }
  }

  return { processedGameLines, processedPlayerProps };
}

function processMoneylineMarket(game, allOdds, bookWeights) {
  const sharpOdds = [];
  const marketOddsList = [];
  const allBookmakerOdds = [];
  const evTabPool = [];

  for (const market of allOdds) {
    const bookConfig = bookWeights[market.bookmaker];
    if (!bookConfig) continue;

    const homeOutcome = market.outcomes.find((o) => o.name === game.home_team);
    const awayOutcome = market.outcomes.find((o) => o.name === game.away_team);

    if (homeOutcome && awayOutcome) {
      if (
        homeOutcome.price < MIN_ODDS_LIMIT ||
        homeOutcome.price > MAX_ODDS_LIMIT ||
        awayOutcome.price < MIN_ODDS_LIMIT ||
        awayOutcome.price > MAX_ODDS_LIMIT
      ) {
        console.log(
          `- Ignoring outlier odds from ${market.bookmaker} for ${game.home_team} ML.`
        );
        continue;
      }

      const oddsData = {
        oddsA: homeOutcome.price,
        oddsB: awayOutcome.price,
        weight:
          bookConfig.weights[game.sport_key] || bookConfig.weights.default,
      };
      if (bookConfig.type === "sharp") sharpOdds.push(oddsData);
      else marketOddsList.push(oddsData);

      const evTabBookConfig = EV_TAB_WEIGHTS[market.bookmaker];
      if (evTabBookConfig) {
        const evTabWeight =
          evTabBookConfig.weights[game.sport_key] ||
          evTabBookConfig.weights.default;
        evTabPool.push({
          oddsA: homeOutcome.price,
          oddsB: awayOutcome.price,
          weight: evTabWeight,
        });
      }

      const vigFreeLine = calculateVigFreeLine({
        oddsA: homeOutcome.price,
        oddsB: awayOutcome.price,
      });
      allBookmakerOdds.push({
        bookmaker: market.bookmaker,
        type: bookConfig.type,
        vigOdds: { oddsA: homeOutcome.price, oddsB: awayOutcome.price },
        trueOdds: vigFreeLine,
      });
    }
  }

  const trueOdds = calculateConsensusLine(sharpOdds, true);
  const marketOdds = calculateConsensusLine(marketOddsList, false);
  const trueMarketOdds = calculateConsensusLine(marketOddsList, true);
  const evTabTrueOdds = calculateConsensusLine(evTabPool, true);

  if (trueOdds && marketOdds && trueMarketOdds && evTabTrueOdds) {
    return {
      trueOdds,
      marketOdds,
      trueMarketOdds,
      evTabTrueOdds,
      bookmakerOdds: allBookmakerOdds,
    };
  }
  return null;
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
    const evTabPool = [];

    for (const line of bookmakerLines) {
      const bookConfig = bookWeights[line.bookmaker];
      if (!bookConfig) continue;

      if (
        line.homeOutcome.price < MIN_ODDS_LIMIT ||
        line.homeOutcome.price > MAX_ODDS_LIMIT ||
        line.awayOutcome.price < MIN_ODDS_LIMIT ||
        line.awayOutcome.price > MAX_ODDS_LIMIT
      ) {
        console.log(
          `- Ignoring outlier ${marketKey} odds from ${line.bookmaker} for point ${point}.`
        );
        continue;
      }

      const oddsData = {
        oddsA: line.homeOutcome.price,
        oddsB: line.awayOutcome.price,
        weight:
          bookConfig.weights[game.sport_key] || bookConfig.weights.default,
      };
      if (bookConfig.type === "sharp") sharpOdds.push(oddsData);
      else marketOddsList.push(oddsData);

      const evTabBookConfig = EV_TAB_WEIGHTS[line.bookmaker];
      if (evTabBookConfig) {
        const evTabWeight =
          evTabBookConfig.weights[game.sport_key] ||
          evTabBookConfig.weights.default;
        evTabPool.push({
          oddsA: line.homeOutcome.price,
          oddsB: line.awayOutcome.price,
          weight: evTabWeight,
        });
      }

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
    }

    if (sharpOdds.length > 0) {
      const trueOdds = calculateConsensusLine(sharpOdds, true);
      const marketOdds =
        marketOddsList.length > 0
          ? calculateConsensusLine(marketOddsList, false)
          : null;
      const trueMarketOdds =
        marketOddsList.length > 0
          ? calculateConsensusLine(marketOddsList, true)
          : null;
      const evTabTrueOdds = calculateConsensusLine(evTabPool, true);

      if (trueOdds && evTabTrueOdds) {
        processedLines.push({
          point,
          trueOdds,
          marketOdds,
          trueMarketOdds,
          evTabTrueOdds,
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
  const evTabPoolOver = [];
  const evTabPoolUnder = [];

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

    const overOdds = book.vigOdds.over;
    const underOdds = book.vigOdds.under;

    if (
      (overOdds !== null &&
        (overOdds < MIN_ODDS_LIMIT || overOdds > MAX_ODDS_LIMIT)) ||
      (underOdds !== null &&
        (underOdds < MIN_ODDS_LIMIT || underOdds > MAX_ODDS_LIMIT))
    ) {
      console.log(
        `- Ignoring outlier prop odds from ${book.bookmaker} for ${propData.player} ${propData.point}.`
      );
      continue;
    }

    const weight =
      bookConfig.weights[propData.sport] || bookConfig.weights.default;
    if (overOdds)
      (bookConfig.type === "sharp" ? sharpOver : marketOver).push({
        odds: overOdds,
        weight,
      });
    if (underOdds)
      (bookConfig.type === "sharp" ? sharpUnder : marketUnder).push({
        odds: underOdds,
        weight,
      });

    const evTabBookConfig = EV_TAB_WEIGHTS[book.bookmaker];
    if (evTabBookConfig) {
      const evTabWeight =
        evTabBookConfig.weights[propData.sport] ||
        evTabBookConfig.weights.default;
      if (overOdds) evTabPoolOver.push({ odds: overOdds, weight: evTabWeight });
      if (underOdds)
        evTabPoolUnder.push({ odds: underOdds, weight: evTabWeight });
    }
  }

  const trueOdds = calculateConsensus(sharpOver, sharpUnder, true);
  const marketOdds = calculateConsensus(marketOver, marketUnder, false);
  const trueMarketOdds = calculateConsensus(marketOver, marketUnder, true);
  const evTabTrueOdds = calculateConsensus(evTabPoolOver, evTabPoolUnder, true);

  if (!trueOdds || !evTabTrueOdds || bookmakerOdds.length === 0) return null;

  return { trueOdds, marketOdds, trueMarketOdds, evTabTrueOdds, bookmakerOdds };
}

function processOneWayMarket(marketData, bookWeights) {
  const outcomesByPlayer = new Map();

  for (const outcome of marketData.outcomes) {
    const playerName = outcome.name;
    if (!outcomesByPlayer.has(playerName)) {
      outcomesByPlayer.set(playerName, []);
    }
    outcomesByPlayer
      .get(playerName)
      .push({ bookmaker: outcome.bookmaker, price: outcome.price });
  }

  const sharpBookTotals = new Map();
  for (const outcome of marketData.outcomes) {
    if (outcome.price < MIN_ODDS_LIMIT || outcome.price > MAX_ODDS_LIMIT) {
      console.log(
        `- Ignoring outlier one-way odds from ${outcome.bookmaker} for ${outcome.name}.`
      );
      continue;
    }
    const bookConfig = bookWeights[outcome.bookmaker];
    if (bookConfig && bookConfig.type === "sharp") {
      const currentTotal = sharpBookTotals.get(outcome.bookmaker) || 0;
      sharpBookTotals.set(
        outcome.bookmaker,
        currentTotal + americanToImplied(outcome.price)
      );
    }
  }

  // UPDATED LOGIC: Calculate a weighted average of true probabilities
  const playerTrueProbs = new Map();
  for (const [player, oddsList] of outcomesByPlayer.entries()) {
    let weightedProbSum = 0;
    let totalWeight = 0;
    for (const odd of oddsList) {
      const evTabBookConfig = EV_TAB_WEIGHTS[odd.bookmaker];
      const totalMarketProb = sharpBookTotals.get(odd.bookmaker);

      if (
        evTabBookConfig &&
        evTabBookConfig.type === "sharp" &&
        totalMarketProb > 0
      ) {
        const trueProb = americanToImplied(odd.price) / totalMarketProb;
        const weight =
          evTabBookConfig.weights[marketData.sport] ||
          evTabBookConfig.weights.default;
        weightedProbSum += trueProb * weight;
        totalWeight += weight;
      }
    }
    if (totalWeight > 0) {
      const consensusProb = weightedProbSum / totalWeight;
      playerTrueProbs.set(player, consensusProb);
    }
  }

  const finalProps = [];
  for (const [player, oddsList] of outcomesByPlayer.entries()) {
    const trueProb = playerTrueProbs.get(player);
    if (trueProb) {
      const allBookmakerOdds = oddsList.map((o) => {
        const bookConfig = bookWeights[o.bookmaker];
        return {
          bookmaker: o.bookmaker,
          type: bookConfig?.type,
          vigOdds: { over: o.price, under: null }, // Use 'over' for the 'yes' price
          trueOdds: null,
        };
      });

      finalProps.push({
        propId: `${marketData.gameId}-${marketData.market}-${player}`,
        gameId: marketData.gameId,
        sport: marketData.sport,
        gameTime: marketData.gameTime,
        teamA: marketData.teamA,
        teamB: marketData.teamB,
        player: player,
        market: marketData.market,
        point: null,
        trueOdds: null,
        marketOdds: null,
        trueMarketOdds: null,
        trueProb: trueProb,
        bookmakerOdds: allBookmakerOdds,
      });
    }
  }
  return finalProps.length > 0 ? finalProps : null;
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

  // --- Phase 1: Fetching Events ---
  console.log("\n--- Phase 1: Fetching all upcoming game IDs ---");
  let upcomingEvents = [];
  try {
    const eventRequests = Object.keys(SPORT_CONFIG).map((sport) => {
      const url = `https://api.the-odds-api.com/v4/sports/${sport}/events?apiKey=${ODDS_API_KEY}&bookmakers=draftkings`;
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

  // --- Filtering by Date and Team ---
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

  // --- Pre-filtering by Odds using the new constants ---
  if (PREFILTER_MIN_ODDS !== null || PREFILTER_MAX_ODDS !== null) {
    console.log(
      `\n--- Pre-filtering events by odds: Min ${
        PREFILTER_MIN_ODDS ?? "N/A"
      }, Max ${PREFILTER_MAX_ODDS ?? "N/A"} ---`
    );
    const originalCount = upcomingEvents.length;
    upcomingEvents = upcomingEvents.filter((event) => {
      if (
        !event.bookmakers ||
        !event.bookmakers[0] ||
        !event.bookmakers[0].markets[0]
      ) {
        return true;
      }
      const outcomes = event.bookmakers[0].markets[0].outcomes;
      if (outcomes.length < 2) return true;

      const odds1 = outcomes[0].price;
      const odds2 = outcomes[1].price;

      const minFilter =
        PREFILTER_MIN_ODDS !== null
          ? odds1 >= PREFILTER_MIN_ODDS && odds2 >= PREFILTER_MIN_ODDS
          : true;
      const maxFilter =
        PREFILTER_MAX_ODDS !== null
          ? odds1 <= PREFILTER_MAX_ODDS && odds2 <= PREFILTER_MAX_ODDS
          : true;

      return minFilter && maxFilter;
    });
    console.log(
      `Filtered from ${originalCount} down to ${upcomingEvents.length} events based on moneyline odds.`
    );
  }

  if (upcomingEvents.length === 0) {
    console.log("No upcoming games found to fetch odds for.");
    return;
  }

  // --- Phase 2: Fetching Detailed Odds ---
  console.log("\n--- Phase 2: Fetching detailed odds for each event ---");
  let allGamesData = [];
  try {
    for (const event of upcomingEvents) {
      const sportConfig = SPORT_CONFIG[event.sport_key];
      if (!sportConfig) continue;

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

  // --- Phase 3: Processing and Saving Data ---
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