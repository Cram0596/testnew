const axios = require("axios");
const fs = require("fs");
const readline = require("readline");
require("dotenv").config(); // Loads environment variables from .env file

// --- Configuration ---
const API_KEY = process.env.API_KEY; // Use the key from the .env file
const SPORTS = ["baseball_mlb", "basketball_wnba"];
const PLAYS_FILE = "system_plays.json"; // Define file name for consistency

// --- Helper Functions ---
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) =>
  new Promise((resolve) => rl.question(query, resolve));

// --- Main Processing Function ---
async function gradeBetsWithAPI() {
  console.log("Starting automated bet grading process...");

  if (!API_KEY) {
    console.error(
      "API Key not found. Please create a .env file with your API_KEY."
    );
    return;
  }

  let systemPlays;
  try {
    systemPlays = JSON.parse(fs.readFileSync(PLAYS_FILE, "utf8"));
  } catch (e) {
    console.log(`No ${PLAYS_FILE} file found or file is empty.`);
    return;
  }

  const pendingPlays = systemPlays.filter(
    (p) => p.status === "pending" && new Date(p.timestamp) < new Date()
  );

  if (pendingPlays.length === 0) {
    console.log("No completed games with pending bets to grade.");
    return;
  }

  console.log(
    `Found ${pendingPlays.length} pending plays for completed games. Fetching scores...`
  );

  const requests = SPORTS.map((sport) => {
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/scores/?daysFrom=3&apiKey=${API_KEY}`;
    return axios.get(url);
  });

  try {
    const responses = await Promise.all(requests);
    let allScores = [];
    responses.forEach((response) => {
      if (response.data && response.data.length > 0) {
        allScores = allScores.concat(response.data);
      }
    });

    let updatedCount = 0;
    pendingPlays.forEach((play) => {
      const scoreData = allScores.find((s) => s.id === play.gameId);

      if (scoreData && scoreData.completed) {
        const homeScoreData = scoreData.scores.find(
          (s) => s.name === play.teamA
        );
        const awayScoreData = scoreData.scores.find(
          (s) => s.name === play.teamB
        );

        if (!homeScoreData || !awayScoreData) {
          console.log(
            `Could not find scores for both teams in game ID ${play.gameId}. Skipping.`
          );
          return;
        }

        const homeScore = parseInt(homeScoreData.score);
        const awayScore = parseInt(awayScoreData.score);

        let result = "pending";

        // --- NEW GRADING LOGIC ---
        const isBetOnHome = play.sideName.includes(play.teamA);

        switch (play.marketType) {
          case "moneyline":
            if (homeScore > awayScore) result = isBetOnHome ? "win" : "loss";
            else if (awayScore > homeScore)
              result = !isBetOnHome ? "win" : "loss";
            // No pushes in moneyline (unless it's a 3-way market, which is not handled here)
            break;

          case "spreads":
            const homeSpreadResult = homeScore + play.point;
            const awaySpreadResult = awayScore - play.point;

            if (isBetOnHome) {
              if (homeSpreadResult > awayScore) result = "win";
              else if (homeSpreadResult < awayScore) result = "loss";
              else result = "push";
            } else {
              // Bet is on away team
              if (awaySpreadResult > homeScore) result = "win";
              else if (awaySpreadResult < homeScore) result = "loss";
              else result = "push";
            }
            break;

          case "totals":
            const totalScore = homeScore + awayScore;
            const isBetOnOver = play.sideName.includes("Over");

            if (totalScore > play.point) result = isBetOnOver ? "win" : "loss";
            else if (totalScore < play.point)
              result = !isBetOnOver ? "win" : "loss";
            else result = "push";
            break;

          default:
            result = "pending"; // Keep as pending if market type is unknown
        }

        if (result !== "pending") {
          const playIndex = systemPlays.findIndex((p) => p.id === play.id);
          if (playIndex > -1) {
            systemPlays[playIndex].status = result;
            updatedCount++;
          }
        }
      }
    });

    if (updatedCount > 0) {
      fs.writeFileSync(PLAYS_FILE, JSON.stringify(systemPlays, null, 2));
      console.log(`Grading complete. Updated ${updatedCount} plays.`);
    } else {
      console.log("Grading complete. No plays were updated.");
    }
  } catch (error) {
    console.error(
      "API Request for scores failed:",
      error.response ? error.response.data : error.message
    );
  }
}

// --- Manual Grading (Optional) ---
// Manual grading logic remains the same.
async function manualGrade() {
  // ... manual grading code ...
  // This part of the script is unchanged.
}

// --- Script Execution ---
(async () => {
  // Check for --manual flag, otherwise run automated grading
  if (process.argv.includes("--manual")) {
    await manualGrade();
    rl.close();
  } else {
    await gradeBetsWithAPI();
  }
})();
