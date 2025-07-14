// public/scripts/frota/agendar_checklist.js

document.addEventListener("DOMContentLoaded", async () => {
  // Elementos do Modal de Agendamento
  const agendamentoModal = document.getElementById("agendamentoModal");
  const openAgendamentoModalBtn = document.getElementById(
    "openAgendamentoModalBtn"
  );
  const closeButtons = document.querySelectorAll(".close-button"); // Botões de fechar do modal de agendamento
  const agendamentoFormModal = document.getElementById("agendamentoFormModal");
  const veiculoSelectModal = document.getElementById("veiculoIdModal");
  const encarregadoSelectModal = document.getElementById(
    "encarregadoMatriculaModal"
  );
  const mensagemModalDiv = document.getElementById("mensagemModal");

  // Elementos do Modal de Detalhes
  const detalhesAgendamentoModal = document.getElementById(
    "detalhesAgendamentoModal"
  );
  const closeDetailsModalBtn = document.querySelector(
    ".close-details-modal-btn"
  );
  const detailId = document.getElementById("detailId");
  const detailPlaca = document.getElementById("detailPlaca");
  const detailDataAgendamento = document.getElementById(
    "detailDataAgendamento"
  );
  const detailEncarregado = document.getElementById("detailEncarregado");
  const detailStatus = document.getElementById("detailStatus");
  const detailDataConclusao = document.getElementById("detailDataConclusao");
  const detailInspecaoId = document.getElementById("detailInspecaoId");
  const detailAgendadoPor = document.getElementById("detailAgendadoPor");
  const detailObservacoes = document.getElementById("detailObservacoes");

  // Elementos da Tabela de Agendamentos
  const filterForm = document.getElementById("filterForm");
  const clearFiltersBtn = document.getElementById("clearFiltersBtn");
  const filterStatus = document.getElementById("filterStatus");
  const filterDataInicial = document.getElementById("filterDataInicial");
  const filterDataFinal = document.getElementById("filterDataFinal");
  const agendamentosTableBody = document.getElementById(
    "agendamentosTableBody"
  );
  const noRecordsMessage = document.getElementById("noRecordsMessage");
  const mensagemPrincipalDiv = document.getElementById("mensagem"); // Mensagem na página principal

  let loadedAgendamentos = []; // Armazena todos os agendamentos carregados para fácil acesso

  // --- Funções de Utilidade ---

  function exibirMensagemPrincipal(texto, tipo = "success") {
    mensagemPrincipalDiv.textContent = texto;
    mensagemPrincipalDiv.className = `mensagem ${tipo} show`;
    setTimeout(() => {
      mensagemPrincipalDiv.className = "mensagem";
      mensagemPrincipalDiv.textContent = "";
    }, 5000);
  }

  function exibirMensagemModal(texto, tipo = "success") {
    mensagemModalDiv.textContent = texto;
    mensagemModalDiv.className = `mensagem ${tipo} show`;
    setTimeout(() => {
      mensagemModalDiv.className = "mensagem";
      mensagemModalDiv.textContent = "";
    }, 5000);
  }

  // --- Funções de Carregamento de Dados para Dropdowns ---

  async function carregarVeiculos(selectElement) {
    try {
      const response = await fetch("/api/veiculos_oleo", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok) throw new Error("Erro ao carregar veículos.");
      const data = await response.json();

      selectElement.innerHTML =
        '<option value="">Selecione um veículo</option>';
      data.forEach((veiculo) => {
        const option = document.createElement("option");
        option.value = veiculo.id;
        option.textContent = `${veiculo.placa} - ${veiculo.modelo || "N/A"}`;
        selectElement.appendChild(option);
      });
    } catch (error) {
      console.error("Erro ao carregar veículos:", error);
      exibirMensagemPrincipal(
        "Erro ao carregar veículos: " + error.message,
        "error"
      );
    }
  }

  async function carregarEncarregados(selectElement) {
    try {
      const response = await fetch("/api/encarregados", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok) throw new Error("Erro ao carregar encarregados.");
      const data = await response.json();

      selectElement.innerHTML =
        '<option value="">Selecione o encarregado</option>';
      data.forEach((encarregado) => {
        const option = document.createElement("option");
        option.value = encarregado.matricula;
        option.textContent = `${encarregado.matricula} - ${encarregado.nome}`;
        selectElement.appendChild(option);
      });
    } catch (error) {
      console.error("Erro ao carregar encarregados:", error);
      exibirMensagemPrincipal(
        "Erro ao carregar encarregados: " + error.message,
        "error"
      );
    }
  }

  // --- Funções do Modal de Agendamento ---

  function openModal() {
    agendamentoModal.classList.add("show");
    agendamentoFormModal.reset();
    mensagemModalDiv.className = "mensagem";
    mensagemModalDiv.textContent = "";
    carregarVeiculos(veiculoSelectModal);
    carregarEncarregados(encarregadoSelectModal);
  }

  function closeModal() {
    agendamentoModal.classList.remove("show");
  }

  // Event Listeners para o Modal de Agendamento
  openAgendamentoModalBtn.addEventListener("click", openModal);
  closeButtons.forEach((button) => {
    button.addEventListener("click", closeModal);
  });
  window.addEventListener("click", (event) => {
    if (event.target === agendamentoModal) {
      closeModal();
    }
  });

  // Lógica de submissão do formulário do Modal de Agendamento
  if (agendamentoFormModal) {
    agendamentoFormModal.addEventListener("submit", async (event) => {
      event.preventDefault();

      const submitBtn = agendamentoFormModal.querySelector(
        'button[type="submit"]'
      );
      const originalBtnText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<i class="material-icons spin">sync</i> Agendando...';

      const formData = {
        veiculo_id: veiculoSelectModal.value,
        data_agendamento: document.getElementById("dataAgendamentoModal").value,
        encarregado_matricula: encarregadoSelectModal.value,
        observacoes:
          document.getElementById("observacoesModal").value.trim() || null,
      };

      if (
        !formData.veiculo_id ||
        !formData.data_agendamento ||
        !formData.encarregado_matricula
      ) {
        exibirMensagemModal(
          "Por favor, preencha todos os campos obrigatórios.",
          "error"
        );
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        return;
      }

      try {
        const response = await fetch("/api/agendar_checklist", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify(formData),
        });

        const result = await response.json();

        if (response.ok) {
          exibirMensagemModal(
            result.message || "Agendamento criado com sucesso!",
            "success"
          );
          agendamentoFormModal.reset();
          carregarAgendamentos(); // Recarrega a tabela principal
          setTimeout(closeModal, 1500);
        } else {
          throw new Error(result.message || "Erro ao criar agendamento.");
        }
      } catch (error) {
        console.error("Erro ao agendar checklist:", error);
        exibirMensagemModal(
          "Falha ao agendar checklist: " + error.message,
          "error"
        );
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    });
  }

  // --- Funções da Tabela de Agendamentos (Carregar, Excluir, Detalhes) ---

  async function carregarAgendamentos(filters = {}, limit = 10) {
    agendamentosTableBody.innerHTML =
      '<tr><td colspan="9" class="text-center">Carregando agendamentos...</td></tr>';
    noRecordsMessage.style.display = "none";

    const queryParams = new URLSearchParams();
    if (filters.status) queryParams.append("status", filters.status);
    if (filters.dataInicial)
      queryParams.append("dataInicial", filters.dataInicial);
    if (filters.dataFinal) queryParams.append("dataFinal", filters.dataFinal);
    if (limit) queryParams.append("limit", limit);

    try {
      const response = await fetch(
        `/api/agendamentos_checklist?${queryParams.toString()}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );
      if (!response.ok) throw new Error("Erro ao carregar agendamentos.");
      loadedAgendamentos = await response.json(); // Armazena os agendamentos carregados

      agendamentosTableBody.innerHTML = "";

      if (loadedAgendamentos.length === 0) {
        noRecordsMessage.style.display = "block";
        return;
      }

      loadedAgendamentos.forEach((agendamento) => {
        const row = document.createElement("tr");
        let statusClass = "";
        if (agendamento.status_display === "Atrasado") {
          statusClass = "status-atrasado";
        } else if (agendamento.status_display === "Agendado") {
          statusClass = "status-agendado";
        } else if (agendamento.status_display === "Concluído") {
          statusClass = "status-concluido";
        }

        row.innerHTML = `
          <td>${agendamento.id}</td>
          <td>${agendamento.placa || "N/A"}</td>
          <td>${new Date(agendamento.data_agendamento).toLocaleDateString(
            "pt-BR",
            { timeZone: "UTC" }
          )}</td>
          <td>${agendamento.encarregado_nome || "N/A"}</td>
          <td class="${statusClass}">${agendamento.status_display}</td>
          <td>${
            agendamento.data_conclusao
              ? new Date(agendamento.data_conclusao).toLocaleDateString(
                  "pt-BR",
                  { timeZone: "UTC" }
                )
              : "N/A"
          }</td>
          <td>${agendamento.agendado_por_nome || "N/A"}</td>
          <td>${agendamento.observacoes || "-"}</td>
          <td class="actions">
            <button class="btn small-btn view-details-btn" data-id="${
              agendamento.id
            }" title="Ver Detalhes">
              <i class="material-icons">visibility</i>
            </button>
            <button class="btn small-btn delete-btn" data-id="${
              agendamento.id
            }" title="Excluir Agendamento">
              <i class="material-icons">delete</i>
            </button>
          </td>
        `;
        agendamentosTableBody.appendChild(row);
      });

      // Adiciona event listeners para os novos botões após a tabela ser populada
      agendamentosTableBody
        .querySelectorAll(".delete-btn")
        .forEach((button) => {
          button.addEventListener("click", (e) =>
            excluirAgendamento(e.currentTarget.dataset.id)
          );
        });
      agendamentosTableBody
        .querySelectorAll(".view-details-btn")
        .forEach((button) => {
          button.addEventListener("click", (e) =>
            openDetailsModal(e.currentTarget.dataset.id)
          );
        });
    } catch (error) {
      console.error("Erro ao carregar agendamentos:", error);
      agendamentosTableBody.innerHTML = `<tr><td colspan="9" class="text-center error-message">Erro ao carregar agendamentos: ${error.message}</td></tr>`;
      noRecordsMessage.style.display = "none";
    }
  }

  // Função para excluir agendamento
  async function excluirAgendamento(id) {
    if (
      !confirm(
        `Tem certeza que deseja excluir o agendamento ID ${id}? Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/agendamentos_checklist/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      const result = await response.json();

      if (response.ok) {
        exibirMensagemPrincipal(
          result.message || "Agendamento excluído com sucesso!",
          "success"
        );
        carregarAgendamentos(); // Recarrega a tabela
      } else {
        throw new Error(result.message || "Erro ao excluir agendamento.");
      }
    } catch (error) {
      console.error("Erro ao excluir agendamento:", error);
      exibirMensagemPrincipal(
        "Falha ao excluir agendamento: " + error.message,
        "error"
      );
    }
  }

  // --- Funções do Modal de Detalhes ---

  function openDetailsModal(id) {
    const agendamento = loadedAgendamentos.find(
      (ag) => String(ag.id) === String(id)
    );

    if (agendamento) {
      detailId.textContent = agendamento.id;
      detailPlaca.textContent = agendamento.placa || "N/A";
      detailDataAgendamento.textContent = new Date(
        agendamento.data_agendamento
      ).toLocaleDateString("pt-BR", { timeZone: "UTC" });
      detailEncarregado.textContent = agendamento.encarregado_nome || "N/A";
      detailStatus.textContent = agendamento.status_display;
      detailStatus.className = `status-${agendamento.status_display
        .toLowerCase()
        .replace(" ", "-")}`; // Aplica classe para cor
      detailDataConclusao.textContent = agendamento.data_conclusao
        ? new Date(agendamento.data_conclusao).toLocaleString("pt-BR", {
            timeZone: "UTC",
          })
        : "Não Concluído";
      detailInspecaoId.textContent = agendamento.inspecao_id || "N/A";
      detailAgendadoPor.textContent = agendamento.agendado_por_nome || "N/A";
      detailObservacoes.textContent =
        agendamento.observacoes || "Nenhuma observação.";

      detalhesAgendamentoModal.classList.add("show");
    } else {
      exibirMensagemPrincipal(
        "Detalhes do agendamento não encontrados.",
        "error"
      );
    }
  }

  function closeDetailsModal() {
    detalhesAgendamentoModal.classList.remove("show");
  }

  // Event Listeners para o Modal de Detalhes
  closeDetailsModalBtn.addEventListener("click", closeDetailsModal);
  window.addEventListener("click", (event) => {
    if (event.target === detalhesAgendamentoModal) {
      closeDetailsModal();
    }
  });

  // --- Inicialização ---
  carregarAgendamentos({}, 10); // Carrega os 10 últimos agendamentos ao carregar a página
});
