document.addEventListener("DOMContentLoaded", function () {
  const importForm = document.getElementById("importForm");
  if (!importForm) return;

  const csvFileInput = document.getElementById("csvFile");
  const fileNameDisplay = document.getElementById("fileNameDisplay");
  const messageArea = document.getElementById("messageArea");
  const submitButton = document.getElementById("submitButton");
  const buttonSpinner = submitButton.querySelector(".spinner-border");
  const buttonText = submitButton.querySelector(".button-text");
  const buttonIcon = submitButton.querySelector(".fa-upload");

  csvFileInput.addEventListener("change", function () {
    if (this.files && this.files.length > 0) {
      fileNameDisplay.textContent = "Arquivo: " + this.files[0].name;
    } else {
      fileNameDisplay.textContent = "Nenhum arquivo selecionado";
    }
  });

  importForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    event.stopPropagation();

    if (!importForm.checkValidity()) {
      importForm.classList.add("was-validated");
      return;
    }

    messageArea.style.display = "none";
    messageArea.className = "alert mt-4";

    const formData = new FormData();
    formData.append(
      "planilhaTipo",
      document.getElementById("planilhaTipo").value
    );
    formData.append("csvFile", csvFileInput.files[0]);

    submitButton.disabled = true;
    buttonSpinner.style.display = "inline-block";
    buttonIcon.style.display = "none";
    buttonText.textContent = "Processando...";

    let response;
    try {
      response = await fetch("/api/bas/importar-dados-processos", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        messageArea.textContent =
          result.message || "Dados importados com sucesso!";
        messageArea.classList.add("alert-success");
        importForm.reset();
        fileNameDisplay.textContent = "Nenhum arquivo selecionado";
        importForm.classList.remove("was-validated");
        setTimeout(() => {
          window.location.reload();
        }, 2500);
      } else {
        messageArea.textContent =
          result.message ||
          `Erro ${response.status}: Ocorreu um problema ao importar os dados.`;
        messageArea.classList.add("alert-danger");
      }
    } catch (error) {
      messageArea.textContent =
        "Erro de comunicação com o servidor. Verifique sua conexão e tente novamente.";
      messageArea.classList.add("alert-danger");
    } finally {
      messageArea.style.display = "block";
      if (!response || !response.ok) {
        submitButton.disabled = false;
        buttonSpinner.style.display = "none";
        buttonIcon.style.display = "inline-block";
        buttonText.textContent = "Importar Dados";
      }
    }
  });
});
