document.addEventListener("DOMContentLoaded", () => {
  const modalElement = document.getElementById("selecaoVeiculoModal");
  const modalInstance = new bootstrap.Modal(modalElement);
  const veiculoSelect = document.getElementById("veiculoSelect");
  const mesAnoInput = document.getElementById("mesAnoInput");
  const carregarPrvBtn = document.getElementById("carregar-prv-btn");

  const formContainer = document.getElementById("form-container");
  const tableContainer = document.getElementById("table-container");
  const infoPrvHeader = document.getElementById("info-prv-header");
  const infoVeiculoEl = document.getElementById("info-veiculo");
  const infoPeriodoEl = document.getElementById("info-periodo");

  const prvForm = document.getElementById("prv-form");
  const prvTableBody = document.getElementById("prv-table-body");
  const limparFormBtn = document.getElementById("limpar-form-btn");
  const salvarBtn = document.getElementById("salvar-btn");

  const tipoLancamentoSaida = document.getElementById("tipoLancamentoSaida");
  const tipoLancamentoChegada = document.getElementById(
    "tipoLancamentoChegada"
  );
  const saidaFields = document.getElementById("saida-fields");
  const chegadaFields = document.getElementById("chegada-fields");
  const infoViagemAbertaEl = document.getElementById("info-viagem-aberta");

  const hiddenRegistroIdInput = document.createElement("input");
  hiddenRegistroIdInput.type = "hidden";
  hiddenRegistroIdInput.id = "registro_id";
  prvForm.appendChild(hiddenRegistroIdInput);

  let currentState = {
    veiculoId: null,
    mesAno: null,
    veiculoTexto: "",
    registros: [],
    viagemAberta: null,
  };

  const limparFormulario = () => {
    prvForm.reset();
    hiddenRegistroIdInput.value = "";
    document.getElementById("data_viagem").value = new Date().toISOString().slice(0, 10);
  };

  const preencherDadosAtuaisSaida = () => {
    const agora = new Date();
    document.getElementById("data_viagem").value = agora.toISOString().slice(0, 10);
    document.getElementById("saida_horario").value = agora
      .toTimeString()
      .slice(0, 5);
    document.getElementById("saida_km").focus();
  };

  const preencherDadosAtuaisChegada = () => {
    const agora = new Date();
    document.getElementById("chegada_horario").value = agora
      .toTimeString()
      .slice(0, 5);
    document.getElementById("chegada_km").focus();
  };

  const toggleFormFields = (tipo) => {
    if (tipo === "saida") {
      saidaFields.style.display = "block";
      chegadaFields.style.display = "none";
      salvarBtn.textContent = "Salvar Saída";
    } else {
      saidaFields.style.display = "none";
      chegadaFields.style.display = "block";
      salvarBtn.textContent = "Salvar Chegada";
    }
  };

  const atualizarUiComEstado = () => {
    limparFormulario();
    if (currentState.viagemAberta) {
      tipoLancamentoSaida.disabled = true;
      tipoLancamentoChegada.disabled = false;
      tipoLancamentoChegada.checked = true;
      toggleFormFields("chegada");

      const saida = currentState.viagemAberta;
      infoViagemAbertaEl.innerHTML = `
        <strong>Viagem em andamento:</strong><br>
        Saindo de: <strong>${saida.saida_local}</strong><br>
        KM de Saída: <strong>${
          saida.saida_km
        }</strong> | Horário: <strong>${saida.saida_horario.substring(
        0,
        5
      )}</strong>
      `;
      preencherDadosAtuaisChegada();
    } else {
      tipoLancamentoSaida.disabled = false;
      tipoLancamentoChegada.disabled = true;
      tipoLancamentoSaida.checked = true;
      toggleFormFields("saida");
      preencherDadosAtuaisSaida();
    }
  };

  tipoLancamentoSaida.addEventListener("change", () =>
    toggleFormFields("saida")
  );
  tipoLancamentoChegada.addEventListener("change", () =>
    toggleFormFields("chegada")
  );

  const renderTable = () => {
    prvTableBody.innerHTML = "";
    if (currentState.registros.length === 0) {
      prvTableBody.innerHTML = `<tr><td colspan="7" class="text-center">Nenhum lançamento encontrado para este período.</td></tr>`;
      return;
    }
    currentState.registros.forEach((r) => {
      const kmPercorrido =
        r.chegada_km && r.saida_km ? r.chegada_km - r.saida_km : "N/A";
      const saidaInfo = `${r.saida_local || ""} <br><small class="text-muted">${
        r.saida_horario || ""
      } - ${r.saida_km || ""} KM</small>`;
      const chegadaInfo = `${
        r.chegada_local || ""
      } <br><small class="text-muted">${r.chegada_horario || ""} - ${
        r.chegada_km || ""
      } KM</small>`;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.dia}</td>
        <td>${saidaInfo}</td>
        <td>${chegadaInfo}</td>
        <td>${kmPercorrido}</td>
        <td>${r.motorista_matricula}</td>
        <td>${r.tipo_servico || ""}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary edit-btn" data-id="${
            r.id
          }" title="Editar" disabled>
            <span class="material-symbols-outlined">edit</span>
          </button>
          <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${
            r.id
          }" title="Excluir">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </td>
      `;
      prvTableBody.appendChild(tr);
    });
  };

  const carregarDadosPrv = async () => {
    const { veiculoId, mesAno } = currentState;
    try {
      const statusResponse = await fetch(
        `/api/prv/status?veiculoId=${veiculoId}`
      );
      if (!statusResponse.ok)
        throw new Error("Falha ao verificar status da viagem.");
      currentState.viagemAberta = await statusResponse.json();

      const registrosResponse = await fetch(
        `/api/prv/registros?veiculoId=${veiculoId}&mesAno=${mesAno}`
      );
      if (!registrosResponse.ok)
        throw new Error("Falha ao carregar registros.");
      currentState.registros = await registrosResponse.json();

      renderTable();
      atualizarUiComEstado();
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  const loadInitialData = async () => {
    mesAnoInput.value = new Date().toISOString().slice(0, 7);
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
    } finally {
      modalInstance.show();
    }
  };

  carregarPrvBtn.addEventListener("click", () => {
    const veiculoId = veiculoSelect.value;
    const mesAno = mesAnoInput.value;
    if (!veiculoId || !mesAno) {
      showToast("Por favor, selecione um veículo e um período.", "error");
      return;
    }
    currentState.veiculoId = veiculoId;
    currentState.mesAno = mesAno;
    currentState.veiculoTexto =
      veiculoSelect.options[veiculoSelect.selectedIndex].text;
    infoVeiculoEl.textContent = currentState.veiculoTexto;
    const [ano, mes] = mesAno.split("-");
    infoPeriodoEl.textContent = `Período de Referência: ${mes}/${ano}`;

    modalInstance.hide();
    infoPrvHeader.style.display = "block";
    formContainer.style.display = "block";
    tableContainer.style.display = "block";

    carregarDadosPrv();
  });

  prvForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const tipoLancamento = document.querySelector(
      'input[name="tipoLancamento"]:checked'
    ).value;
    let formData = {};
    let url = "/api/prv/registros";
    let method = "POST";

    if (tipoLancamento === "saida") {
      formData = {
        veiculo_id: currentState.veiculoId,
        data_viagem: document.getElementById("data_viagem").value,
        saida_horario: document.getElementById("saida_horario").value || null,
        saida_km: document.getElementById("saida_km").value || null,
        saida_local: document.getElementById("saida_local").value,
      };
    } else {
      formData = {
        chegada_horario:
          document.getElementById("chegada_horario").value || null,
        chegada_km: document.getElementById("chegada_km").value || null,
        chegada_local: document.getElementById("chegada_local").value,
        processo: document.getElementById("processo").value,
        tipo_servico: document.getElementById("tipo_servico").value,
        ocorrencias: document.getElementById("ocorrencias").value,
      };
      url = `/api/prv/registros/${currentState.viagemAberta.id}`;
      method = "PUT";
    }

    try {
      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      showToast(result.message, "success");

      carregarDadosPrv();
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  prvTableBody.addEventListener("click", async (e) => {
    const target = e.target.closest("button");
    if (!target) return;
    const registroId = target.dataset.id;

    if (target.classList.contains("edit-btn")) {
      showToast(
        "A funcionalidade de edição foi desativada temporariamente.",
        "info"
      );
    }

    if (target.classList.contains("delete-btn")) {
      if (
        confirm(
          "Tem certeza que deseja excluir este lançamento completo (saída e chegada)?"
        )
      ) {
        try {
          const response = await fetch(`/api/prv/registros/${registroId}`, {
            method: "DELETE",
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message);
          showToast(result.message, "success");
          carregarDadosPrv();
        } catch (error) {
          showToast(error.message, "error");
        }
      }
    }
  });

  limparFormBtn.addEventListener("click", limparFormulario);

  loadInitialData();
});
