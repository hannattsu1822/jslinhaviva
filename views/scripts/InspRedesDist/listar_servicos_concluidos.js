document.addEventListener("DOMContentLoaded", function () {
  const tabelaServicosBody = document.querySelector(
    "#tabela-servicos-concluidos tbody"
  );
  const filtroProcesso = document.getElementById("filtro-processo");
  const filtroData = document.getElementById("filtro-data");
  const filtroLocal = document.getElementById("filtro-local");

  const modalReativarEl = document.getElementById("modal-reativar");
  const modalReativar = new bootstrap.Modal(modalReativarEl);
  const formReativar = document.getElementById("form-reativar");

  const modalAnexarEl = document.getElementById("modal-anexar-apr");
  const modalAnexar = new bootstrap.Modal(modalAnexarEl);
  const formAnexar = document.getElementById("form-anexar-apr");

  let allServicosConcluidos = [];

  function getStatusBadge(status) {
    if (status === "Finalizado") {
      return '<span class="badge bg-success">Finalizado</span>';
    }
    return `<span class="badge bg-secondary">${status}</span>`;
  }

  function renderizarTabela(servicos) {
    tabelaServicosBody.innerHTML = "";
    if (!servicos || servicos.length === 0) {
      tabelaServicosBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">Nenhuma inspeção concluída encontrada.</td></tr>`;
      return;
    }

    servicos.forEach((servico) => {
      const dataFormatada = new Date(servico.data_servico).toLocaleDateString(
        "pt-BR",
        { timeZone: "UTC" }
      );

      const tr = document.createElement("tr");
      tr.dataset.servicoId = servico.id;
      tr.innerHTML = `
        <td><strong>${
          servico.processo
        }</strong><br /><small class="text-muted">ID: ${servico.id}</small></td>
        <td>${dataFormatada}</td>
        <td>${getStatusBadge(servico.status)}</td>
        <td>${servico.responsaveis_execucao}</td>
        <td>${servico.alimentador || "N/A"}</td>
        <td>${servico.subestacao || "N/A"}</td>
        <td class="text-center action-bar">
          <a href="/inspecoes/servicos/${
            servico.id
          }" class="btn btn-outline-info btn-icon" title="Ver Detalhes">
            <span class="material-icons">visibility</span>
          </a>
          <a href="/inspecoes/servicos/${
            servico.id
          }/relatorio" class="btn btn-outline-dark btn-icon" title="Gerar Relatório PDF" target="_blank">
            <span class="material-icons">picture_as_pdf</span>
          </a>
          <button class="btn btn-outline-warning btn-icon btn-reativar" title="Reativar Inspeção">
            <span class="material-icons">replay</span>
          </button>
          <button class="btn btn-outline-primary btn-icon btn-anexar-apr" title="Anexar APR">
            <span class="material-icons">attach_file</span>
          </button>
        </td>
      `;
      tabelaServicosBody.appendChild(tr);
    });
  }

  async function inicializarPagina() {
    try {
      const response = await fetch("/inspecoes/api/servicos/concluidos");
      if (!response.ok) {
        throw new Error("Falha ao carregar a lista de inspeções concluídas.");
      }
      allServicosConcluidos = await response.json();
      renderizarTabela(allServicosConcluidos);
    } catch (error) {
      console.error(error);
      tabelaServicosBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">${error.message}</td></tr>`;
    }
  }

  function abrirModalReativacao(servicoId) {
    formReativar.reset();
    document.getElementById("reativar-servico-id").value = servicoId;
    modalReativar.show();
  }

  async function handleReativarServico(event) {
    event.preventDefault();
    const submitButton = document.getElementById("btn-confirmar-reativacao");
    submitButton.disabled = true;

    const servicoId = document.getElementById("reativar-servico-id").value;

    try {
      const response = await fetch(
        `/inspecoes/api/servicos/${servicoId}/reativar`,
        {
          method: "POST",
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      alert(
        "Inspeção reativada com sucesso! Ela foi movida para a lista de serviços ativos."
      );
      tabelaServicosBody
        .querySelector(`tr[data-servico-id='${servicoId}']`)
        .remove();
      modalReativar.hide();
    } catch (error) {
      alert(`Erro ao reativar inspeção: ${error.message}`);
    } finally {
      submitButton.disabled = false;
    }
  }

  function abrirModalAnexar(servicoId) {
    formAnexar.reset();
    document.getElementById("anexar-servico-id").value = servicoId;
    modalAnexar.show();
  }

  async function handleAnexarArquivo(event) {
    event.preventDefault();
    const submitButton = document.getElementById("btn-salvar-anexo-apr");
    submitButton.disabled = true;

    const servicoId = document.getElementById("anexar-servico-id").value;
    const formData = new FormData(formAnexar);

    try {
      const response = await fetch(
        `/inspecoes/api/servicos/${servicoId}/anexos-gerais`,
        {
          method: "POST",
          body: formData,
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      alert("Arquivo anexado com sucesso!");
      modalAnexar.hide();
    } catch (error) {
      alert(`Erro ao anexar arquivo: ${error.message}`);
    } finally {
      submitButton.disabled = false;
    }
  }

  function aplicarFiltros() {
    const termoProcesso = filtroProcesso.value.toLowerCase();
    const dataSelecionada = filtroData.value;
    const termoLocal = filtroLocal.value.toLowerCase();

    const servicosFiltrados = allServicosConcluidos.filter((servico) => {
      const idProcesso = `${servico.id} ${servico.processo}`.toLowerCase();
      const dataPrevistaISO = new Date(servico.data_servico)
        .toISOString()
        .split("T")[0];
      const local = `${servico.alimentador || ""} ${
        servico.subestacao || ""
      }`.toLowerCase();

      const matchProcesso = idProcesso.includes(termoProcesso);
      const matchData = !dataSelecionada || dataPrevistaISO === dataSelecionada;
      const matchLocal = local.includes(termoLocal);

      return matchProcesso && matchData && matchLocal;
    });
    renderizarTabela(servicosFiltrados);
  }

  tabelaServicosBody.addEventListener("click", function (event) {
    const target = event.target.closest("button");
    if (!target) return;
    const row = target.closest("tr");
    if (!row) return;
    const servicoId = row.dataset.servicoId;

    if (target.classList.contains("btn-reativar")) {
      abrirModalReativacao(servicoId);
    } else if (target.classList.contains("btn-anexar-apr")) {
      abrirModalAnexar(servicoId);
    }
  });

  formReativar.addEventListener("submit", handleReativarServico);
  formAnexar.addEventListener("submit", handleAnexarArquivo);

  filtroProcesso.addEventListener("input", aplicarFiltros);
  filtroData.addEventListener("change", aplicarFiltros);
  filtroLocal.addEventListener("input", aplicarFiltros);

  inicializarPagina();
});
