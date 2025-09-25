import { App } from "./app.js";
export const UI = {
  init() {
    const savedTheme = localStorage.getItem("theme") || "dark";
    this.applyTheme(savedTheme);
    App.elements.themeToggle.addEventListener("click", () => {
      const newTheme =
        document.documentElement.getAttribute("data-theme") === "dark"
          ? "light"
          : "dark";
      this.applyTheme(newTheme);
    });
    App.elements.tabs.forEach((button) => {
      button.addEventListener("click", () => this.activateTab(button));
    });
  },
  applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    App.elements.themeIconSun.classList.toggle("hidden", theme === "dark");
    App.elements.themeIconMoon.classList.toggle("hidden", theme === "light");
    localStorage.setItem("theme", theme);
  },
  showView(viewId) {
    App.elements.views.forEach((view) => {
      view.classList.add("hidden");
    });
    const targetView = document.getElementById(viewId);
    if (targetView) {
      targetView.classList.remove("hidden");
    }
  },
  activateTab(activeButton) {
    // Deactivate all tab buttons first
    App.elements.tabs.forEach((button) => {
      button.classList.remove("border-accent-red", "text-accent-red");
      button.classList.add(
        "border-transparent",
        "text-main-secondary",
        "hover:text-main-primary",
        "hover:border-gray-300"
      );
    });

    // Activate the clicked tab button
    activeButton.classList.add("border-accent-red", "text-accent-red");
    activeButton.classList.remove("border-transparent", "text-main-secondary");

    // Show the target view
    const viewId = activeButton.dataset.view;
    this.showView(viewId);
  },
};
