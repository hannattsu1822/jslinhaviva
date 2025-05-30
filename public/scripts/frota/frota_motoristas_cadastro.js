document.addEventListener("DOMContentLoaded", function () {
  const driverForm = document.getElementById("driverForm");
  const driverTableBody = document.getElementById("driverTableBody");
  const toastEl = document.getElementById("liveToast");
  const bsToast = new bootstrap.Toast(toastEl);

  const filterId = document.getElementById("filterId");
  const filterMatricula = document.getElementById("filterMatricula");
  const filterNome = document.getElementById("filterNome");

  const formCollapseEl = document.getElementById("formCollapse");
  const formCollapse = formCollapseEl
    ? new bootstrap.Collapse(formCollapseEl, { toggle: false })
    : null;

  function showToast(title, message, isError = false) {
    const toastTitle = document.getElementById("toastTitle");
    const toastBody = document.getElementById("toastBody");

    toastTitle.textContent = title;
    toastBody.textContent = message;

    toastEl.classList.remove("bg-success", "bg-danger", "text-white");
    if (isError) {
      toastEl.classList.add("bg-danger", "text-white");
    } else {
      toastEl.classList.add("bg-success", "text-white");
    }
    bsToast.show();
  }

  async function loadDrivers() {
    try {
      const response = await fetch("/api/frota/motoristas_crud");
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Erro ao carregar motoristas." }));
        throw new Error(errorData.message);
      }

      const drivers = await response.json();
      driverTableBody.innerHTML = "";

      if (drivers.length === 0) {
        driverTableBody.innerHTML =
          '<tr><td colspan="4" class="text-center">Nenhum motorista cadastrado.</td></tr>';
        return;
      }

      drivers.forEach((driver) => {
        const row = document.createElement("tr");
        row.innerHTML = `
                <td>${driver.id}</td>
                <td>${driver.matricula || ""}</td>
                <td>${driver.nome || ""}</td>
                <td>
                  <button class="btn btn-sm btn-danger delete-btn" data-id="${
                    driver.id
                  }" title="Excluir">
                    <i class="material-icons">delete</i>
                  </button>
                </td>
              `;
        driverTableBody.appendChild(row);
      });
    } catch (error) {
      console.error("Erro ao carregar motoristas:", error);
      showToast(
        "Erro ao Carregar",
        error.message || "Não foi possível carregar a lista de motoristas.",
        true
      );
    }
  }

  function filterTable() {
    const idValue = filterId.value.toLowerCase();
    const matriculaValue = filterMatricula.value.toLowerCase();
    const nomeValue = filterNome.value.toLowerCase();

    const rows = driverTableBody.getElementsByTagName("tr");

    for (const row of rows) {
      if (row.cells.length < 3 || row.querySelector('td[colspan="4"]')) {
        if (rows.length === 1 && row.querySelector('td[colspan="4"]')) {
          row.style.display = "";
        }
        continue;
      }

      const idCell = row.cells[0].textContent.toLowerCase();
      const matriculaCell = row.cells[1].textContent.toLowerCase();
      const nomeCell = row.cells[2].textContent.toLowerCase();

      const showRow =
        idCell.includes(idValue) &&
        matriculaCell.includes(matriculaValue) &&
        nomeCell.includes(nomeValue);

      row.style.display = showRow ? "" : "none";
    }
  }

  if (filterId) filterId.addEventListener("keyup", filterTable);
  if (filterMatricula) filterMatricula.addEventListener("keyup", filterTable);
  if (filterNome) filterNome.addEventListener("keyup", filterTable);

  if (driverForm) {
    driverForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      const matriculaInput = document.getElementById("matricula");
      const nomeInput = document.getElementById("nome");

      const driverData = {
        matricula: matriculaInput.value.trim(),
        nome: nomeInput.value.trim(),
      };

      if (!driverData.matricula || !driverData.nome) {
        showToast(
          "Erro de Validação",
          "Matrícula e Nome são obrigatórios.",
          true
        );
        return;
      }

      try {
        const response = await fetch("/api/frota/motoristas_crud", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(driverData),
        });

        const result = await response.json();

        if (response.ok) {
          showToast(
            "Sucesso",
            result.message || "Motorista salvo com sucesso!"
          );
          driverForm.reset();
          if (formCollapse) {
            formCollapse.hide();
          }
          loadDrivers();
        } else {
          throw new Error(
            result.message || "Erro desconhecido ao salvar motorista."
          );
        }
      } catch (error) {
        console.error("Erro ao salvar motorista:", error);
        showToast("Erro ao Salvar", error.message, true);
      }
    });
  }

  if (driverTableBody) {
    driverTableBody.addEventListener("click", async function (event) {
      const deleteButton = event.target.closest(".delete-btn");
      if (deleteButton) {
        const driverId = deleteButton.dataset.id;

        if (confirm("Tem certeza que deseja excluir este motorista?")) {
          try {
            const response = await fetch(
              `/api/frota/motoristas_crud/${driverId}`,
              {
                method: "DELETE",
              }
            );
            const result = await response.json();
            if (response.ok) {
              showToast(
                "Sucesso",
                result.message || "Motorista excluído com sucesso!"
              );
              loadDrivers();
            } else {
              throw new Error(result.message || "Erro ao excluir motorista.");
            }
          } catch (error) {
            console.error("Erro ao excluir motorista:", error);
            showToast("Erro ao Excluir", error.message, true);
          }
        }
      }
    });
  }

  loadDrivers();
});
