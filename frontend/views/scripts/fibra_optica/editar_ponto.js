document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-editar-ponto");
  if (!form) return;

  const submitButton = form.querySelector('button[type="submit"]');
  const pontoId = form.dataset.pontoId;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      event.stopPropagation();
      form.classList.add("was-validated");
      return;
    }

    const originalButtonHTML = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...`;

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await fetch(`/api/fibra/ponto-mapa/${pontoId}/editar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Ocorreu um erro desconhecido.");
      }

      if (typeof showToast === "function") {
        showToast(result.message, "success");
      } else {
        alert(result.message);
      }

      setTimeout(() => {
        window.location.href = "/gerenciar-pontos-fibra";
      }, 1500);
    } catch (error) {
      if (typeof showToast === "function") {
        showToast(error.message, "error");
      } else {
        alert(error.message);
      }
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonHTML;
    }
  });
});
