/**
 * Exibe uma notificação toast na tela.
 * @param {string} message A mensagem a ser exibida.
 * @param {string} [type='success'] O tipo de toast ('success' ou 'error').
 * @param {number} [duration=4000] A duração em milissegundos.
 */
function showToast(message, type = "success", duration = 4000) {
  const container = document.getElementById("toast-container");
  if (!container) {
    console.error("Elemento #toast-container não encontrado no DOM.");
    alert(`${type.toUpperCase()}: ${message}`);
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const iconName = type === "success" ? "check_circle" : "error";
  const icon = `<span class="material-symbols-outlined toast-icon">${iconName}</span>`;

  toast.innerHTML = `${icon} <p>${message}</p>`;

  container.appendChild(toast);

  // Força o navegador a aplicar a transição
  setTimeout(() => {
    toast.classList.add("show");
  }, 10);

  // Remove o toast após a duração
  setTimeout(() => {
    toast.classList.remove("show");
    // Espera a transição de saída terminar para remover o elemento do DOM
    toast.addEventListener("transitionend", () => {
      toast.remove();
    });
  }, duration);
}

// Adiciona o CSS necessário para os toasts, caso não exista um arquivo CSS global para isso.
const toastStyle = document.createElement("style");
toastStyle.innerHTML = `
    #toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .toast {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 18px;
        border-radius: 6px;
        color: #fff;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transform: translateX(120%);
        opacity: 0;
        transition: transform 0.4s ease, opacity 0.4s ease;
        min-width: 250px;
        max-width: 350px;
    }
    .toast.show {
        transform: translateX(0);
        opacity: 1;
    }
    .toast.success {
        background-color: #28a745;
    }
    .toast.error {
        background-color: #dc3545;
    }
    .toast .toast-icon {
        font-size: 1.5rem;
    }
    .toast p {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 500;
    }
`;
document.head.appendChild(toastStyle);
