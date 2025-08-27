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
    rowWrapper.className = "map-point-row border rounded p-3 mb-4";
    rowWrapper.innerHTML = `
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label">Tipo de Ponto</label>
          <select class="form-select map-point-type" required>
            <option value="" disabled selected>Selecione o Tipo</option>
            <option value="Reserva">Reserva</option>
            <option value="Poste">Poste</option>
            <option value="Caixa de Emenda">Caixa de Emenda</option>
            <option value="Cliente">Cliente</option>
            <option value="Outro">Outro</option>
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label">TAG do Ponto</label>
          <input type="text" class="form-control map-point-tag" placeholder="Identificação do ponto" required>
        </div>
        <div class="col-md-3">
          <label class="form-label">Zona UTM</label>
          <input type="text" class="form-control map-point-utm-zone" placeholder="Ex: 24L" required>
        </div>
        <div class="col-md-3">
          <label class="form-label">Coordenada Leste</label>
          <input type="number" step="any" class="form-control map-point-easting" placeholder="Easting" required>
        </div>
        <div class="col-md-3">
          <label class="form-label">Coordenada Norte</label>
          <input type="number" step="any" class="form-control map-point-northing" placeholder="Northing" required>
        </div>
        <div class="col-md-3">
          <label class="form-label">Elevação (m)</label>
          <input type="number" step="any" class="form-control map-point-altitude" placeholder="Altitude" required>
        </div>
      </div>
      <div class="d-flex justify-content-end mt-3">
        <button type="button" class="btn btn-danger btn-sm btn-remove-point" aria-label="Remover Ponto">
          <i class="fa-solid fa-trash-can"></i> Remover
        </button>
      </div>
    `;
    mapPointsContainer.appendChild(rowWrapper);
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
    if (removeButton) {
      removeButton.closest(".map-point-row").remove();
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
      const utm_zone = row.querySelector(".map-point-utm-zone").value;
      const easting = row.querySelector(".map-point-easting").value;
      const northing = row.querySelector(".map-point-northing").value;
      const altitude = row.querySelector(".map-point-altitude").value;

      if (tipo && tag && utm_zone && easting && northing && altitude) {
        pontosMapa.push({ tipo, tag, utm_zone, easting, northing, altitude });
      }
    });

    if (pontosMapa.length === 0) {
      showToast("Adicione e preencha ao menos um ponto para salvar.", "error");
      return;
    }

    const originalButtonHTML = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...`;

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
