document.addEventListener("DOMContentLoaded", () => {
  const confirmationModalEl = document.getElementById("confirmation-modal");
  const confirmationModal = confirmationModalEl
    ? new bootstrap.Modal(confirmationModalEl)
    : null;
  const confirmationTitle = document.getElementById("confirmation-title");
  const confirmationMessage = document.getElementById("confirmation-message");
  const confirmActionButton = document.getElementById("btn-confirm-action");

  const table = $("#pontos-table").DataTable({
    language: {
      url: "//cdn.datatables.net/plug-ins/1.13.6/i18n/pt-BR.json",
    },
    pageLength: 25,
    responsive: true,
  });

  let pontoIdParaExcluir = null;
  let linhaParaExcluir = null;

  document.body.addEventListener("click", (event) => {
    const target = event.target.closest(".btn-excluir-ponto");
    if (target) {
      pontoIdParaExcluir = target.dataset.id;
      linhaParaExcluir = target.closest("tr");

      if (confirmationModal) {
        confirmationTitle.textContent = "Excluir Ponto";
        confirmationMessage.textContent = `Tem certeza que deseja excluir o ponto de ID #${pontoIdParaExcluir}? Esta ação não pode ser desfeita.`;
        confirmActionButton.className = "btn btn-danger";
        confirmationModal.show();
      }
    }
  });

  confirmActionButton.addEventListener("click", async () => {
    if (!pontoIdParaExcluir) return;

    try {
      const response = await fetch(
        `/api/fibra/ponto-mapa/${pontoIdParaExcluir}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Erro ao excluir o ponto.");
      }

      if (typeof showToast === "function") {
        showToast(result.message, "success");
      } else {
        alert(result.message);
      }

      if (linhaParaExcluir) {
        table.row(linhaParaExcluir).remove().draw();
      }
    } catch (error) {
      if (typeof showToast === "function") {
        showToast(error.message, "error");
      } else {
        alert(error.message);
      }
    } finally {
      if (confirmationModal) {
        confirmationModal.hide();
      }
      pontoIdParaExcluir = null;
      linhaParaExcluir = null;
    }
  });
});
