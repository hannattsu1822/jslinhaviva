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

  function aplicarPermissoesDashboard(user) {
    if (!user) return;
    const isAdmin = (user.nivel ?? 0) >= 7;
    const cardRegistro = document.getElementById("card-fibra-registro");
    if (cardRegistro && isAdmin) {
      cardRegistro.style.display = "";
    }
  }

  document.addEventListener("sidebar:ready", (event) => {
    aplicarPermissoesDashboard(event.detail?.user);
  });

  fetch("/api/me", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then(aplicarPermissoesDashboard)
    .catch(() => {});
});
