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
  const motoristaDelegadoContainer = document.getElementById(
    "motorista-delegado-container"
  );
  const motoristaMatriculaSelect = document.getElementById("motorista_matricula");

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
    ultimoKmRegistrado: null,
    currentUser: null,
    podeDelegarMotorista: false,
  };

function normalizeKmPayload(payload) {
  let km = payload;

  if (km && typeof km === "object") {
    km = (
      km.chegadakm ??
      km.ultimoKm ??
      km.ultimo_km ??
      km.km ??
      km.value ??
      null
    );
  }

  if (km === "" || km === undefined) return null;

  km = km === null ? null : Number(km);
  return Number.isFinite(km) ? km : null;
}

  function formatarDiaPrv(registro) {
    if (registro.data_viagem) {
      const [ano, mes, dia] = String(registro.data_viagem).split("-");
      if (ano && mes && dia) return `${dia}/${mes}/${ano}`;
    }
    if (registro.dia != null && registro.mes_ano_referencia) {
      const [mes, ano] = String(registro.mes_ano_referencia).split("/");
      if (mes && ano) {
        return `${String(registro.dia).padStart(2, "0")}/${mes}/${ano}`;
      }
    }
    return "—";
  }

  const limparFormulario = () => {
    prvForm.reset();
    hiddenRegistroIdInput.value = "";
    if (motoristaMatriculaSelect) {
      motoristaMatriculaSelect.value = "";
    }
    document.getElementById("data_viagem").value = new Date()
      .toISOString()
      .slice(0, 10);
    atualizarUiComEstado();
  };

  const preencherDadosAtuaisSaida = () => {
    const agora = new Date();
    document.getElementById("data_viagem").value = agora
      .toISOString()
      .slice(0, 10);
    document.getElementById("saida_horario").value = agora
      .toTimeString()
      .slice(0, 5);
    document.getElementById("saida_local").focus();
  };

  const preencherDadosAtuaisChegada = () => {
    const agora = new Date();
    document.getElementById("chegada_horario").value = agora
      .toTimeString()
      .slice(0, 5);
    document.getElementById("chegada_km").focus();
  };

  const toggleFormFields = (tipo) => {
    const dataViagemInput = document.getElementById("data_viagem");
    if (tipo === "saida") {
      saidaFields.classList.remove("d-none");
      chegadaFields.classList.add("d-none");
      salvarBtn.innerHTML =
        '<i class="fa-solid fa-truck-fast me-2"></i>Salvar Saída';
      dataViagemInput.required = true;
    } else {
      saidaFields.classList.add("d-none");
      chegadaFields.classList.remove("d-none");
      salvarBtn.innerHTML =
        '<i class="fa-solid fa-flag-checkered me-2"></i>Salvar Chegada';
      dataViagemInput.required = false;
    }
  };

  const atualizarUiComEstado = () => {
    const saidaKmInput = document.getElementById("saida_km");
    if (currentState.viagemAberta) {
      tipoLancamentoSaida.disabled = true;
      tipoLancamentoChegada.disabled = false;
      tipoLancamentoChegada.checked = true;
      toggleFormFields("chegada");
      const saida = currentState.viagemAberta;
      const motoristaInfo = saida.motorista_matricula
        ? `<br>Motorista: <strong>${saida.motorista_matricula}</strong>`
        : "";
      const delegadoInfo = saida.criado_por_matricula
        ? `<br><small class="text-muted">Registrado por gestor: ${saida.criado_por_matricula}</small>`
        : "";
      infoViagemAbertaEl.innerHTML = safeHtml`
        <strong>Viagem em andamento:</strong><br>
        Saindo de: <strong>${saida.saida_local}</strong><br>
        KM de Saída: <strong>${
          saida.saida_km
        }</strong> | Horário: <strong>${saida.saida_horario.substring(
        0,
        5
      )}</strong>${motoristaInfo}${delegadoInfo}`;
      preencherDadosAtuaisChegada();
    } else {
      tipoLancamentoSaida.disabled = false;
      tipoLancamentoChegada.disabled = true;
      tipoLancamentoSaida.checked = true;
      toggleFormFields("saida");
      if (currentState.ultimoKmRegistrado !== null) {
        saidaKmInput.value = currentState.ultimoKmRegistrado;
        saidaKmInput.readOnly = true;
      } else {
        saidaKmInput.value = "";
        saidaKmInput.readOnly = false;
        saidaKmInput.placeholder = "Primeiro KM do veículo";
      }
      preencherDadosAtuaisSaida();
    }
  };

  [tipoLancamentoSaida, tipoLancamentoChegada].forEach((el) =>
    el.addEventListener("change", (e) => toggleFormFields(e.target.value))
  );

  const renderTable = () => {
    prvTableBody.innerHTML = "";
    if (currentState.registros.length === 0) {
      prvTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4">Nenhum lançamento encontrado.</td></tr>`;
      return;
    }
    currentState.registros.forEach((r) => {
      const kmPercorrido =
        r.chegada_km && r.saida_km ? r.chegada_km - r.saida_km : "N/A";
      const saidaInfo = `${r.saida_local || ""} <br><small class="text-muted">${
        r.saida_horario ? r.saida_horario.substring(0, 5) : ""
      } - ${r.saida_km || ""} KM</small>`;
      const chegadaInfo = `${
        r.chegada_local || ""
      } <br><small class="text-muted">${
        r.chegada_horario ? r.chegada_horario.substring(0, 5) : ""
      } - ${r.chegada_km || ""} KM</small>`;
      const tr = document.createElement("tr");
      tr.innerHTML = safeHtml`
        <td data-label="Dia">${formatarDiaPrv(r)}</td>
        <td data-label="Saída">${saidaInfo}</td>
        <td data-label="Chegada">${chegadaInfo}</td>
        <td data-label="KM">${kmPercorrido}</td>
        <td data-label="Motorista">${r.motorista_matricula}</td>
        <td data-label="Serviço">${r.tipo_servico || ""}</td>
        <td data-label="Ações">
          <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${
            r.id
          }" title="Excluir">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      `;
      prvTableBody.appendChild(tr);
    });
  };

  const carregarDadosPrv = async () => {
    const { veiculoId, mesAno } = currentState;
    try {
      const [statusRes, ultimoKmRes, registrosRes] = await Promise.all([
        fetch(`/api/prv/status?veiculoId=${veiculoId}`),
        fetch(`/api/prv/ultimo-km?veiculoId=${veiculoId}`),
        fetch(`/api/prv/registros?veiculoId=${veiculoId}&mesAno=${mesAno}`),
      ]);
      if (!statusRes.ok || !ultimoKmRes.ok || !registrosRes.ok)
        throw new Error("Falha ao carregar dados da planilha.");
      const viagemAberta = await statusRes.json();
      const ultimoKmPayload = await ultimoKmRes.json();
      const ultimoKm = normalizeKmPayload(ultimoKmPayload);
      const registros = await registrosRes.json();
      currentState = {
        ...currentState,
        viagemAberta,
        ultimoKmRegistrado: ultimoKm,
        registros,
      };
      renderTable();
      atualizarUiComEstado();
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  const carregarMotoristasDelegaveis = async () => {
    try {
      const response = await fetch("/api/prv/motoristas");
      if (!response.ok) return;
      const motoristas = await response.json();
      motoristaMatriculaSelect.innerHTML =
        '<option value="">Eu (registrar em meu nome)</option>';
      motoristas.forEach((m) => {
        if (m.matricula === currentState.currentUser?.matricula) return;
        motoristaMatriculaSelect.innerHTML += safeHtml`<option value="${m.matricula}">${m.nome} (${m.matricula})</option>`;
      });
      motoristaDelegadoContainer.classList.remove("d-none");
    } catch (error) {
      console.error("Erro ao carregar motoristas:", error);
    }
  };

  const loadInitialData = async () => {
    mesAnoInput.value = new Date().toISOString().slice(0, 7);
    try {
      const [meRes, veiculosRes] = await Promise.all([
        fetch("/api/me"),
        fetch("/api/prv/veiculos"),
      ]);
      if (meRes.ok) {
        currentState.currentUser = await meRes.json();
        currentState.podeDelegarMotorista =
          (currentState.currentUser?.nivel ?? 0) >= 7;
        if (currentState.podeDelegarMotorista) {
          await carregarMotoristasDelegaveis();
        }
      }
      if (!veiculosRes.ok)
        throw new Error("Não foi possível carregar a lista de veículos.");
      const veiculos = await veiculosRes.json();
      veiculoSelect.innerHTML =
        '<option value="" selected>Selecione um veículo...</option>';
      veiculos.forEach((v) => {
        veiculoSelect.innerHTML += safeHtml`<option value="${v.id}">${v.modelo} - ${v.placa}</option>`;
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
    infoPeriodoEl.textContent = `Período: ${mes}/${ano}`;
    modalInstance.hide();
    infoPrvHeader.classList.remove("d-none");
    formContainer.classList.remove("d-none");
    tableContainer.classList.remove("d-none");
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
      if (currentState.podeDelegarMotorista && motoristaMatriculaSelect) {
        const motoristaSelecionado = motoristaMatriculaSelect.value.trim();
        if (motoristaSelecionado) {
          formData.motorista_matricula = motoristaSelecionado;
        }
      }
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

    const originalButtonHTML = salvarBtn.innerHTML;
    salvarBtn.disabled = true;
    salvarBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...`;

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      showToast(result.message, "success");
      prvForm.reset();
      carregarDadosPrv();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      salvarBtn.disabled = false;
      salvarBtn.innerHTML = originalButtonHTML;
    }
  });

  prvTableBody.addEventListener("click", async (e) => {
    const target = e.target.closest(".delete-btn");
    if (!target) return;
    const registroId = target.dataset.id;

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
  });

  limparFormBtn.addEventListener("click", limparFormulario);

  loadInitialData();
});
