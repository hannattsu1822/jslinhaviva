document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("formGerarBasTxt");
  if (!form) return;

  const messageArea = document.getElementById("messageArea");
  const submitButton = document.getElementById("submitButton");
  const buttonSpinner = submitButton.querySelector(".spinner-border");
  const buttonText = submitButton.querySelector(".button-text");
  const buttonIcon = submitButton.querySelector(".fa-download");

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    event.stopPropagation();

    const dataInicioInput = document.getElementById("dataInicio");
    const dataFimInput = document.getElementById("dataFim");

    messageArea.style.display = "none";
    messageArea.className = "alert mt-4";

    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      return;
    }

    if (new Date(dataFimInput.value) < new Date(dataInicioInput.value)) {
      messageArea.textContent =
        "A data final não pode ser anterior à data inicial!";
      messageArea.classList.add("alert-danger");
      messageArea.style.display = "block";
      return;
    }

    submitButton.disabled = true;
    buttonSpinner.style.display = "inline-block";
    buttonIcon.style.display = "none";
    buttonText.textContent = "Gerando...";

    const formData = {
      matricula: document.getElementById("matricula").value,
      razao: document.getElementById("razao").value,
      dataInicio: dataInicioInput.value,
      dataFim: dataFimInput.value,
    };

    try {
      const response = await fetch("/api/bas/gerar-relatorio-processos-txt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const textContent = await response.text();
        if (textContent.trim() === "") {
          messageArea.textContent =
            "Nenhum processo encontrado para o período e critérios informados.";
          messageArea.classList.add("alert-info");
          form.reset();
          form.classList.remove("was-validated");
        } else {
          const disposition = response.headers.get("content-disposition");
          let filename = "relatorio_bas_construcao.txt";
          if (disposition) {
            const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch && filenameMatch[1]) {
              filename = filenameMatch[1];
            }
          }

          const blob = new Blob([textContent], {
            type: "text/plain; charset=utf-8",
          });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);

          messageArea.textContent = `Arquivo "${filename}" gerado e download iniciado com sucesso.`;
          messageArea.classList.add("alert-success");
          form.reset();
          form.classList.remove("was-validated");
        }
      } else {
        const errorData = await response.json();
        messageArea.textContent = `Erro: ${
          errorData.message || response.statusText
        }`;
        messageArea.classList.add("alert-danger");
      }
    } catch (error) {
      messageArea.textContent =
        "Erro de comunicação com o servidor. Verifique sua conexão e tente novamente.";
      messageArea.classList.add("alert-danger");
    } finally {
      messageArea.style.display = "block";
      submitButton.disabled = false;
      buttonSpinner.style.display = "none";
      buttonIcon.style.display = "inline-block";
      buttonText.textContent = "Gerar Arquivo TXT";
    }
  });
});
