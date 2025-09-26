// js/ui.js
export const UI = {
  init() {
    this.tabButtons = document.querySelectorAll(".tab-btn");
    this.views = document.querySelectorAll(".view");

    this.tabButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        const viewId = e.currentTarget.dataset.view;
        this.activateTab(e.currentTarget);
        this.showView(viewId);
      });
    });

    this.activateTab(document.getElementById('tab-dashboard'));
    this.showView('dashboard-view');
  },

  showView(viewId) {
    this.views.forEach((view) => {
      if (view.id === viewId) {
        view.classList.add("active-view");
      } else {
        view.classList.remove("active-view");
      }
    });
  },

  activateTab(activeButton) {
    this.tabButtons.forEach((button) => {
      button.classList.remove("border-accent-red", "text-accent-red");
      button.classList.add(
        "border-transparent",
        "text-main-secondary"
      );
    });

    activeButton.classList.add("border-accent-red", "text-accent-red");
    activeButton.classList.remove("border-transparent", "text-main-secondary");
  },
};