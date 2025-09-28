function tratarValor(valor) {
  return valor || "Não informado";
}

function formatarValoresConcatenados(valor) {
  if (!valor) return "Não informado";
  return valor
    .split(",")
    .map((item) => item.trim())
    .join(", ");
}

function formatarData(data, tipo = "completa", incluirHoras = false) {
  if (!data) return "Não informado";

  if (typeof data === "string" && data.match(/^\d{2}\/\d{2}\/\d{4}/)) {
    if (tipo === "ano" && data.length === 10) {
      return data.slice(6, 10);
    }
    if (
      (incluirHoras && data.length > 10) ||
      (!incluirHoras && data.length === 10)
    ) {
      return data;
    }
  }

  let dateStringParaConverter = String(data);
  if (dateStringParaConverter.match(/^\d{4}-\d{2}-\d{2}$/)) {
    dateStringParaConverter += "T00:00:00Z";
  } else if (dateStringParaConverter.match(/^\d{4}$/) && tipo === "ano") {
    return dateStringParaConverter;
  }

  const dateObj = new Date(dateStringParaConverter);
  if (isNaN(dateObj.getTime())) return "Data inválida";

  const dia = String(dateObj.getUTCDate()).padStart(2, "0");
  const mes = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
  const ano = dateObj.getUTCFullYear();

  if (tipo === "ano") {
    return ano;
  }

  let dataFormatada = `${dia}/${mes}/${ano}`;

  if (incluirHoras) {
    const horas = String(dateObj.getUTCHours()).padStart(2, "0");
    const minutos = String(dateObj.getUTCMinutes()).padStart(2, "0");
    dataFormatada += ` ${horas}:${minutos}`;
  }
  return dataFormatada;
}

async function carregarRelatorio() {
  const urlParams = new URLSearchParams(window.location.search);
  const checklistId = urlParams.get("id");
  const checklistIdSpan = document.getElementById("checklistId");
  const relatorioContent = document.getElementById("relatorioContent");

  if (!checklistId) {
    if (relatorioContent)
      relatorioContent.innerHTML = `<p class="erro">ID do checklist não fornecido na URL.</p>`;
    return;
  }
  if (checklistIdSpan)
    checklistIdSpan.textContent = `ID do Checklist: ${checklistId}`;
  if (!relatorioContent) {
    console.error("Elemento 'relatorioContent' não encontrado no DOM.");
    return;
  }

  relatorioContent.innerHTML = `<p style="text-align: center; padding: 30px; color: var(--sys-dark-gray); font-style: italic;"><i class="fas fa-spinner fa-spin"></i> Carregando dados do relatório...</p>`;

  try {
    const response = await fetch(
      `/api/checklist_transformadores_publico/${checklistId}`
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: `Erro HTTP: ${response.status}. Não foi possível obter detalhes do erro.`,
      }));
      throw new Error(
        errorData.message ||
          `Falha ao buscar dados do relatório: ${response.status}`
      );
    }
    const data = await response.json();

    let obsSecoes = {};
    if (data.observacoes_secoes) {
      try {
        obsSecoes = JSON.parse(data.observacoes_secoes);
      } catch (e) {
        console.error("Erro ao decodificar observacoes_secoes JSON:", e);
        obsSecoes = {};
      }
    }

    const criarObsHtml = (key) => {
      const obsTexto = obsSecoes[key];
      if (obsTexto && obsTexto.trim() !== "") {
        const textoFormatado = obsTexto
          .trim()
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br>");
        return `
          <div class="obs-secao">
            <i class="fas fa-comment-dots"></i>
            <p>${textoFormatado}</p>
          </div>
        `;
      }
      return "";
    };

    relatorioContent.innerHTML = `
        <div class="divisao">
          <h2>Informações Gerais do Checklist</h2>
          <div class="relatorio-grid">
            <div class="relatorio-item"><i class="fas fa-hashtag"></i><p><strong>Nº de Série do Transformador:</strong> ${tratarValor(
              data.numero_serie
            )}</p></div>
            <div class="relatorio-item"><i class="fas fa-calendar-alt"></i><p><strong>Ano de Fabricação do Trafo:</strong> ${tratarValor(
              data.data_fabricacao_formatada
            )}</p></div>
            <div class="relatorio-item ano-reforma"><i class="fas fa-calendar-alt"></i><p><strong>Ano da Reforma do Trafo:</strong> ${
              data.reformado === 1 ||
              data.reformado === true ||
              String(data.reformado).toLowerCase() === "true"
                ? tratarValor(data.data_reformado_formatada)
                : "Não Reformado"
            }</p></div>
            <div class="relatorio-item"><i class="fas fa-calendar-check"></i><p><strong>Data deste Formulário:</strong> ${tratarValor(
              data.data_formulario_completa
            )}</p></div>
            <div class="relatorio-item"><i class="fas fa-user"></i><p><strong>Responsável pelo Checklist:</strong> ${tratarValor(
              data.nome_responsavel
            )} (${tratarValor(data.matricula_responsavel)})</p></div>
            <div class="relatorio-item"><i class="fas fa-user-tie"></i><p><strong>Supervisor Técnico:</strong> ${tratarValor(
              data.nome_supervisor_fmt
            )} (${tratarValor(data.matricula_supervisor_fmt)})</p></div>
          </div>
        </div>
  
        <div class="divisao">
          <h2>Dados Cadastrais do Transformador</h2>
          <div class="relatorio-grid">
            <div class="relatorio-item"><i class="fas fa-industry"></i><p><strong>Marca:</strong> ${tratarValor(
              data.marca
            )}</p></div>
            <div class="relatorio-item"><i class="fas fa-bolt"></i><p><strong>Potência (kVA):</strong> ${tratarValor(
              data.potencia
            )}</p></div>
            <div class="relatorio-item"><i class="fas fa-bolt"></i><p><strong>Número de Fases:</strong> ${tratarValor(
              data.numero_fases
            )}</p></div>
            <div class="relatorio-item"><i class="fas fa-map-marker-alt"></i><p><strong>Local de Retirada:</strong> ${tratarValor(
              data.local_retirada
            )}</p></div>
            <div class="relatorio-item"><i class="fas fa-globe"></i><p><strong>Regional:</strong> ${tratarValor(
              data.regional
            )}</p></div>
            <div class="relatorio-item"><i class="fas fa-calendar-day"></i><p><strong>Data de Entrada no Almoxarifado:</strong> ${tratarValor(
              data.data_entrada_almoxarifado_formatada
            )}</p></div>
            <div class="relatorio-item"><i class="fas fa-file-invoice"></i><p><strong>Data Último Processamento de Remessa:</strong> ${tratarValor(
              data.data_processamento_remessa_formatada
            )}</p></div>
            <div class="relatorio-item"><i class="fas fa-exclamation-triangle"></i><p><strong>Motivo de Desativação (se aplicável):</strong> ${tratarValor(
              data.motivo_desativacao
            )}</p></div>
          </div>
        </div>
  
        <div class="divisao">
          <h2>Avaliação do Checklist</h2>
          <div class="checklist-grid">
            <div class="checklist-item">
                <i class="fas fa-box-open"></i>
                <p><strong>Detalhes do Tanque:</strong> ${formatarValoresConcatenados(
                  data.detalhes_tanque
                )}</p>
                ${criarObsHtml("tanque")}
            </div>
            <div class="checklist-item">
                <i class="fas fa-flask"></i>
                <p><strong>Corrosão do Tanque:</strong> ${tratarValor(
                  data.corrosao_tanque
                )}</p>
            </div>
            <div class="checklist-item">
                <i class="fas fa-oil-can"></i>
                <p><strong>Buchas Primárias:</strong> ${formatarValoresConcatenados(
                  data.buchas_primarias
                )}</p>
                ${criarObsHtml("buchas_primarias")}
            </div>
            <div class="checklist-item">
                <i class="fas fa-oil-can"></i>
                <p><strong>Buchas Secundárias:</strong> ${formatarValoresConcatenados(
                  data.buchas_secundarias
                )}</p>
                ${criarObsHtml("buchas_secundarias")}
            </div>
            <div class="checklist-item">
                <i class="fas fa-plug"></i>
                <p><strong>Conectores:</strong> ${formatarValoresConcatenados(
                  data.conectores
                )}</p>
                ${criarObsHtml("conectores")}
            </div>
            <div class="checklist-item">
                <i class="fas fa-wave-square"></i>
                <p><strong>Bobina I:</strong> ${tratarValor(
                  data.avaliacao_bobina_i
                )}</p>
                ${criarObsHtml("bobina_i")}
            </div>
            <div class="checklist-item">
                <i class="fas fa-wave-square"></i>
                <p><strong>Bobina II:</strong> ${tratarValor(
                  data.avaliacao_bobina_ii
                )}</p>
                ${criarObsHtml("bobina_ii")}
            </div>
            <div class="checklist-item">
                <i class="fas fa-wave-square"></i>
                <p><strong>Bobina III:</strong> ${tratarValor(
                  data.avaliacao_bobina_iii
                )}</p>
                ${criarObsHtml("bobina_iii")}
            </div>
          </div>
        </div>
        
        <div class="divisao">
          <h2>Conclusão e Destino</h2>
          <div class="relatorio-grid">
              <div class="checklist-item"><i class="fas fa-check-double"></i><p><strong>Conclusão Técnica:</strong> ${tratarValor(
                data.conclusao
              )}</p></div>
              <div class="checklist-item"><i class="fas fa-dolly"></i><p><strong>Transformador Destinado Para:</strong> ${tratarValor(
                data.transformador_destinado
              )}</p></div>
          </div>
        </div>
  
        ${
          data.observacoes
            ? `
          <div class="divisao">
            <h2>Observações Gerais</h2>
            <div class="relatorio-item observacoes-item">
              <i class="fas fa-comment-dots"></i>
              <p>${data.observacoes}</p>
            </div>
          </div>
        `
            : ""
        }
      `;
  } catch (error) {
    console.error("Erro ao carregar relatório:", error);
    if (relatorioContent) {
      relatorioContent.innerHTML = `<p class="erro">Erro ao carregar o relatório: ${error.message}. Verifique o ID ou tente novamente mais tarde.</p>`;
    }
  }
}

function gerarPDF() {
  const urlParams = new URLSearchParams(window.location.search);
  const checklistId = urlParams.get("id");
  if (checklistId) {
    const noPrintElements = document.querySelectorAll(".no-print");
    noPrintElements.forEach((button) => {
      button.style.display = "none";
    });
    window.location.href = `/api/gerar_pdf/${checklistId}`;
    setTimeout(() => {
      noPrintElements.forEach((button) => {
        button.style.display = "inline-block";
      });
    }, 3000);
  } else {
    alert("ID do checklist não encontrado na URL para gerar PDF!");
  }
}

document.addEventListener("DOMContentLoaded", carregarRelatorio);
