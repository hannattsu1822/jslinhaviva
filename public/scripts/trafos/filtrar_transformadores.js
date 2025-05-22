// public/scripts/trafos/filtrar_transformadores.js

let accessDeniedModalInstance;
let developmentModalInstance;

document.addEventListener("DOMContentLoaded", () => {
  if (
    typeof bootstrap !== "undefined" &&
    typeof bootstrap.Modal !== "undefined"
  ) {
    const admEl = document.getElementById("access-denied-modal");
    if (admEl) accessDeniedModalInstance = new bootstrap.Modal(admEl);

    const devmEl = document.getElementById("development-modal");
    if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);
  } else {
    console.warn(
      "Filtrar Transformadores Script: Bootstrap JS não carregado ou bootstrap.Modal não está definido."
    );
  }

  carregarResponsaveis();

  const hoje = new Date();
  const hojeUTC = new Date(
    Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  );
  const hojeFormatada = hojeUTC.toISOString().split("T")[0];

  const dataFinalInput = document.getElementById("dataFinal");
  if (dataFinalInput) dataFinalInput.value = hojeFormatada;

  const filtrosIniciais = { dataFinal: hojeFormatada };
  buscarTransformadores(filtrosIniciais)
    .then((dados) => exibirResultados(dados))
    .catch((err) => {
      console.error("Erro ao carregar dados iniciais:", err);
      mostrarErro("Erro ao carregar dados iniciais");
    });

  const filtroFormEl = document.getElementById("filtroForm");
  if (filtroFormEl) {
    filtroFormEl.addEventListener("submit", async (event) => {
      event.preventDefault();
      const filtros = {
        numero_serie: document.getElementById("numero_serie").value.trim(),
        matricula_responsavel: document
          .getElementById("matricula_responsavel")
          .value.trim(),
        dataInicial: document.getElementById("dataInicial").value,
        dataFinal: document.getElementById("dataFinal").value,
      };
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
      const dados = await buscarTransformadores(filtros);
      exibirResultados(dados);
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
    console.error("Erro na requisição (navigateTo):", error);
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
    console.error("Erro ao carregar responsáveis:", error);
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

async function buscarTransformadores(filtros) {
  toggleLoading(true);
  const errorMsgEl = document.getElementById("errorMessage");
  if (errorMsgEl) errorMsgEl.style.display = "none";
  try {
    const response = await fetch("/api/filtrar_transformadores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(filtros),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Erro ao buscar transformadores");
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Erro na requisição buscarTransformadores:", error);
    mostrarErro("Erro ao buscar transformadores: " + error.message);
    return [];
  } finally {
    toggleLoading(false);
  }
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
    const dia = String(dateObj.getDate()).padStart(2, "0");
    const mes = String(dateObj.getMonth() + 1).padStart(2, "0");
    const ano = dateObj.getFullYear();
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
    const dados = [];
    const rows = document.querySelectorAll(
      "#resultadosBody tr:not(#semResultados)"
    );
    rows.forEach((row) => {
      dados.push({
        id: row.cells[0].textContent,
        numero_serie: row.cells[1].textContent,
        potencia: row.cells[2].textContent,
        marca: row.cells[3].textContent,
        data_formulario: row.cells[4].textContent,
        responsavel: row.cells[5].textContent,
        destinado: row.cells[6].textContent,
      });
    });
    if (dados.length === 0) {
      throw new Error("Nenhum dado para gerar PDF");
    }
    const response = await fetch("/api/gerar_pdf_tabela_transformadores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      throw new Error("Erro ao gerar PDF");
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
    console.error("Erro ao gerar PDF da tabela:", error);
    mostrarErro("Erro ao gerar PDF da tabela: " + error.message);
  } finally {
    btnPDF.innerHTML = originalHTML;
    btnPDF.disabled = false;
  }
}

async function gerarPDF(id) {
  const btnPDF = document.querySelector(`button[onclick="gerarPDF('${id}')"]`);
  if (!btnPDF) return;
  const originalHTML = btnPDF.innerHTML;
  btnPDF.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  btnPDF.disabled = true;
  try {
    const response = await fetch(`/api/gerar_pdf/${id}`);
    if (!response.ok) {
      throw new Error("Erro ao gerar PDF do item");
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const contentDisposition = response.headers.get("Content-Disposition");
    let filename = `transformador_${id}.pdf`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
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
    console.error("Erro ao gerar PDF do item:", error);
    mostrarErro("Erro ao gerar PDF do item: " + error.message);
  } finally {
    btnPDF.innerHTML = originalHTML;
    btnPDF.disabled = false;
  }
}

function exibirResultados(dados) {
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
    return;
  }

  dados.forEach((item) => {
    const row = document.createElement("tr");
    row.className = "glass-table-row";
    row.innerHTML = `
      <td>${item.id || "-"}</td>
      <td>${item.numero_serie || "-"}</td>
      <td>${item.potencia || "-"}</td>
      <td>${item.marca || "-"}</td>
      <td>${formatarData(item.data_formulario) || "-"}</td>
      <td>${
        item.nome_responsavel
          ? `${item.matricula_responsavel} - ${item.nome_responsavel}`
          : "-"
      }</td>
      <td>${item.transformador_destinado || "Não informado"}</td>
      <td>
        <div class="d-flex gap-2 justify-content-center">
          <button onclick="excluirTransformador('${
            item.id
          }')" class="btn btn-sm btn-danger glass-btn" title="Excluir">
            <i class="fas fa-trash"></i>
          </button>
          <button onclick="abrirRelatorio('${
            item.id
          }')" class="btn btn-sm btn-success glass-btn" title="Relatório">
            <i class="fas fa-file-alt"></i>
          </button>
          <button onclick="gerarPDF('${
            item.id
          }')" class="btn btn-sm btn-pdf glass-btn" title="Gerar PDF">
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
}

async function excluirTransformador(id) {
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
      const filtros = {
        numero_serie: document.getElementById("numero_serie").value,
        matricula_responsavel: document.getElementById("matricula_responsavel")
          .value,
        dataInicial: document.getElementById("dataInicial").value,
        dataFinal: document.getElementById("dataFinal").value,
      };
      const dados = await buscarTransformadores(filtros);
      exibirResultados(dados);
      alert("Checklist de transformador excluído com sucesso!");
    } catch (error) {
      console.error("Erro ao excluir transformador:", error);
      mostrarErro(error.message || "Erro ao excluir checklist");
    } finally {
      toggleLoading(false);
    }
  }
}

function abrirRelatorio(id) {
  window.location.href = `/relatorio_formulario?id=${id}`;
}
