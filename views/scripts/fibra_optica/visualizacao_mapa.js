document.addEventListener("DOMContentLoaded", () => {
  const mapElement = document.getElementById("map");
  if (!mapElement) {
    console.error("Elemento do mapa não encontrado!");
    return;
  }

  const map = L.map("map").setView([-14.235, -51.925], 5);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const fetchAndDrawPoints = async () => {
    try {
      const response = await fetch("/api/fibra/todos-os-pontos");
      if (!response.ok) {
        throw new Error("Falha ao carregar os pontos do mapa.");
      }

      const pontos = await response.json();

      if (pontos.length > 0) {
        const bounds = [];
        pontos.forEach((ponto) => {
          if (ponto.latitude && ponto.longitude) {
            const marker = L.marker([ponto.latitude, ponto.longitude]).addTo(
              map
            );

            marker.bindPopup(`
              <b>TAG:</b> ${ponto.tag}<br>
              <b>Tipo:</b> ${ponto.tipo_ponto}<br>
              <b>Altitude:</b> ${ponto.altitude || "N/A"} m<br>
              <b>Coletor:</b> ${ponto.nome_coletor || "N/A"}<br>
              <b>Data:</b> ${new Date(ponto.created_at).toLocaleString("pt-BR")}
            `);

            bounds.push([ponto.latitude, ponto.longitude]);
          }
        });

        if (bounds.length > 0) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      } else {
        showToast("Nenhum ponto de mapa encontrado para exibir.", "info");
      }
    } catch (error) {
      console.error(error);
      showToast(error.message, "error");
    }
  };

  fetchAndDrawPoints();
});
