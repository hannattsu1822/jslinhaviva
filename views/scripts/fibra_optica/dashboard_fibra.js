document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".dashboard-card");

  cards.forEach((card) => {
    const url = card.dataset.url;
    if (!url) {
      return;
    }

    card.addEventListener("click", () => {
      window.location.href = url;
    });

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        window.location.href = url;
      }
    });
  });
});
