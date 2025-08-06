document.addEventListener("DOMContentLoaded", () => {
  const btnAddDevice = document.getElementById("btn-add-device");
  const modal = document.getElementById("device-modal");
  const btnCancel = document.getElementById("btn-cancel");
  const deviceForm = document.getElementById("device-form");
  const modalTitle = document.getElementById("modal-title");
  const deviceIdField = document.getElementById("device-id");
  const devicesTableBody = document.querySelector("#devices-table tbody");

  const showModal = (title) => {
    modalTitle.textContent = title;
    modal.style.display = "flex";
    setTimeout(() => {
      modal.style.opacity = "1";
      modal.querySelector(".modal-content").style.transform = "translateY(0)";
    }, 10);
  };

  const hideModal = () => {
    modal.style.opacity = "0";
    modal.querySelector(".modal-content").style.transform = "translateY(-50px)";
    setTimeout(() => {
      modal.style.display = "none";
      deviceForm.reset();
      deviceIdField.value = "";
    }, 300);
  };

  btnAddDevice.addEventListener("click", () => {
    showModal("Adicionar Novo Dispositivo");
  });

  btnCancel.addEventListener("click", hideModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      hideModal();
    }
  });

  deviceForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(deviceForm);
    const data = Object.fromEntries(formData.entries());
    const deviceId = deviceIdField.value;

    const url = deviceId
      ? `/api/dispositivos/${deviceId}`
      : "/api/dispositivos";
    const method = deviceId ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Ocorreu um erro.");
      }

      alert(result.message);
      hideModal();
      location.reload();
    } catch (error) {
      alert(`Erro: ${error.message}`);
    }
  });

  devicesTableBody.addEventListener("click", async (e) => {
    const target = e.target.closest("button");
    if (!target) return;

    const row = target.closest("tr");
    const deviceId = row.dataset.deviceId;

    if (target.classList.contains("btn-edit")) {
      try {
        const response = await fetch(`/api/dispositivos/${deviceId}`);
        if (!response.ok) throw new Error("Não foi possível buscar os dados.");

        const device = await response.json();
        deviceIdField.value = device.id;
        document.getElementById("local_tag").value = device.local_tag;
        document.getElementById("serial_number").value = device.serial_number;
        document.getElementById("descricao").value = device.descricao || "";
        showModal("Editar Dispositivo");
      } catch (error) {
        alert(`Erro: ${error.message}`);
      }
    }

    if (target.classList.contains("btn-delete")) {
      const localTag = row.querySelector(
        "td[data-label='Local / Tag']"
      ).textContent;
      if (
        confirm(`Tem certeza que deseja excluir o dispositivo "${localTag}"?`)
      ) {
        try {
          const response = await fetch(`/api/dispositivos/${deviceId}`, {
            method: "DELETE",
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message);

          alert(result.message);
          location.reload();
        } catch (error) {
          alert(`Erro: ${error.message}`);
        }
      }
    }
  });
});
