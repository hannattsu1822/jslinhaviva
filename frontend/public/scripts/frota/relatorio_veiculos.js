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
        <td>${mapeamentoNomes[key]}</td>
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

    const responsavel = data.responsavel_nome
      ? `${data.responsavel_nome} (${data.matricula || "N/A"})`
      : data.matricula || "N/A";
    const docCode = `LV-FRT-${String(data.placa || data.id)
      .replace(/\s+/g, "")
      .replace(/[^a-zA-Z0-9\-]/g, "")}`;
    const emissao = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Maceio",
    });

    relatorioContent.innerHTML = safeHtml`
      <table class="rt-doc-control" aria-label="Controle documental">
        <tr>
          <td><span>Documento</span><strong>${docCode}</strong></td>
          <td><span>Revisão</span><strong>00</strong></td>
          <td><span>Data</span><strong>${formatarData(data.data_inspecao)}</strong></td>
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
          <strong>Inspeção:</strong> INS-${inspecaoId}<br />
          <strong>Emissão:</strong> ${emissao}<br />
          <strong>Responsável:</strong> ${responsavel}
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
                <span class="lv-info-item__value">${inspecaoId}</span>
              </div>
              <div class="lv-info-item">
                <span class="lv-info-item__label">Placa</span>
                <span class="lv-info-item__value">${data.placa || "N/A"}</span>
              </div>
              <div class="lv-info-item">
                <span class="lv-info-item__label">Data da Inspeção</span>
                <span class="lv-info-item__value">${formatarData(data.data_inspecao)}</span>
              </div>
              <div class="lv-info-item">
                <span class="lv-info-item__label">KM Atual</span>
                <span class="lv-info-item__value">${data.km_atual ?? "N/A"}</span>
              </div>
              <div class="lv-info-item">
                <span class="lv-info-item__label">Horímetro</span>
                <span class="lv-info-item__value">${data.horimetro ?? "N/A"}</span>
              </div>
              <div class="lv-info-item lv-info-item--full">
                <span class="lv-info-item__label">Responsável</span>
                <span class="lv-info-item__value">${responsavel}</span>
              </div>
            </div>
          </div>
        </section>

        <div class="lv-landscape-split">
          <section class="lv-section rt-section">
            <h2 class="rt-section__heading">
              <span class="rt-section__num">2</span> Itens do Veículo
            </h2>
            <div class="lv-section__body">${rawHtml(buildChecklistTable(data, false))}</div>
          </section>

          <section class="lv-section rt-section">
            <h2 class="rt-section__heading">
              <span class="rt-section__num">3</span> Itens Sky / Cesto Aéreo
            </h2>
            <div class="lv-section__body">${rawHtml(buildChecklistTable(data, true))}</div>
          </section>
        </div>

        <section class="lv-section rt-section">
          <h2 class="rt-section__heading">
            <span class="rt-section__num">4</span> Observações
          </h2>
          <div class="lv-section__body">
            <div class="lv-text-block">${data.observacoes || "Nenhuma observação registrada."}</div>
          </div>
        </section>
      </main>
    `;
  } catch (error) {
    console.error("Erro ao carregar relatório:", error);
    if (relatorioContent) {
      relatorioContent.innerHTML = safeHtml`<p class="lv-empty" style="color:#dc2626;text-align:center;">Erro ao carregar o relatório: ${error.message}</p>`;
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
