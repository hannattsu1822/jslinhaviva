document.addEventListener("DOMContentLoaded", function () {
  const vehicleForm = document.getElementById("vehicleForm");
  const vehicleTableBody = document.getElementById("vehicleTableBody");
  const toastContainer = document.getElementById("toastContainer");

  const toggleFormBtn = document.getElementById("toggleFormBtn");
  const formContainer = document.getElementById("formContainer");
  const closeFormBtn = document.getElementById("closeFormBtn");

  const filterId = document.getElementById("filterId");
  const filterCodigo = document.getElementById("filterCodigo");
  const filterPlaca = document.getElementById("filterPlaca");
  const filterNome = document.getElementById("filterNome");

  if (toggleFormBtn) {
    toggleFormBtn.addEventListener("click", () => {
      formContainer.classList.toggle("hidden");
    });
  }
  if (closeFormBtn) {
    closeFormBtn.addEventListener("click", () => {
      formContainer.classList.add("hidden");
    });
  }

  function showToast(title, message, isError = false) {
    const toast = document.createElement("div");
    toast.className = `toast ${isError ? "error" : "success"}`;
    toast.innerHTML = `<div class="toast-title">${title}</div><div>${message}</div>`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
      toast.classList.remove("show");
      toast.addEventListener("transitionend", () => toast.remove());
    }, 5000);
  }

  async function loadVehicles() {
    try {
      const response = await fetch("/api/frota_inventario");
      if (!response.ok) throw new Error("Falha ao carregar os veículos.");

      const vehicles = await response.json();
      vehicleTableBody.innerHTML = "";

      if (vehicles.length === 0) {
        vehicleTableBody.innerHTML =
          '<tr><td colspan="5" style="text-align: center;">Nenhum veículo cadastrado.</td></tr>';
        return;
      }

      vehicles.forEach((vehicle) => {
        const row = document.createElement("tr");
        row.innerHTML = `
                    <td>${vehicle.id}</td>
                    <td>${vehicle.codigo || ""}</td>
                    <td>${vehicle.placa}</td>
                    <td>${vehicle.nome}</td>
                    <td class="actions">
                        <button class="btn btn-danger delete-btn" data-id="${
                          vehicle.id
                        }" title="Excluir">
                            <i class="material-icons">delete</i>
                        </button>
                    </td>
                `;
        vehicleTableBody.appendChild(row);
      });
    } catch (error) {
      console.error("Erro:", error);
      showToast("Erro", "Não foi possível carregar a lista de veículos.", true);
    }
  }

  function filterTable() {
    const idValue = filterId.value.toLowerCase();
    const codigoValue = filterCodigo.value.toLowerCase();
    const placaValue = filterPlaca.value.toLowerCase();
    const nomeValue = filterNome.value.toLowerCase();
    const rows = vehicleTableBody.getElementsByTagName("tr");
    for (const row of rows) {
      if (row.cells.length > 1) {
        const idCell = row.cells[0].textContent.toLowerCase();
        const codigoCell = row.cells[1].textContent.toLowerCase();
        const placaCell = row.cells[2].textContent.toLowerCase();
        const nomeCell = row.cells[3].textContent.toLowerCase();
        const showRow =
          idCell.includes(idValue) &&
          codigoCell.includes(codigoValue) &&
          placaCell.includes(placaValue) &&
          nomeCell.includes(nomeValue);
        row.style.display = showRow ? "" : "none";
      }
    }
  }

  if (filterId) filterId.addEventListener("keyup", filterTable);
  if (filterCodigo) filterCodigo.addEventListener("keyup", filterTable);
  if (filterPlaca) filterPlaca.addEventListener("keyup", filterTable);
  if (filterNome) filterNome.addEventListener("keyup", filterTable);

  if (vehicleForm) {
    vehicleForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const vehicleData = {
        placa: document.getElementById("placa").value,
        nome: document.getElementById("nome").value,
        codigo: document.getElementById("codigo").value,
        tipo_veiculo: document.getElementById("tipo_veiculo").value,
        situacao: document.getElementById("situacao").value,
        ano_fabricacao: document.getElementById("ano_fabricacao").value,
        cor: document.getElementById("cor").value,
        descricao: document.getElementById("descricao").value,
      };

      try {
        const response = await fetch("/api/frota_inventario", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(vehicleData),
        });
        const result = await response.json();
        if (response.ok) {
          showToast("Sucesso", result.message || "Veículo salvo com sucesso!");
          vehicleForm.reset();
          formContainer.classList.add("hidden");
          loadVehicles();
        } else {
          throw new Error(result.message || "Erro desconhecido ao salvar.");
        }
      } catch (error) {
        console.error("Erro ao salvar veículo:", error);
        showToast("Erro ao Salvar", error.message, true);
      }
    });
  }

  if (vehicleTableBody) {
    vehicleTableBody.addEventListener("click", async function (event) {
      const deleteButton = event.target.closest(".delete-btn");
      if (deleteButton) {
        const vehicleId = deleteButton.dataset.id;
        if (confirm("Tem certeza que deseja excluir este veículo?")) {
          try {
            const response = await fetch(`/api/frota_inventario/${vehicleId}`, {
              method: "DELETE",
            });
            const result = await response.json();
            if (response.ok) {
              showToast(
                "Sucesso",
                result.message || "Veículo excluído com sucesso!"
              );
              loadVehicles();
            } else {
              throw new Error(result.message);
            }
          } catch (error) {
            console.error("Erro ao excluir veículo:", error);
            showToast("Erro ao Excluir", error.message, true);
          }
        }
      }
    });
  }

  loadVehicles();
});
