// public/scripts/frota/relatorio_veiculos.js

const mapeamentoNomes = {
  buzina: "Buzina",
  cinto_seguranca: "Cinto de Segurança",
  quebra_sol: "Quebra-sol",
  retrovisor_inteiro: "Retrovisor Inteiro",
  retrovisor_direito_esquerdo: "Retrovisor Direito/Esquerdo",
  limpador_para_brisa: "Limpador de Para-brisa",
  farol_baixa: "Farol de Baixa",
  farol_alto: "Farol de Alta",
  meia_luz: "Meia-luz",
  luz_freio: "Luz de Freio",
  luz_re: "Luz de Ré",
  bateria: "Bateria",
  luzes_painel: "Luzes do Painel",
  seta_direita_esquerdo: "Seta Direita/Esquerda",
  pisca_alerta: "Pisca-alerta",
  luz_interna: "Luz Interna",
  velocimetro_tacografo: "Velocímetro/Tacógrafo",
  freios: "Freios",
  macaco: "Macaco",
  chave_roda: "Chave de Roda",
  triangulo_sinalizacao: "Triângulo de Sinalização",
  extintor_incendio: "Extintor de Incêndio",
  portas_travas: "Portas e Travas",
  sirene: "Sirene",
  fechamento_janelas: "Fechamento de Janelas",
  para_brisa: "Para-brisa",
  oleo_motor: "Óleo do Motor",
  oleo_freio: "Óleo de Freio",
  nivel_agua_radiador: "Nível de Água do Radiador",
  pneus_estado_calibragem: "Pneus (Estado e Calibragem)",
  pneu_reserva_estepe: "Pneu Reserva/Estepe",
  bancos_encosto_assentos: "Bancos e Encostos",
  para_choque_dianteiro: "Para-choque Dianteiro",
  para_choque_traseiro: "Para-choque Traseiro",
  lataria: "Lataria",
  estado_fisico_sky: "Estado Físico do Sky",
  funcionamento_sky: "Funcionamento do Sky",
  sapatas: "Sapatas",
  cestos: "Cestos",
  comandos: "Comandos",
  lubrificacao: "Lubrificação",
  ensaio_eletrico: "Ensaio Elétrico",
  cilindros: "Cilindros",
  gavetas: "Gavetas",
  capas: "Capas",
  nivel_oleo_sky: "Nível de Óleo do Sky",
};

const camposSky = [
  "estado_fisico_sky",
  "funcionamento_sky",
  "sapatas",
  "cestos",
  "comandos",
  "lubrificacao",
  "ensaio_eletrico",
  "cilindros",
  "gavetas",
  "capas",
  "nivel_oleo_sky",
];

const camposExcluidos = [
  "id",
  "matricula",
  "placa",
  "data_inspecao",
  "km_atual",
  "horimetro",
  "observacoes",
  "responsavel_nome",
];

function esc(value) {
  if (typeof window.escapeHtml === "function") {
    return window.escapeHtml(value);
  }
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getStatusBadgeHtml(status) {
  const num = status === null || status === undefined ? null : Number(status);
  if (num === 1) {
    return '<span class="lv-badge lv-badge--success">Conforme</span>';
  }
  if (num === 0) {
    return '<span class="lv-badge lv-badge--error">Não Conforme</span>';
  }
  return '<span class="lv-badge lv-badge--warning">Não Informado</span>';
}

function buildChecklistTable(data, skyOnly) {
  const rows = Object.keys(data)
    .filter(
      (key) =>
        !camposExcluidos.includes(key) &&
        mapeamentoNomes[key] &&
        (skyOnly ? camposSky.includes(key) : !camposSky.includes(key))
    )
    .map(
      (key) => `
      <tr>
        <td>${esc(mapeamentoNomes[key])}</td>
        <td style="text-align:center;">${getStatusBadgeHtml(data[key])}</td>
      </tr>`
    )
    .join("");

  if (!rows) {
    return '<p class="lv-empty">Nenhum item registrado.</p>';
  }

  return `
    <table class="lv-table">
      <thead>
        <tr>
          <th>Item</th>
          <th style="width:140px;text-align:center;">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function formatarData(dataStr) {
  if (!dataStr) return "N/A";
  const dataObj = new Date(dataStr);
  if (isNaN(dataObj.getTime())) return "N/A";
  return dataObj.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function montarRelatorioHtml(data, inspecaoId) {
  const responsavel = data.responsavel_nome
    ? `${data.responsavel_nome} (${data.matricula || "N/A"})`
    : data.matricula || "N/A";
  const docCode = `LV-FRT-${String(data.placa || data.id)
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9\-]/g, "")}`;
  const emissao = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Maceio",
  });
  const checklistVeiculo = buildChecklistTable(data, false);
  const checklistSky = buildChecklistTable(data, true);

  return `
    <table class="rt-doc-control" aria-label="Controle documental">
      <tr>
        <td><span>Documento</span><strong>${esc(docCode)}</strong></td>
        <td><span>Revisão</span><strong>00</strong></td>
        <td><span>Data</span><strong>${esc(formatarData(data.data_inspecao))}</strong></td>
        <td><span>Classificação</span><strong>Uso Interno</strong></td>
      </tr>
    </table>

    <header class="rt-cover">
      <div class="rt-cover__brand">
        <img class="rt-cover__logo" src="/static/images/brand/sulgipe-logo.png" alt="SULGIPE" />
        <p class="rt-cover__company">SULGIPE</p>
      </div>
      <div class="rt-cover__center">
        <p class="rt-cover__kind">Relatório Técnico</p>
        <h1 class="rt-cover__title">Relatório Técnico de Inspeção Veicular</h1>
        <p class="rt-cover__module">Frota · Checklist Veicular</p>
      </div>
      <div class="rt-cover__meta">
        <strong>Inspeção:</strong> INS-${esc(inspecaoId)}<br />
        <strong>Emissão:</strong> ${esc(emissao)}<br />
        <strong>Responsável:</strong> ${esc(responsavel)}
      </div>
    </header>

    <main class="lv-report-main">
      <section class="lv-section rt-section">
        <h2 class="rt-section__heading">
          <span class="rt-section__num">1</span> Identificação da Inspeção
        </h2>
        <div class="lv-section__body">
          <div class="lv-info-grid lv-info-grid--4col">
            <div class="lv-info-item">
              <span class="lv-info-item__label">Nº da Inspeção</span>
              <span class="lv-info-item__value">${esc(inspecaoId)}</span>
            </div>
            <div class="lv-info-item">
              <span class="lv-info-item__label">Placa</span>
              <span class="lv-info-item__value">${esc(data.placa || "N/A")}</span>
            </div>
            <div class="lv-info-item">
              <span class="lv-info-item__label">Data da Inspeção</span>
              <span class="lv-info-item__value">${esc(formatarData(data.data_inspecao))}</span>
            </div>
            <div class="lv-info-item">
              <span class="lv-info-item__label">KM Atual</span>
              <span class="lv-info-item__value">${esc(data.km_atual ?? "N/A")}</span>
            </div>
            <div class="lv-info-item">
              <span class="lv-info-item__label">Horímetro</span>
              <span class="lv-info-item__value">${esc(data.horimetro ?? "N/A")}</span>
            </div>
            <div class="lv-info-item lv-info-item--full">
              <span class="lv-info-item__label">Responsável</span>
              <span class="lv-info-item__value">${esc(responsavel)}</span>
            </div>
          </div>
        </div>
      </section>

      <div class="lv-landscape-split">
        <section class="lv-section rt-section">
          <h2 class="rt-section__heading">
            <span class="rt-section__num">2</span> Itens do Veículo
          </h2>
          <div class="lv-section__body">${checklistVeiculo}</div>
        </section>

        <section class="lv-section rt-section">
          <h2 class="rt-section__heading">
            <span class="rt-section__num">3</span> Itens Sky / Cesto Aéreo
          </h2>
          <div class="lv-section__body">${checklistSky}</div>
        </section>
      </div>

      <section class="lv-section rt-section">
        <h2 class="rt-section__heading">
          <span class="rt-section__num">4</span> Observações
        </h2>
        <div class="lv-section__body">
          <div class="lv-text-block">${esc(data.observacoes || "Nenhuma observação registrada.")}</div>
        </div>
      </section>
    </main>`;
}

async function carregarRelatorio() {
  const urlParams = new URLSearchParams(window.location.search);
  const inspecaoId = urlParams.get("id");
  const reportToken = urlParams.get("token");
  const relatorioContent = document.getElementById("relatorioContent");

  if (!inspecaoId) {
    if (relatorioContent) {
      relatorioContent.innerHTML =
        '<p class="lv-empty" style="color:#dc2626;text-align:center;">ID da inspeção não fornecido.</p>';
    }
    return;
  }

  if (!relatorioContent) return;

  relatorioContent.innerHTML =
    '<p class="lv-empty" style="text-align:center;padding:24px;">Carregando dados do relatório...</p>';

  try {
    const response = reportToken
      ? await fetch(
          `/api/inspecoes_publico/${inspecaoId}?token=${encodeURIComponent(reportToken)}`,
          { credentials: "same-origin" }
        )
      : await fetch(`/api/inspecoes/${inspecaoId}`, {
          credentials: "same-origin",
        });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: `Erro HTTP: ${response.status}` }));
      throw new Error(
        errorData.message || "Erro ao carregar dados da inspeção"
      );
    }

    const data = await response.json();
    if (!data) {
      throw new Error("Dados da inspeção não encontrados ou formato inválido.");
    }

    relatorioContent.innerHTML = montarRelatorioHtml(data, inspecaoId);
  } catch (error) {
    console.error("Erro ao carregar relatório:", error);
    if (relatorioContent) {
      relatorioContent.innerHTML = `<p class="lv-empty" style="color:#dc2626;text-align:center;">Erro ao carregar o relatório: ${esc(error.message)}</p>`;
    }
  }
}

window.gerarPDF = function () {
  const urlParams = new URLSearchParams(window.location.search);
  const inspecaoId = urlParams.get("id");

  if (!inspecaoId) {
    alert("ID da inspeção não encontrado!");
    return;
  }

  window.location.href = `/api/gerar_pdf_veiculos/${inspecaoId}`;
};

document.addEventListener("DOMContentLoaded", carregarRelatorio);
