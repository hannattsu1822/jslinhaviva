document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("map-points-form");
  const mapPointsContainer = document.getElementById("map-points-container");
  const btnAddMapPoint = document.getElementById("btn-add-map-point");
  const submitButton = document.getElementById("btn-submit-form");
  const recentPointsTableBody = document.getElementById(
    "recent-points-table-body"
  );

  const addMapPointRow = () => {
    const rowWrapper = document.createElement("div");
    rowWrapper.className = "map-point-row";
    rowWrapper.innerHTML = `
      <div class="input-row">
        <div class="input-group flex-2">
          <label>Tipo de Ponto</label>
          <select class="map-point-type" required>
            <option value="" disabled selected>Selecione o Tipo</option>
            <option value="Reserva">Reserva</option>
            <option value="Poste">Poste</option>
            <option value="Caixa de Emenda">Caixa de Emenda</option>
            <option value="Cliente">Cliente</option>
            <option value="Outro">Outro</option>
          </select>
        </div>
        <div class="input-group flex-1">
          <label>TAG do Ponto</label>
          <input type="text" class="map-point-tag" placeholder="Identificação" required>
        </div>
      </div>
      <div class="input-row">
        <div class="input-group">
          <label>Latitude</label>
          <input type="number" step="any" class="map-point-x" placeholder="-22.123456" required>
        </div>
      </div>
      <div class="input-row">
        <div class="input-group">
          <label>Longitude</label>
          <input type="number" step="any" class="map-point-y" placeholder="-45.123456" required>
        </div>
      </div>
      <div class="input-row action-row">
        <div class="input-group-buttons">
          <button type="button" class="btn-get-coords" aria-label="Obter Coordenadas GPS">
            <span class="material-symbols-outlined">my_location</span>
            Obter GPS
          </button>
          <button type="button" class="btn-remove-point" aria-label="Remover Ponto">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
      </div>
    `;
    mapPointsContainer.appendChild(rowWrapper);
  };

  const handleGetCoordinates = (button) => {
    if (!navigator.geolocation) {
      showToast("Geolocalização não é suportada por este navegador.", "error");
      return;
    }
    button.disabled = true;
    button.innerHTML = `<span class="material-symbols-outlined rotating">progress_activity</span>`;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const row = button.closest(".map-point-row");
        row.querySelector(".map-point-x").value =
          position.coords.latitude.toFixed(8);
        row.querySelector(".map-point-y").value =
          position.coords.longitude.toFixed(8);
        showToast("Coordenadas obtidas com sucesso!", "success");
        button.disabled = false;
        button.innerHTML = `<span class="material-symbols-outlined">my_location</span> Obter GPS`;
      },
      (error) => {
        showToast(`Erro ao obter GPS: ${error.message}`, "error");
        button.disabled = false;
        button.innerHTML = `<span class="material-symbols-outlined">my_location</span> Obter GPS`;
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleDeletePoint = async (pointId) => {
    if (
      !confirm(
        `Tem certeza que deseja excluir o ponto ID ${pointId}? Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    try {
      const response = await fetch(`/api/fibra/ponto-mapa/${pointId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      showToast(result.message, "success");
      const rowToRemove = recentPointsTableBody.querySelector(
        `tr[data-point-id="${pointId}"]`
      );
      if (rowToRemove) {
        rowToRemove.remove();
      }
    } catch (error) {
      showToast(error.message || "Erro ao excluir o ponto.", "error");
    }
  };

  btnAddMapPoint.addEventListener("click", addMapPointRow);

  mapPointsContainer.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".btn-remove-point");
    const getCoordsButton = event.target.closest(".btn-get-coords");
    if (removeButton) {
      removeButton.closest(".map-point-row").remove();
    }
    if (getCoordsButton) {
      handleGetCoordinates(getCoordsButton);
    }
  });

  if (recentPointsTableBody) {
    recentPointsTableBody.addEventListener("click", (event) => {
      const deleteButton = event.target.closest(".btn-delete-point");
      if (deleteButton) {
        const pointId = deleteButton.dataset.id;
        handleDeletePoint(pointId);
      }
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const pontosMapa = [];
    document.querySelectorAll(".map-point-row").forEach((row) => {
      const tipo = row.querySelector(".map-point-type").value;
      const tag = row.querySelector(".map-point-tag").value;
      const x = row.querySelector(".map-point-x").value;
      const y = row.querySelector(".map-point-y").value;
      if (tipo && tag && x && y) {
        pontosMapa.push({ tipo, tag, x, y });
      }
    });

    if (pontosMapa.length === 0) {
      showToast("Adicione e preencha ao menos um ponto para salvar.", "error");
      return;
    }

    const originalButtonHTML = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = `<span class="material-symbols-outlined rotating">progress_activity</span> Salvando...`;

    try {
      const response = await fetch("/api/fibra/salvar-pontos-mapa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pontos: pontosMapa }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      showToast(result.message, "success");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      showToast(
        error.message || "Falha na comunicação com o servidor.",
        "error"
      );
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonHTML;
    }
  });

  addMapPointRow();
});
