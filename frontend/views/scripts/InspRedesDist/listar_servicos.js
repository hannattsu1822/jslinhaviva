document.addEventListener("DOMContentLoaded", function () {
  const P = () => window.RedePermissions || {};
  let currentUser = null;

  const tabelaServicosBody = document.querySelector("#tabela-servicos tbody");
  const filtroProcesso = document.getElementById("filtro-processo");
  const filtroData = document.getElementById("filtro-data");
  const filtroLocal = document.getElementById("filtro-local");

  const modalAtribuirEl = document.getElementById("modal-atribuir");
  const modalAtribuir = new bootstrap.Modal(modalAtribuirEl);
  const formAtribuir = document.getElementById("form-atribuir");
  const responsaveisCheckboxContainer = document.getElementById(
    "responsaveis-checkbox-container"
  );

  let allResponsaveis = [];
  let allServicos = [];

  function getStatusBadge(status) {
    switch (status) {
      case "Finalizado":
        return '<span class="badge bg-success">Finalizado</span>';
      case "Em Andamento":
        return '<span class="badge bg-warning text-dark">Em Andamento</span>';
      case "Pendente":
      default:
        return '<span class="badge bg-secondary">Pendente</span>';
    }
  }

  function renderizarTabela(servicos) {
    tabelaServicosBody.innerHTML = "";
    if (!servicos || servicos.length === 0) {
      tabelaServicosBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">Nenhuma inspeção encontrada.</td></tr>`;
      return;
    }

    const isAdmin = P().temControleTotal?.(currentUser);

    servicos.forEach((servico) => {
      const dataFormatada = new Date(servico.data_servico).toLocaleDateString(
        "pt-BR",
        { timeZone: "UTC" }
      );

      const tr = document.createElement("tr");
      tr.className = "insp-redes-table-row";
      tr.dataset.servicoId = servico.id;
      tr.innerHTML = safeHtml`
        <td data-label="ID/Processo" class="insp-redes-cell-processo"><strong>${
          servico.processo
        }</strong><br /><small>ID: ${servico.id}</small></td>
        <td data-label="Data Prevista">${dataFormatada}</td>
        <td data-label="Status" class="col-status">${rawHtml(getStatusBadge(servico.status))}</td>
        <td data-label="Responsável">${servico.responsaveis_execucao}</td>
        <td data-label="Alimentador">${servico.alimentador || "N/A"}</td>
        <td data-label="Subestação">${servico.subestacao || "N/A"}</td>
        <td class="insp-redes-actions" data-label="Ações">
          <div class="insp-redes-actions__toolbar">
            <a href="/inspecoes/servicos/${
              servico.id
            }/coletar" class="btn btn-outline-primary btn-icon" title="Coletar Pontos">
              <span class="material-icons">edit_location_alt</span>
            </a>
            ${rawHtml(
              isAdmin
                ? `<button type="button" class="btn btn-outline-secondary btn-icon btn-atribuir" title="Atribuir Responsável">
              <span class="material-icons">group_add</span>
            </button>
            <button type="button" class="btn btn-outline-danger btn-icon btn-excluir" title="Excluir Inspeção">
              <span class="material-icons">delete</span>
            </button>`
                : ""
            )}
          </div>
        </td>
      `;
      tabelaServicosBody.appendChild(tr);
    });
  }

  async function inicializarPagina() {
    try {
      const userResponse = await fetch("/api/me", { credentials: "same-origin" });
      if (userResponse.ok) {
        currentUser = await userResponse.json();
      }

      const requests = [fetch("/inspecoes/api/servicos/lista")];
      if (P().temControleTotal?.(currentUser)) {
        requests.push(fetch("/inspecoes/api/responsaveis"));
      }

      const [servicosResponse, responsaveisResponse] = await Promise.all(
        requests
      );

      if (!servicosResponse.ok)
        throw new Error("Falha ao carregar a lista de inspeções.");
      allServicos = await servicosResponse.json();
      renderizarTabela(allServicos);

      if (responsaveisResponse?.ok) {
        allResponsaveis = await responsaveisResponse.json();
        responsaveisCheckboxContainer.innerHTML = allResponsaveis
          .map(
            (user) => `
        <div class="form-check">
          <input class="form-check-input" type="checkbox" value="${user.matricula}" id="resp-${user.matricula}">
          <label class="form-check-label" for="resp-${user.matricula}">${user.nome}</label>
        </div>
      `
          )
          .join("");
      } else if (P().temControleTotal?.(currentUser)) {
        throw new Error("Falha ao carregar a lista de responsáveis.");
      }
    } catch (error) {
      console.error(error);
      tabelaServicosBody.innerHTML = safeHtml`<tr><td colspan="7" class="text-center text-danger py-4">${error.message}</td></tr>`;
    }
  }

  function abrirModalAtribuicao(servicoId) {
    formAtribuir.reset();
    document.getElementById("atribuir-servico-id").value = servicoId;
    modalAtribuir.show();
  }

  async function handleSalvarAtribuicao(event) {
    event.preventDefault();
    const submitButton = document.getElementById("btn-salvar-atribuicao");
    submitButton.disabled = true;

    const servicoId = document.getElementById("atribuir-servico-id").value;
    const selectedOptions = Array.from(
      responsaveisCheckboxContainer.querySelectorAll(
        'input[type="checkbox"]:checked'
      )
    ).map((cb) => cb.value);

    try {
      const response = await fetch(
        `/inspecoes/api/servicos/${servicoId}/atribuir`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responsaveis_matriculas: selectedOptions }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      alert("Responsáveis atribuídos com sucesso!");
      const row = tabelaServicosBody.querySelector(
        `tr[data-servico-id='${servicoId}']`
      );
      if (row) {
        row.querySelector(".col-responsavel").textContent =
          result.nomesResponsaveis || "Pendente";
      }
      modalAtribuir.hide();
    } catch (error) {
      alert(`Erro ao atribuir responsáveis: ${error.message}`);
    } finally {
      submitButton.disabled = false;
    }
  }

  async function handleExcluirServico(servicoId) {
    if (
      !confirm(
        `Tem certeza que deseja excluir a inspeção ID ${servicoId}? Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    try {
      const response = await fetch(`/inspecoes/api/servicos/${servicoId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      alert("Inspeção excluída com sucesso!");

      tabelaServicosBody
        .querySelector(`tr[data-servico-id='${servicoId}']`)
        .remove();
      allServicos = allServicos.filter((s) => s.id != servicoId);
    } catch (error) {
      alert(`Erro ao excluir inspeção: ${error.message}`);
    }
  }

  function aplicarFiltros() {
    const termoProcesso = filtroProcesso.value.toLowerCase();
    const dataSelecionada = filtroData.value;
    const termoLocal = filtroLocal.value.toLowerCase();

    const servicosFiltrados = allServicos.filter((servico) => {
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

    if (target.classList.contains("btn-atribuir")) {
      abrirModalAtribuicao(servicoId);
    } else if (target.classList.contains("btn-excluir")) {
      handleExcluirServico(servicoId);
    }
  });

  formAtribuir.addEventListener("submit", handleSalvarAtribuicao);

  filtroProcesso.addEventListener("input", aplicarFiltros);
  filtroData.addEventListener("change", aplicarFiltros);
  filtroLocal.addEventListener("input", aplicarFiltros);

  inicializarPagina();
});
