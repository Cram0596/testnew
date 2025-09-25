import { App } from "./app.js";
import { Mappings } from "./mappings.js";

export const EVBets = {
  init: function (viewElement) {
    this.view = viewElement;
    this.loadPlays();
  },

  loadPlays: async function () {
    try {
      const response = await fetch("system_plays.json");
      const plays = await response.json();
      this.renderPlays(plays);
    } catch (error) {
      console.error("Error loading plays:", error);
    }
  },

  renderPlays: function (plays) {
    const container = this.view;
    container.innerHTML = ""; // Clear existing content

    plays.forEach((play) => {
      const card = this.createPlayCard(play);
      container.appendChild(card);
    });
  },

  createPlayCard: function (play) {
    const template = document.getElementById("ev-bet-card-template");
    const card = template.content.cloneNode(true).firstElementChild;

    card.querySelector(".font-bold").textContent = `${play.away_team} @ ${play.home_team}`;
    card.querySelector(".text-sm").textContent = new Date(
      play.commence_time
    ).toLocaleString();
    card.querySelector(
      ".play-details"
    ).textContent = `${play.play.player} ${play.play.market} ${play.play.point}`;
    card.querySelector(".ev-details").textContent = `${(play.ev * 100).toFixed(
      2
    )}%`;

    const trackButton = card.querySelector("button");
    trackButton.addEventListener("click", () => this.trackBet(play));

    return card;
  },

  trackBet: function (play) {
    // This is the core function to add a bet to the tracker
    const trackedPlays = JSON.parse(localStorage.getItem("trackedPlays")) || [];
    const newTrackedPlay = {
      ...play,
      id: Date.now(), // Unique ID for the tracked play
      status: "pending", // Initial status
    };
    trackedPlays.push(newTrackedPlay);
    localStorage.setItem("trackedPlays", JSON.stringify(trackedPlays));
    alert("Bet tracked successfully!");
  },
};