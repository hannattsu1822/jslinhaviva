document.addEventListener("DOMContentLoaded", function () {
  const vehicleForm = document.getElementById("vehicleForm");
  const vehicleTableBody = document.getElementById("vehicleTableBody");
  const toastEl = document.getElementById("liveToast");
  const toast = new bootstrap.Toast(toastEl);

  // Campos de filtro
  const filterId = document.getElementById("filterId");
  const filterCodigo = document.getElementById("filterCodigo");
  const filterPlaca = document.getElementById("filterPlaca");
  const filterNome = document.getElementById("filterNome");

  function showToast(title, message, isError = false) {
    const toastTitle = document.getElementById("toastTitle");
    const toastBody = document.getElementById("toastBody");
    toastTitle.textContent = title;
    toastBody.textContent = message;

    toastEl.classList.remove("bg-success", "bg-danger");
    toastEl.classList.add(isError ? "bg-danger" : "bg-success", "text-white");
    toast.show();
  }

  // Função para carregar e exibir os veículos na tabela
  async function loadVehicles() {
    try {
      const response = await fetch("/api/frota_inventario");
      if (!response.ok) throw new Error("Falha ao carregar os veículos.");

      const vehicles = await response.json();
      vehicleTableBody.innerHTML = "";

      if (vehicles.length === 0) {
        vehicleTableBody.innerHTML =
          '<tr><td colspan="6" class="text-center">Nenhum veículo cadastrado.</td></tr>';
        return;
      }

      vehicles.forEach((vehicle) => {
        const row = document.createElement("tr");
        row.innerHTML = `
              <td>${vehicle.id}</td>
              <td>${vehicle.codigo || ""}</td>
              <td>${vehicle.placa}</td>
              <td>${vehicle.nome}</td>
              <td>${vehicle.data_aquisicao}</td>
              <td>
                <button class="btn btn-sm btn-danger delete-btn" data-id="${
                  vehicle.id
                }" title="Excluir">
                  <i class="fas fa-trash-alt"></i>
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

  // Função para filtrar a tabela
  function filterTable() {
    const idValue = filterId.value.toLowerCase();
    const codigoValue = filterCodigo.value.toLowerCase();
    const placaValue = filterPlaca.value.toLowerCase();
    const nomeValue = filterNome.value.toLowerCase();

    const rows = vehicleTableBody.getElementsByTagName("tr");

    for (const row of rows) {
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

  // Adiciona event listeners aos campos de filtro
  filterId.addEventListener("keyup", filterTable);
  filterCodigo.addEventListener("keyup", filterTable);
  filterPlaca.addEventListener("keyup", filterTable);
  filterNome.addEventListener("keyup", filterTable);

  // Event listener para o envio do formulário
  vehicleForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const vehicleData = {
      placa: document.getElementById("placa").value,
      nome: document.getElementById("nome").value,
      codigo: document.getElementById("codigo").value,
      tipo_veiculo: document.getElementById("tipo_veiculo").value,
      situacao: document.getElementById("situacao").value,
      data_aquisicao: document.getElementById("data_aquisicao").value,
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
        showToast("Sucesso", result.message);
        vehicleForm.reset();
        const formCollapse = bootstrap.Collapse.getInstance(
          document.getElementById("formCollapse")
        );
        if (formCollapse) formCollapse.hide();
        loadVehicles();
      } else {
        throw new Error(result.message || "Erro desconhecido.");
      }
    } catch (error) {
      console.error("Erro ao salvar veículo:", error);
      showToast("Erro ao Salvar", error.message, true);
    }
  });

  // Event listener para os botões de exclusão
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
            showToast("Sucesso", result.message);
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

  loadVehicles();
});
