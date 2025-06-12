// public/scripts/trafos/formulario_transformadores.js

document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const numeroSerieFromURL = urlParams.get("numero_serie");
  const numeroSerieInput = document.getElementById("numero_serie");

  if (numeroSerieFromURL && numeroSerieInput) {
    numeroSerieInput.value = numeroSerieFromURL;
  } else {
    if (!numeroSerieFromURL) {
      alert(
        "Número de série não encontrado na URL! Retornando para a página de transformadores."
      );
      window.location.href = "/transformadores";
    } else if (!numeroSerieInput && numeroSerieFromURL) {
      alert("Campo 'Número de Série' não encontrado no formulário.");
    }
  }

  const anoReformadoGroup = document.getElementById("anoReformadoGroup");
  document.querySelectorAll('input[name="reformado"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      if (anoReformadoGroup) {
        anoReformadoGroup.style.display =
          e.target.value === "true" ? "block" : "none";
      }
    });
  });

  document.querySelectorAll(".button-group").forEach((buttonGroup) => {
    const hiddenInput = buttonGroup.nextElementSibling;
    if (
      hiddenInput &&
      (hiddenInput.tagName === "INPUT" || hiddenInput.tagName === "SELECT")
    ) {
      const isSingleSelect = buttonGroup.classList.contains("single-select");
      setupButtonGroup(buttonGroup, hiddenInput, isSingleSelect);
    }
  });

  carregarResponsaveis();
  carregarSupervisores();

  const checklistForm = document.getElementById("checklistForm");
  if (checklistForm) {
    checklistForm.addEventListener("submit", handleSubmitChecklistForm);
  }
});

function setupButtonGroup(buttonGroup, hiddenInput, isSingleSelect = false) {
  const selectedOptions = new Set(
    hiddenInput.value ? hiddenInput.value.split(",") : []
  );

  buttonGroup.querySelectorAll("button").forEach((button) => {
    if (selectedOptions.has(button.getAttribute("data-value"))) {
      button.classList.add("selected");
    }
  });

  buttonGroup.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") {
      e.preventDefault(); // Prevenir comportamento padrão se o botão estiver em um form
      const value = e.target.getAttribute("data-value");

      if (isSingleSelect) {
        buttonGroup.querySelectorAll("button").forEach((btn) => {
          btn.classList.remove("selected");
        });
        selectedOptions.clear();
        selectedOptions.add(value);
        e.target.classList.add("selected");
      } else {
        if (selectedOptions.has(value)) {
          selectedOptions.delete(value);
          e.target.classList.remove("selected");
        } else {
          selectedOptions.add(value);
          e.target.classList.add("selected");
        }
      }
      hiddenInput.value = Array.from(selectedOptions).join(",");

      if (hiddenInput.id === "detalhes_tanque") {
        const tipoCorrosaoGroup = document.getElementById("tipoCorrosaoGroup");
        if (tipoCorrosaoGroup) {
          tipoCorrosaoGroup.style.display = selectedOptions.has("CORROSAO")
            ? "block"
            : "none";
        }
      }
    }
  });
}

async function carregarResponsaveis() {
  try {
    const response = await fetch("/api/responsaveis");
    if (!response.ok) throw new Error("Falha ao carregar responsáveis");
    const responsaveis = await response.json();
    const select = document.getElementById("matricula_responsavel");
    if (!select) return;

    select.innerHTML = '<option value="">Selecione um responsável...</option>';
    responsaveis.forEach((responsavel) => {
      const option = document.createElement("option");
      option.value = responsavel.matricula;
      option.textContent = `${responsavel.nome} (${responsavel.matricula})`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar responsáveis:", error);
  }
}

async function carregarSupervisores() {
  try {
    const response = await fetch("/api/supervisores");
    if (!response.ok) throw new Error("Falha ao carregar supervisores");
    const supervisores = await response.json();
    const select = document.getElementById("matricula_supervisor");
    if (!select) return;

    select.innerHTML = '<option value="">Selecione um supervisor...</option>';
    supervisores.forEach((supervisor) => {
      const option = document.createElement("option");
      option.value = supervisor.matricula;
      option.textContent = `${supervisor.nome} (${supervisor.matricula})`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar supervisores:", error);
  }
}

async function handleSubmitChecklistForm(event) {
  event.preventDefault();

  const formData = {
    numero_serie: document.getElementById("numero_serie").value,
    data_fabricacao: document.getElementById("ano_fabricacao").value
      ? `${document.getElementById("ano_fabricacao").value}-01-01`
      : null,
    reformado: document.querySelector('input[name="reformado"]:checked').value,
    data_reformado: document.getElementById("ano_reformado").value
      ? `${document.getElementById("ano_reformado").value}-01-01`
      : null,
    detalhes_tanque: document.getElementById("detalhes_tanque").value,
    corrosao_tanque:
      document.getElementById("tipo_corrosao").value || "NENHUMA",
    buchas_primarias: document.getElementById("buchas_primarias").value,
    buchas_secundarias: document.getElementById("buchas_secundarias").value,
    conectores: document.getElementById("conectores").value,
    avaliacao_bobina_i: document.getElementById("avaliacao_bobina_i").value,
    avaliacao_bobina_ii: document.getElementById("avaliacao_bobina_ii").value,
    avaliacao_bobina_iii: document.getElementById("avaliacao_bobina_iii").value,
    conclusao: document.getElementById("conclusao").value,
    transformador_destinado: document.getElementById("transformador_destinado")
      .value,
    matricula_responsavel: document.getElementById("matricula_responsavel")
      .value,
    matricula_supervisor: document.getElementById("matricula_supervisor").value,
    observacoes: document.getElementById("observacoes").value,
  };

  const submitButton = document.getElementById("submitButton");
  const originalButtonHTML = submitButton.innerHTML;
  submitButton.disabled = true;
  submitButton.innerHTML =
    '<i class="fas fa-spinner fa-spin icon"></i>Salvando...';
  const mensagemDiv = document.getElementById("mensagem");

  try {
    const response = await fetch("/api/salvar_checklist", {
      method: "POST",
      body: JSON.stringify(formData),
      headers: { "Content-Type": "application/json" },
    });

    const result = await response.json();

    if (response.ok) {
      mensagemDiv.textContent =
        result.message || "Checklist salvo com sucesso!";
      mensagemDiv.className = "sucesso";
      setTimeout(() => {
        window.location.href = "/transformadores";
      }, 1500);
    } else {
      mensagemDiv.textContent = result.message || "Erro ao salvar checklist!";
      mensagemDiv.className = "erro";
    }
  } catch (error) {
    console.error("Erro no submit do formulário:", error);
    mensagemDiv.textContent =
      "Erro ao conectar com o servidor para salvar o checklist!";
    mensagemDiv.className = "erro";
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = originalButtonHTML;
  }
}
