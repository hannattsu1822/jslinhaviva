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

  const hiddenRegistroIdInput = document.createElement("input");
  hiddenRegistroIdInput.type = "hidden";
  hiddenRegistroIdInput.id = "registro_id";
  prvForm.appendChild(hiddenRegistroIdInput);

  let currentState = {
    veiculoId: null,
    mesAno: null,
    veiculoTexto: "",
    registros: [],
  };

  const limparFormulario = () => {
    document.getElementById("dia").value = "";
    document.getElementById("saida_horario").value = "";
    document.getElementById("saida_km").value = "";
    document.getElementById("saida_local").value = "";
    document.getElementById("chegada_horario").value = "";
    document.getElementById("chegada_km").value = "";
    document.getElementById("chegada_local").value = "";
    document.getElementById("processo").value = "";
    document.getElementById("tipo_servico").value = "";
    document.getElementById("ocorrencias").value = "";
    hiddenRegistroIdInput.value = "";
  };

  const preencherDadosAtuais = () => {
    const agora = new Date();
    const diaAtual = agora.getDate();
    const horaAtual = agora.toTimeString().slice(0, 5);
    document.getElementById("dia").value = diaAtual;
    document.getElementById("saida_horario").value = horaAtual;
    document.getElementById("saida_km").focus();
  };

  const populateFormForEdit = (registroId) => {
    const registro = currentState.registros.find((r) => r.id == registroId);
    if (!registro) return;
    limparFormulario();
    hiddenRegistroIdInput.value = registro.id;
    for (const key in registro) {
      const input = document.getElementById(key);
      if (input) {
        if (input.type === "time" && registro[key]) {
          input.value = registro[key].substring(0, 5);
        } else {
          input.value = registro[key];
        }
      }
    }
    window.scrollTo({ top: formContainer.offsetTop, behavior: "smooth" });
  };

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
          }" title="Editar">
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

  const loadPrvRecords = async () => {
    try {
      const { veiculoId, mesAno } = currentState;
      const response = await fetch(
        `/api/prv/registros?veiculoId=${veiculoId}&mesAno=${mesAno}`
      );
      if (!response.ok) throw new Error("Falha ao carregar registros.");
      currentState.registros = await response.json();
      renderTable();
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
    infoPeriodoEl.textContent = `Período: ${mes}/${ano}`;
    modalInstance.hide();
    infoPrvHeader.style.display = "block";
    formContainer.style.display = "block";
    tableContainer.style.display = "block";
    loadPrvRecords();
    limparFormulario();
    preencherDadosAtuais();
  });

  prvForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const registroId = hiddenRegistroIdInput.value;
    const isEditing = !!registroId;
    const formData = {
      dia: document.getElementById("dia").value,
      saida_horario: document.getElementById("saida_horario").value || null,
      saida_km: document.getElementById("saida_km").value || null,
      saida_local: document.getElementById("saida_local").value,
      chegada_horario: document.getElementById("chegada_horario").value || null,
      chegada_km: document.getElementById("chegada_km").value || null,
      chegada_local: document.getElementById("chegada_local").value,
      processo: document.getElementById("processo").value,
      tipo_servico: document.getElementById("tipo_servico").value,
      ocorrencias: document.getElementById("ocorrencias").value,
    };
    const url = isEditing
      ? `/api/prv/registros/${registroId}`
      : "/api/prv/registros";
    const method = isEditing ? "PUT" : "POST";
    if (!isEditing) {
      formData.veiculo_id = currentState.veiculoId;
      formData.mes_ano_referencia = currentState.mesAno;
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
      limparFormulario();
      preencherDadosAtuais();
      loadPrvRecords();
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  prvTableBody.addEventListener("click", async (e) => {
    const target = e.target.closest("button");
    if (!target) return;
    const registroId = target.dataset.id;
    if (target.classList.contains("edit-btn")) {
      populateFormForEdit(registroId);
    }
    if (target.classList.contains("delete-btn")) {
      if (confirm("Tem certeza que deseja excluir este lançamento?")) {
        try {
          const response = await fetch(`/api/prv/registros/${registroId}`, {
            method: "DELETE",
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message);
          showToast(result.message, "success");
          loadPrvRecords();
        } catch (error) {
          showToast(error.message, "error");
        }
      }
    }
  });

  limparFormBtn.addEventListener("click", limparFormulario);

  loadInitialData();
});
