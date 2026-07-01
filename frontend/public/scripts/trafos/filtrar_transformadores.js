// public/scripts/trafos/filtrar_transformadores.js

let accessDeniedModalInstance;
let developmentModalInstance;
let currentPage = 1;
const itemsPerPage = 15;
let filtrosAtuais = {};

document.addEventListener("DOMContentLoaded", () => {
  if (
    typeof bootstrap !== "undefined" &&
    typeof bootstrap.Modal !== "undefined"
  ) {
    const admEl = document.getElementById("access-denied-modal");
    if (admEl) accessDeniedModalInstance = new bootstrap.Modal(admEl);

    const devmEl = document.getElementById("development-modal");
    if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);
  }

  carregarResponsaveis();

  const hoje = new Date();
  const hojeUTC = new Date(
    Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  );
  const hojeFormatada = hojeUTC.toISOString().split("T")[0];

  const dataFinalInput = document.getElementById("dataFinal");
  if (dataFinalInput) dataFinalInput.value = hojeFormatada;

  filtrosAtuais = { dataFinal: hojeFormatada };
  buscarTransformadores(filtrosAtuais, { page: 1 })
    .then((resultado) =>
      exibirResultados(resultado.data, resultado.pagination, filtrosAtuais)
    )
    .catch((err) => {
      mostrarErro("Erro ao carregar dados iniciais");
    });

  const filtroFormEl = document.getElementById("filtroForm");
  if (filtroFormEl) {
    filtroFormEl.addEventListener("submit", async (event) => {
      event.preventDefault();
      const filtros = getFiltrosForm();
      if (
        !filtros.numero_serie &&
        !filtros.matricula_responsavel &&
        !filtros.dataInicial &&
        !filtros.dataFinal
      ) {
        mostrarErro("Por favor, preencha pelo menos um filtro");
        return;
      }
      if (
        filtros.dataInicial &&
        filtros.dataFinal &&
        filtros.dataInicial > filtros.dataFinal
      ) {
        mostrarErro("A data final deve ser maior ou igual à data inicial");
        return;
      }
      filtrosAtuais = { ...filtros };
      currentPage = 1;
      const resultado = await buscarTransformadores(filtrosAtuais, { page: 1 });
      exibirResultados(resultado.data, resultado.pagination, filtrosAtuais);
    });
  }

  const btnGerarPDFEl = document.getElementById("btnGerarPDF");
  if (btnGerarPDFEl) {
    btnGerarPDFEl.addEventListener("click", gerarPDFTabela);
  }
});

window.navigateTo = async function (pageName) {
  let url = pageName;
  if (!pageName.startsWith("/")) {
    url = `/${pageName}`;
  }

  if (window.location.pathname === url) {
    return;
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (response.ok) {
      window.location.href = url;
    } else if (response.status === 403) {
      if (accessDeniedModalInstance) accessDeniedModalInstance.show();
      else alert("Acesso negado!");
    } else {
      if (developmentModalInstance) developmentModalInstance.show();
      else alert("Recurso não encontrado ou em desenvolvimento.");
    }
  } catch (error) {
    if (developmentModalInstance) developmentModalInstance.show();
    else alert("Erro de rede ou falha na navegação.");
  }
};

async function carregarResponsaveis() {
  try {
    const response = await fetch("/api/responsaveis");
    if (!response.ok) {
      throw new Error("Erro ao carregar responsáveis técnicos");
    }
    const responsaveis = await response.json();
    const select = document.getElementById("matricula_responsavel");
    if (!select) return;
    select.innerHTML = '<option value="">Selecione um responsável</option>';
    responsaveis.forEach((responsavel) => {
      const option = document.createElement("option");
      option.value = responsavel.matricula;
      option.textContent = `${responsavel.matricula} - ${responsavel.nome}`;
      select.appendChild(option);
    });
  } catch (error) {
    mostrarErro("Erro ao carregar lista de responsáveis técnicos");
  }
}

function mostrarErro(mensagem) {
  const errorElement = document.getElementById("errorMessage");
  if (!errorElement) return;
  errorElement.textContent = mensagem;
  errorElement.style.display = "block";
  setTimeout(() => {
    errorElement.style.display = "none";
  }, 5000);
}

function toggleLoading(mostrar) {
  const btnFiltrar = document.getElementById("btnFiltrar");
  const spinner = document.getElementById("loadingSpinner");
  if (!btnFiltrar || !spinner) return;
  if (mostrar) {
    btnFiltrar.disabled = true;
    spinner.style.display = "inline-block";
  } else {
    btnFiltrar.disabled = false;
    spinner.style.display = "none";
  }
}

function getFiltrosForm() {
  return {
    numero_serie: document.getElementById("numero_serie").value.trim(),
    matricula_responsavel: document
      .getElementById("matricula_responsavel")
      .value.trim(),
    dataInicial: document.getElementById("dataInicial").value,
    dataFinal: document.getElementById("dataFinal").value,
  };
}

async function buscarTransformadores(filtros, { page = 1, limit = itemsPerPage } = {}) {
  toggleLoading(true);
  const errorMsgEl = document.getElementById("errorMessage");
  if (errorMsgEl) errorMsgEl.style.display = "none";
  try {
    const response = await fetch("/api/filtrar_transformadores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ...filtros, page, limit }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Erro ao buscar transformadores");
    }
    const payload = await response.json();
    if (Array.isArray(payload)) {
      return {
        data: payload,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: payload.length,
          itemsPerPage: payload.length || itemsPerPage,
          hasPrev: false,
          hasNext: false,
        },
      };
    }
    return {
      data: Array.isArray(payload?.data) ? payload.data : [],
      pagination: payload?.pagination || {
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        itemsPerPage: limit,
        hasPrev: false,
        hasNext: false,
      },
    };
  } catch (error) {
    mostrarErro("Erro ao buscar transformadores: " + error.message);
    return {
      data: [],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        itemsPerPage: limit,
        hasPrev: false,
        hasNext: false,
      },
    };
  } finally {
    toggleLoading(false);
  }
}

function renderizarInfoPaginacao(pagination) {
  const infoEl = document.getElementById("paginationInfo");
  if (!infoEl) return;
  const total = Number(pagination?.totalItems || 0);
  const page = Number(pagination?.currentPage || 1);
  const perPage = Number(pagination?.itemsPerPage || itemsPerPage);
  if (!total) {
    infoEl.textContent = "Mostrando 0 itens";
    return;
  }
  const start = (page - 1) * perPage + 1;
  const end = Math.min(start + perPage - 1, total);
  infoEl.textContent = `Mostrando ${start}-${end} de ${total} itens`;
}

function renderizarControlesPaginacao(pagination, filtros) {
  const container = document.getElementById("paginationControlsContainer");
  if (!container) return;
  container.innerHTML = "";
  const page = Number(pagination?.currentPage || 1);
  const totalPages = Number(pagination?.totalPages || 1);
  if (totalPages <= 1) return;

  const wrapper = document.createElement("div");
  wrapper.className = "d-flex align-items-center gap-2 flex-wrap";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "btn btn-outline-secondary btn-sm";
  prevBtn.textContent = "Prev";
  prevBtn.disabled = page <= 1;
  prevBtn.addEventListener("click", async () => {
    if (page <= 1) return;
    await carregarPagina(filtros, page - 1);
  });

  const pageLabel = document.createElement("span");
  pageLabel.className = "small text-muted";
  pageLabel.textContent = "Página";

  const pageSelect = document.createElement("select");
  pageSelect.className = "form-select form-select-sm";
  pageSelect.style.width = "90px";
  for (let i = 1; i <= totalPages; i += 1) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = String(i);
    option.selected = i === page;
    pageSelect.appendChild(option);
  }
  pageSelect.addEventListener("change", async () => {
    const selectedPage = parseInt(pageSelect.value, 10);
    if (!Number.isNaN(selectedPage) && selectedPage !== page) {
      await carregarPagina(filtros, selectedPage);
    }
  });

  const totalLabel = document.createElement("span");
  totalLabel.className = "small text-muted";
  totalLabel.textContent = `de ${totalPages}`;

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "btn btn-outline-secondary btn-sm";
  nextBtn.textContent = "Next";
  nextBtn.disabled = page >= totalPages;
  nextBtn.addEventListener("click", async () => {
    if (page >= totalPages) return;
    await carregarPagina(filtros, page + 1);
  });

  wrapper.appendChild(prevBtn);
  wrapper.appendChild(pageLabel);
  wrapper.appendChild(pageSelect);
  wrapper.appendChild(totalLabel);
  wrapper.appendChild(nextBtn);
  container.appendChild(wrapper);
}

async function carregarPagina(filtros, page) {
  currentPage = page;
  const resultado = await buscarTransformadores(filtros, { page: currentPage });
  exibirResultados(resultado.data, resultado.pagination, filtros);
}

function formatarData(dataString) {
  if (!dataString) return "-";
  if (
    typeof dataString === "string" &&
    /^\d{2}\/\d{2}\/\d{4}$/.test(dataString)
  ) {
    return dataString;
  }
  if (
    typeof dataString === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(dataString)
  ) {
    const [ano, mes, dia] = dataString.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  const dateObj = new Date(dataString);
  if (!isNaN(dateObj.getTime())) {
    const dia = String(dateObj.getUTCDate()).padStart(2, "0");
    const mes = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
    const ano = dateObj.getUTCFullYear();
    return `${dia}/${mes}/${ano}`;
  }
  return dataString;
}

async function gerarPDFTabela() {
  const btnPDF = document.getElementById("btnGerarPDF");
  if (!btnPDF) return;
  const originalHTML = btnPDF.innerHTML;
  btnPDF.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';
  btnPDF.disabled = true;
  try {
    const dados = await buscarTodosResultadosParaPdf();
    if (dados.length === 0) {
      throw new Error("Nenhum dado para gerar PDF. Aplique os filtros e aguarde os resultados.");
    }
    const response = await fetch("/api/gerar_pdf_tabela_transformadores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        dados,
        filtros: {
          dataInicial: document.getElementById("dataInicial").value,
          dataFinal: document.getElementById("dataFinal").value,
          numero_serie: document.getElementById("numero_serie").value,
          responsavel: document.getElementById("matricula_responsavel").value,
        },
      }),
    });
    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Erro ao gerar PDF" }));
      throw new Error(errorData.message || "Erro ao gerar PDF");
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Relatorio_Transformadores_${
      new Date().toISOString().split("T")[0]
    }.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    mostrarErro("Erro ao gerar PDF da tabela: " + error.message);
  } finally {
    btnPDF.innerHTML = originalHTML;
    btnPDF.disabled = false;
  }
}

async function buscarTodosResultadosParaPdf() {
  const resultados = [];
  let page = 1;
  let totalPages = 1;
  do {
    const resultado = await buscarTransformadores(filtrosAtuais, {
      page,
      limit: 100,
    });
    resultados.push(...(resultado.data || []));
    totalPages = Number(resultado.pagination?.totalPages || 1);
    page += 1;
  } while (page <= totalPages && page <= 200);
  return resultados;
}

window.gerarPDF = async function gerarPDF(id, button) {
  const btnPDF =
    button ||
    document.querySelector(
      `button[data-action="gerarPDF"][data-target="${id}"]`
    );
  if (!btnPDF) return;
  const originalHTML = btnPDF.innerHTML;
  btnPDF.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  btnPDF.disabled = true;
  try {
    const response = await fetch(`/api/gerar_pdf/${id}`, {
      credentials: "include",
    });
    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Erro ao gerar PDF do item" }));
      throw new Error(errorData.message || "Erro ao gerar PDF do item");
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const contentDisposition = response.headers.get("Content-Disposition");

    let filename = `transformador_${id}.pdf`;
    let filenameExtracted = null;

    if (contentDisposition) {
      const filenameQuotedMatch =
        contentDisposition.match(/filename="([^"]+)"/);

      if (filenameQuotedMatch && filenameQuotedMatch[1]) {
        filenameExtracted = filenameQuotedMatch[1];
      } else {
        const fallbackMatch = contentDisposition.match(/filename=([^;]+)/);
        if (fallbackMatch && fallbackMatch[1]) {
          filenameExtracted = fallbackMatch[1].trim().replace(/^"|"$/g, "");
        }
      }
      if (filenameExtracted) {
        filename = filenameExtracted;
      }
    }

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    mostrarErro("Erro ao gerar PDF do item: " + error.message);
  } finally {
    btnPDF.innerHTML = originalHTML;
    btnPDF.disabled = false;
  }
};

function exibirResultados(dados, pagination = {}, filtros = {}) {
  const tbody = document.getElementById("resultadosBody");
  const contadorEl = document.getElementById("contadorResultados");
  const infoFiltrosEl = document.getElementById("infoFiltros");

  if (!tbody || !contadorEl || !infoFiltrosEl) return;
  tbody.innerHTML = "";

  if (!dados || dados.length === 0) {
    const tr = document.createElement("tr");
    tr.id = "semResultados";
    const td = document.createElement("td");
    td.colSpan = 8;
    td.className = "text-center";
    td.textContent = "Nenhum resultado encontrado para os filtros aplicados.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    contadorEl.textContent = "0 resultados encontrados";
    infoFiltrosEl.textContent = "Filtros aplicados: Nenhum ou sem resultados.";
    renderizarInfoPaginacao(pagination);
    renderizarControlesPaginacao(pagination, filtros);
    return;
  }

  dados.forEach((item) => {
    const row = document.createElement("tr");
    row.className = "glass-table-row";
    row.innerHTML = safeHtml`
      <td data-label="ID">${item.id || "-"}</td>
      <td data-label="Número de Série">${item.numero_serie || "-"}</td>
      <td data-label="Potência (kVA)">${item.potencia || "-"}</td>
      <td data-label="Marca">${item.marca || "-"}</td>
      <td data-label="Data do Formulário">${formatarData(item.data_formulario) || "-"}</td>
      <td data-label="Responsável Técnico">${
        item.nome_responsavel
          ? `${item.matricula_responsavel} - ${item.nome_responsavel}`
          : "-"
      }</td>
      <td data-label="Destinado">${item.transformador_destinado || "Não informado"}</td>
      <td data-label="Ações">
        <div class="d-flex gap-2 justify-content-center">
          <button data-action="excluirTransformador" data-target="${item.id}" class="btn btn-sm btn-danger glass-btn" title="Excluir">
            <i class="fas fa-trash"></i>
          </button>
          <button data-action="abrirRelatorio" data-target="${item.id}" class="btn btn-sm btn-success glass-btn" title="Relatório">
            <i class="fas fa-file-alt"></i>
          </button>
          <button data-action="navigate" data-href="/transformadores/historico/${item.numero_serie}" class="btn btn-sm btn-info glass-btn" title="Histórico unificado">
            <i class="fas fa-history"></i>
          </button>
          <button data-action="gerarPDF" data-target="${item.id}" class="btn btn-sm btn-pdf glass-btn" title="Gerar PDF">
            <i class="fas fa-file-pdf"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });

  contadorEl.textContent = `${dados.length} resultado${
    dados.length !== 1 ? "s" : ""
  } encontrado${dados.length !== 1 ? "s" : ""}`;

  const formFiltros = document.getElementById("filtroForm");
  let infoFiltrosTxt = "Filtros aplicados: ";
  let algumFiltro = false;
  if (formFiltros.numero_serie.value) {
    infoFiltrosTxt += `Série: ${formFiltros.numero_serie.value}; `;
    algumFiltro = true;
  }
  if (formFiltros.matricula_responsavel.value) {
    const selectedResponsavel =
      formFiltros.matricula_responsavel.options[
        formFiltros.matricula_responsavel.selectedIndex
      ].text;
    infoFiltrosTxt += `Responsável: ${selectedResponsavel}; `;
    algumFiltro = true;
  }
  if (formFiltros.dataInicial.value) {
    infoFiltrosTxt += `De: ${formatarData(formFiltros.dataInicial.value)}; `;
    algumFiltro = true;
  }
  if (formFiltros.dataFinal.value) {
    infoFiltrosTxt += `Até: ${formatarData(formFiltros.dataFinal.value)};`;
    algumFiltro = true;
  }
  infoFiltrosEl.textContent = algumFiltro
    ? infoFiltrosTxt.trim().slice(0, -1)
    : "Filtros: Nenhum filtro ativo.";
  renderizarInfoPaginacao(pagination);
  renderizarControlesPaginacao(pagination, filtros);
}

window.excluirTransformador = async function excluirTransformador(id) {
  if (
    confirm("Tem certeza que deseja excluir este checklist de transformador?")
  ) {
    try {
      toggleLoading(true);
      const response = await fetch(`/api/excluir_transformador/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao excluir transformador");
      }
      const resultado = await buscarTransformadores(filtrosAtuais, {
        page: currentPage,
      });
      exibirResultados(resultado.data, resultado.pagination, filtrosAtuais);
      alert("Checklist de transformador excluído com sucesso!");
    } catch (error) {
      mostrarErro(error.message || "Erro ao excluir checklist");
    } finally {
      toggleLoading(false);
    }
  }
};

window.abrirRelatorio = function abrirRelatorio(id) {
  window.location.href = `/relatorio_formulario?id=${id}`;
};
