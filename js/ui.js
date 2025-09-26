export const UI = {
  init: function () {
    this.tabButtons = document.querySelectorAll(".tab-btn");
    this.views = document.querySelectorAll(".view");

    this.tabButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        this.switchView(e.currentTarget.dataset.view);
      });
    });

    // Set initial view - you can change this to 'tracker-view' if you want
    this.switchView("dashboard-view");
  },

  switchView: function (viewId) {
    // Hide all views
    this.views.forEach((view) => view.classList.add("hidden"));

    // Show the target view
    const targetView = document.getElementById(viewId);
    if (targetView) {
      targetView.classList.remove("hidden");
    }

    // Update button styles
    this.tabButtons.forEach((button) => {
      if (button.dataset.view === viewId) {
        button.classList.add("border-accent-red", "text-main-primary");
        button.classList.remove("border-transparent", "text-main-secondary");
      } else {
        button.classList.remove("border-accent-red", "text-main-primary");
        button.classList.add("border-transparent", "text-main-secondary");
      }
    });
  },
};