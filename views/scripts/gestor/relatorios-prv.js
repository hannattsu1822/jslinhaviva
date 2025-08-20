document.addEventListener("DOMContentLoaded", () => {
  const veiculoSelect = document.getElementById("veiculoSelect");
  const dataInicioInput = document.getElementById("dataInicioInput");
  const dataFimInput = document.getElementById("dataFimInput");
  const gerarRelatorioBtn = document.getElementById("gerar-relatorio-btn");
  const exportExcelBtn = document.getElementById("export-excel-btn");

  const reportContainer = document.getElementById("report-container");
  const reportTitle = document.getElementById("report-title");
  const reportSubtitle = document.getElementById("report-subtitle");
  const reportTableBody = document.getElementById("report-table-body");

  const ocorrenciasContainer = document.getElementById("ocorrencias-container");
  const ocorrenciasText = document.getElementById("ocorrencias-text");

  const loadingMessage = document.getElementById("loading-message");

  let currentState = {
    veiculoId: null,
    dataInicio: null,
    dataFim: null,
  };

  const showLoading = (isLoading) => {
    loadingMessage.classList.toggle("hidden", !isLoading);
  };

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return "";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  };

  const renderReport = (data) => {
    const { veiculo, registros } = data;

    const dataInicioFmt = formatDateForDisplay(currentState.dataInicio);
    const dataFimFmt = formatDateForDisplay(currentState.dataFim);

    reportTitle.textContent = `Relatório de Viagem: ${veiculo.modelo || ""} - ${
      veiculo.placa || ""
    }`;
    reportSubtitle.textContent = `Período de Referência: ${dataInicioFmt} a ${dataFimFmt}`;
    reportTableBody.innerHTML = "";

    if (registros.length === 0) {
      reportTableBody.innerHTML = `<tr><td colspan="10" class="text-center">Nenhum registro encontrado para este período.</td></tr>`;
    } else {
      registros.forEach((r) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${r.dia ? formatDateForDisplay(r.dia.substring(0, 10)) : ""}</td>
          <td>${r.saida_horario ? r.saida_horario.substring(0, 5) : ""}</td>
          <td>${r.saida_local || ""}</td>
          <td>${r.saida_km || ""}</td>
          <td>${r.chegada_horario ? r.chegada_horario.substring(0, 5) : ""}</td>
          <td>${r.chegada_local || ""}</td>
          <td>${r.chegada_km || ""}</td>
          <td>${r.motorista_matricula || ""}</td>
          <td>${r.processo || ""}</td>
          <td>${r.tipo_servico || ""}</td>
        `;
        reportTableBody.appendChild(tr);
      });
    }

    const todasOcorrencias = registros
      .map((r) => r.ocorrencias)
      .filter((o) => o)
      .join("\n---\n");

    if (todasOcorrencias) {
      ocorrenciasText.textContent = todasOcorrencias;
      ocorrenciasContainer.classList.remove("hidden");
    } else {
      ocorrenciasContainer.classList.add("hidden");
    }

    reportContainer.classList.remove("hidden");
  };

  const loadInitialData = async () => {
    const hoje = new Date();
    const primeiroDiaDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    dataInicioInput.value = primeiroDiaDoMes.toISOString().slice(0, 10);
    dataFimInput.value = hoje.toISOString().slice(0, 10);

    try {
      const response = await fetch("/api/prv/veiculos");
      if (!response.ok)
        throw new Error("Não foi possível carregar a lista de veículos.");

      const veiculos = await response.json();
      veiculoSelect.innerHTML =
        '<option value="">Selecione um veículo...</option>';
      veiculos.forEach((v) => {
        veiculoSelect.innerHTML += `<option value="${v.id}">${v.modelo} - ${v.placa}</option>`;
      });
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  gerarRelatorioBtn.addEventListener("click", async () => {
    const veiculoId = veiculoSelect.value;
    const dataInicio = dataInicioInput.value;
    const dataFim = dataFimInput.value;

    if (!veiculoId || !dataInicio || !dataFim) {
      showToast(
        "Por favor, selecione um veículo e o período completo.",
        "error"
      );
      return;
    }

    currentState.veiculoId = veiculoId;
    currentState.dataInicio = dataInicio;
    currentState.dataFim = dataFim;

    showLoading(true);
    reportContainer.classList.add("hidden");

    try {
      const response = await fetch(
        `/api/relatorios/prv?veiculoId=${veiculoId}&dataInicio=${dataInicio}&dataFim=${dataFim}`
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      renderReport(result);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      showLoading(false);
    }
  });

  exportExcelBtn.addEventListener("click", () => {
    const { veiculoId, dataInicio, dataFim } = currentState;
    if (!veiculoId || !dataInicio || !dataFim) {
      showToast("Gere um relatório antes de exportar.", "error");
      return;
    }
    const url = `/api/relatorios/prv/export?veiculoId=${veiculoId}&dataInicio=${dataInicio}&dataFim=${dataFim}`;
    window.location.href = url;
  });

  loadInitialData();
});
