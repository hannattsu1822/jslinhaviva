document.addEventListener("DOMContentLoaded", () => {
  const btnAddDevice = document.getElementById("btn-add-device");
  const modal = document.getElementById("device-modal");
  const btnCancel = document.getElementById("btn-cancel");
  const deviceForm = document.getElementById("device-form");
  const modalTitle = document.getElementById("modal-title");
  const deviceIdField = document.getElementById("device-id");
  const devicesTableBody = document.querySelector("#devices-table tbody");

  const showNotification = (message, type = "info") => {
    const notificationContainer = document.getElementById("notification-container") || createNotificationContainer();
    
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <span>${message}</span>
      <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    notificationContainer.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = "slideOut 0.3s ease-out forwards";
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  };

  const createNotificationContainer = () => {
    const container = document.createElement("div");
    container.id = "notification-container";
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(container);
    
    if (!document.getElementById("notification-styles")) {
      const style = document.createElement("style");
      style.id = "notification-styles";
      style.textContent = `
        .notification {
          min-width: 300px;
          padding: 15px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          display: flex;
          justify-content: space-between;
          align-items: center;
          animation: slideIn 0.3s ease-out;
          font-size: 14px;
          color: #fff;
        }
        .notification-success { background-color: #28a745; }
        .notification-error { background-color: #dc3545; }
        .notification-info { background-color: #17a2b8; }
        .notification-warning { background-color: #ffc107; color: #000; }
        .notification-close {
          background: none;
          border: none;
          color: inherit;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          margin-left: 15px;
          line-height: 1;
        }
        @keyframes slideIn {
          from { transform: translateX(400px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(400px); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
    
    return container;
  };

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

    const url = deviceId ? `/api/dispositivos/${deviceId}` : "/api/dispositivos";
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

      showNotification(result.message, "success");
      hideModal();
      
      setTimeout(() => {
        location.reload();
      }, 1000);
    } catch (error) {
      showNotification(error.message, "error");
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
        showNotification(error.message, "error");
      }
    }

    if (target.classList.contains("btn-delete")) {
      const localTag = row.querySelector("td[data-label='Local / Tag']").textContent;

      const confirmDelete = confirm(`Tem certeza que deseja excluir o dispositivo "${localTag}"?`);
      
      if (confirmDelete) {
        try {
          const response = await fetch(`/api/dispositivos/${deviceId}`, {
            method: "DELETE",
          });

          const result = await response.json();
          if (!response.ok) throw new Error(result.message);

          showNotification(result.message, "success");
          
          setTimeout(() => {
            location.reload();
          }, 1000);
        } catch (error) {
          showNotification(error.message, "error");
        }
      }
    }
  });
});
