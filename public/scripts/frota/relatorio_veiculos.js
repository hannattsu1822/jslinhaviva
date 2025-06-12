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

function getIcon(status) {
  if (status === 1) {
    return '<i class="fas fa-check-circle icon-ok"></i>';
  } else if (status === 0) {
    return '<i class="fas fa-times-circle icon-not-ok"></i>';
  } else {
    return '<i class="fas fa-question-circle icon-unknown"></i>';
  }
}

function getStatusText(status) {
  if (status === 1) {
    return "Conforme";
  } else if (status === 0) {
    return "Não Conforme";
  } else {
    return "Não Informado";
  }
}

async function carregarRelatorio() {
  const urlParams = new URLSearchParams(window.location.search);
  const inspecaoId = urlParams.get("id");
  const inspecaoIdSpan = document.getElementById("inspecaoId");
  const relatorioContent = document.getElementById("relatorioContent");

  if (!inspecaoId) {
    if (relatorioContent)
      relatorioContent.innerHTML = `<p class="erro" style="color: var(--sys-color-error, red); text-align:center;">ID da inspeção não fornecido.</p>`;
    return;
  }

  if (inspecaoIdSpan) {
    inspecaoIdSpan.textContent = inspecaoId;
  }

  if (!relatorioContent) {
    return;
  }
  relatorioContent.innerHTML = `<p style="text-align:center; padding: 20px; color: var(--sys-color-text-secondary);">Carregando dados do relatório...</p>`;

  try {
    const response = await fetch(`/api/inspecoes_publico/${inspecaoId}`);
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

    const camposExcluidos = [
      "id",
      "matricula",
      "placa",
      "data_inspecao",
      "km_atual",
      "horimetro",
      "observacoes",
    ];

    let dataInspecaoFormatada = "N/A";
    if (data.data_inspecao) {
      const dataObj = new Date(data.data_inspecao);
      if (!isNaN(dataObj.getTime())) {
        dataInspecaoFormatada = dataObj.toLocaleDateString("pt-BR", {
          timeZone: "UTC",
        });
      }
    }

    relatorioContent.innerHTML = `
      <div class="divisao">
        <h2>Informações Gerais</h2>
        <div class="relatorio-grid">
          <div class="relatorio-item">
            <i class="fas fa-car"></i>
            <p><strong>Placa:</strong> ${data.placa || "N/A"}</p>
          </div>
          <div class="relatorio-item">
            <i class="fas fa-id-card"></i>
            <p><strong>Matrícula do Responsável:</strong> ${
              data.matricula || "N/A"
            }</p>
          </div>
          <div class="relatorio-item">
            <i class="fas fa-calendar-alt"></i>
            <p><strong>Data da Inspeção:</strong> ${dataInspecaoFormatada}</p>
          </div>
          <div class="relatorio-item">
            <i class="fas fa-tachometer-alt"></i>
            <p><strong>KM Atual:</strong> ${data.km_atual || "N/A"}</p>
          </div>
          <div class="relatorio-item">
            <i class="fas fa-clock"></i>
            <p><strong>Horímetro:</strong> ${data.horimetro || "N/A"}</p>
          </div>
        </div>
      </div>

      <div class="divisao">
        <h2>Itens de Inspeção do Veículo</h2>
        <div class="relatorio-grid checklist-items-grid">
          ${Object.keys(data)
            .filter(
              (key) =>
                !camposExcluidos.includes(key) &&
                mapeamentoNomes[key] &&
                ![
                  // Excluir campos específicos do Sky/Cesto desta seção
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
                ].includes(key)
            )
            .map(
              (key) => `
              <div class="relatorio-item">
                ${getIcon(data[key])}
                <p><strong>${
                  mapeamentoNomes[key] ||
                  key
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase())
                }:</strong> ${getStatusText(data[key])}</p>
              </div>`
            )
            .join("")}
        </div>
      </div>
      
      <div class="divisao">
        <h2>Itens de Inspeção do Sky/Cesto Aéreo</h2>
        <div class="relatorio-grid checklist-items-grid">
          ${Object.keys(data)
            .filter(
              (key) =>
                !camposExcluidos.includes(key) &&
                mapeamentoNomes[key] &&
                [
                  // Incluir apenas campos específicos do Sky/Cesto nesta seção
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
                ].includes(key)
            )
            .map(
              (key) => `
              <div class="relatorio-item">
                ${getIcon(data[key])}
                <p><strong>${
                  mapeamentoNomes[key] ||
                  key
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase())
                }:</strong> ${getStatusText(data[key])}</p>
              </div>`
            )
            .join("")}
        </div>
      </div>

      ${
        data.observacoes
          ? `
        <div class="divisao">
          <h2>Observações</h2>
          <div class="relatorio-item observacoes-item">
            <p>${data.observacoes}</p>
          </div>
        </div>
      `
          : ""
      }
    `;
  } catch (error) {
    console.error("Erro ao carregar relatório:", error);
    if (relatorioContent)
      relatorioContent.innerHTML = `<p class="erro" style="color: var(--sys-color-error, red); text-align:center;">Erro ao carregar o relatório: ${error.message}. Verifique o ID ou tente novamente mais tarde.</p>`;
  }
}

window.gerarPDF = function () {
  const urlParams = new URLSearchParams(window.location.search);
  const inspecaoId = urlParams.get("id");

  if (!inspecaoId) {
    alert("ID da inspeção não encontrado!");
    return;
  }

  const noPrintElements = document.querySelectorAll(".no-print");
  noPrintElements.forEach((el) => (el.style.display = "none"));

  window.location.href = `/api/gerar_pdf_veiculos/${inspecaoId}`;

  setTimeout(() => {
    noPrintElements.forEach((el) => (el.style.display = "")); // Restaurar para o display original
  }, 3000); // Ajuste o tempo se necessário
};

document.addEventListener("DOMContentLoaded", carregarRelatorio);
