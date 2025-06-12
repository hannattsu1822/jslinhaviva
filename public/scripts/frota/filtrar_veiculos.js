// public/scripts/frota/filtrar_veiculos.js

let accessDeniedModalInstance;
let developmentModalInstance;
let user = null;

async function carregarPlacas() {
  try {
    const response = await fetch("/api/placas", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    if (!response.ok) throw new Error("Erro ao carregar placas");
    const data = await response.json();
    const placaSelect = document.getElementById("placa");
    if (!placaSelect) return;

    placaSelect.innerHTML = '<option value="">Todas as placas</option>';
    data.forEach((veiculo) => {
      const option = document.createElement("option");
      option.value = veiculo.placa;
      option.textContent = veiculo.placa;
      placaSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar placas:", error);
  }
}

async function carregarMatriculas() {
  try {
    const response = await fetch("/api/motoristas", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    if (!response.ok) throw new Error("Erro ao carregar matrículas");
    const data = await response.json();
    const matriculaSelect = document.getElementById("matricula");
    if (!matriculaSelect) return;

    matriculaSelect.innerHTML = '<option value="">Todas as matrículas</option>';
    data.forEach((motorista) => {
      const option = document.createElement("option");
      option.value = motorista.matricula;
      option.textContent = `${motorista.matricula} - ${motorista.nome}`;
      matriculaSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar matrículas:", error);
  }
}

async function buscarInspecoes(filtros) {
  const submitButton = document.querySelector(
    "#filtroForm button[type='submit']"
  );
  let originalButtonHTML = "";
  if (submitButton) {
    originalButtonHTML = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML =
      '<i class="fas fa-spinner fa-spin me-2"></i>Filtrando...';
  }

  try {
    const response = await fetch("/api/filtrar_inspecoes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(filtros),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Erro ao buscar inspeções");
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Erro ao buscar inspeções:", error);
    alert("Falha ao buscar inspeções: " + error.message);
    return [];
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonHTML;
    }
  }
}

function exibirResultados(inspecoes) {
  const tbody = document.querySelector("#tabelaResultados tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!inspecoes || inspecoes.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.className = "text-center py-4";
    td.innerHTML =
      '<i class="fas fa-info-circle me-2"></i>Nenhum resultado encontrado com os filtros aplicados.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  inspecoes.forEach((inspecao) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${inspecao.id}</td>
      <td>${inspecao.placa || "N/A"}</td>
      <td>${inspecao.matricula_motorista || inspecao.matricula || "N/A"}</td>
      <td>${
        inspecao.data_inspecao
          ? new Date(inspecao.data_inspecao).toLocaleDateString("pt-BR", {
              timeZone: "UTC",
            })
          : "N/A"
      }</td>
      <td>${inspecao.km_atual || "N/A"}</td>
      <td>${inspecao.horimetro || "N/A"}</td>
      <td>
        <button onclick="window.navigateTo('/relatorio_publico_veiculos?id=${
          inspecao.id
        }')" 
                class="btn btn-sm btn-success" title="Ver Relatório Detalhado">
          <i class="fas fa-file-alt"></i>
        </button>
      </td>
      <td>
        <div class="d-flex gap-1 justify-content-center">
          <button onclick="window.editarInspecao(${inspecao.id})" 
                  class="btn btn-sm btn-primary" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button onclick="window.excluirInspecao(${inspecao.id}, this)" 
                  class="btn btn-sm btn-danger" title="Excluir">
            <i class="fas fa-trash"></i>
          </button>
          <button onclick="window.gerarPDF(${inspecao.id}, this)" 
                  class="btn btn-sm btn-pdf" title="Gerar PDF">
            <i class="fas fa-file-pdf"></i>
          </button>
        </div>
      </td>`;
    tbody.appendChild(row);
  });
}

window.gerarPDF = async function (id, button) {
  const originalHTML = button.innerHTML;
  button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  button.disabled = true;
  try {
    const responseInspecao = await fetch(`/api/inspecoes/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    if (!responseInspecao.ok)
      throw new Error("Erro ao obter dados da inspeção para PDF");
    const inspecao = await responseInspecao.json();

    const responsePDF = await fetch(`/api/gerar_pdf_veiculos/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    if (!responsePDF.ok) throw new Error("Erro ao gerar PDF");

    const blob = await responsePDF.blob();
    const url = window.URL.createObjectURL(blob);
    const placaFormatada = String(inspecao.placa || "SEM_PLACA").replace(
      /[^a-zA-Z0-9]/g,
      "_"
    );
    const filename = `inspecao_${id}_${placaFormatada}.pdf`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    alert("Erro ao gerar PDF: " + error.message);
  } finally {
    button.innerHTML = originalHTML;
    button.disabled = false;
  }
};

window.editarInspecao = async function (id) {
  window.location.href = `/editar_inspecao?id=${id}`;
};

window.excluirInspecao = async function (id, buttonElement) {
  if (confirm("Tem certeza que deseja excluir esta inspeção?")) {
    const originalBtnHTML = buttonElement.innerHTML;
    buttonElement.disabled = true;
    buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    try {
      const response = await fetch(`/api/excluir_inspecao/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Erro ao excluir inspeção");
      }
      alert("Inspeção excluída com sucesso!");
      const filtroForm = document.getElementById("filtroForm");
      if (filtroForm)
        filtroForm.dispatchEvent(new Event("submit", { cancelable: true }));
    } catch (error) {
      console.error("Erro ao excluir inspeção:", error);
      alert("Erro ao excluir inspeção: " + error.message);
      buttonElement.disabled = false;
      buttonElement.innerHTML = originalBtnHTML;
    }
  }
};

window.navigateTo = async function (pageNameOrUrl) {
  let urlToNavigate = pageNameOrUrl;
  if (!pageNameOrUrl.startsWith("/") && !pageNameOrUrl.startsWith("http")) {
    urlToNavigate = `/${pageNameOrUrl}`;
  }
  if (
    window.location.pathname === urlToNavigate &&
    !urlToNavigate.includes("?")
  )
    return;

  try {
    const response = await fetch(urlToNavigate);
    if (response.ok) {
      window.location.href = urlToNavigate;
    } else if (response.status === 403) {
      if (accessDeniedModalInstance) accessDeniedModalInstance.show();
      else alert("Acesso negado!");
    } else if (response.status === 404) {
      if (developmentModalInstance) developmentModalInstance.show();
      else alert("Página não encontrada ou em desenvolvimento.");
    } else {
      if (developmentModalInstance) developmentModalInstance.show();
      else alert("Erro ao tentar acessar a página.");
    }
  } catch (error) {
    if (developmentModalInstance) developmentModalInstance.show();
    else alert("Erro de rede ou falha na navegação.");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  user = JSON.parse(localStorage.getItem("user"));

  if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
    const admEl = document.getElementById("access-denied-modal");
    if (admEl) accessDeniedModalInstance = new bootstrap.Modal(admEl);

    const devmEl = document.getElementById("development-modal");
    if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);
  }

  carregarPlacas();
  carregarMatriculas();

  const filtroFormEl = document.getElementById("filtroForm");
  if (filtroFormEl) {
    filtroFormEl.addEventListener("submit", async (event) => {
      event.preventDefault();
      const filtros = {
        placa: document.getElementById("placa")?.value || "",
        matricula: document.getElementById("matricula")?.value || "",
        dataInicial: document.getElementById("dataInicial")?.value || "",
        dataFinal: document.getElementById("dataFinal")?.value || "",
      };
      if (
        !filtros.placa &&
        !filtros.matricula &&
        !filtros.dataInicial &&
        !filtros.dataFinal
      ) {
        alert("Preencha pelo menos um filtro para realizar a busca!");
        return;
      }
      const inspecoes = await buscarInspecoes(filtros);
      exibirResultados(inspecoes);
    });
  }

  if (
    !document.querySelector("#tabelaResultados tbody tr") ||
    (document.querySelector("#tabelaResultados tbody tr td") &&
      document.querySelector("#tabelaResultados tbody tr td").colSpan === 8)
  ) {
    exibirResultados([]);
  }
});
