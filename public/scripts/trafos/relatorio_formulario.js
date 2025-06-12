// public/scripts/trafos/relatorio_formulario.js

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

function formatarData(data, tipo = "completa") {
  if (!data) return "Não informado";

  if (/^\d{4}$/.test(data)) {
    return data;
  }

  const date = new Date(data);
  if (isNaN(date.getTime())) return "Data inválida";

  const dia = String(date.getUTCDate()).padStart(2, "0");
  const mes = String(date.getUTCMonth() + 1).padStart(2, "0");
  const ano = date.getUTCFullYear();

  if (tipo === "ano") {
    return ano;
  }
  return `${dia}/${mes}/${ano}`;
}

async function carregarRelatorio() {
  const urlParams = new URLSearchParams(window.location.search);
  const checklistId = urlParams.get("id");
  const checklistIdSpan = document.getElementById("checklistId");
  const relatorioContent = document.getElementById("relatorioContent");

  if (!checklistId) {
    alert("ID do checklist não encontrado na URL!");
    if (relatorioContent)
      relatorioContent.innerHTML = `<p class="erro">ID do checklist não fornecido.</p>`;
    return;
  }

  if (checklistIdSpan) {
    checklistIdSpan.textContent = `ID: ${checklistId}`;
  }

  if (!relatorioContent) {
    console.error("Elemento 'relatorioContent' não encontrado.");
    return;
  }

  try {
    const response = await fetch(
      `/api/checklist_transformadores_publico/${checklistId}`
    );
    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: `Erro HTTP: ${response.status}` }));
      throw new Error(
        errorData.message ||
          `Erro ao buscar dados do relatório: ${response.status}`
      );
    }
    const data = await response.json();

    relatorioContent.innerHTML = `
        <div class="divisao">
          <h2>Informações Gerais</h2>
          <div class="relatorio-grid">
            <div class="relatorio-item">
              <i class="fas fa-hashtag"></i>
              <p><strong>Número de Série:</strong> ${tratarValor(
                data.numero_serie
              )}</p>
            </div>
            <div class="relatorio-item">
              <i class="fas fa-calendar-alt"></i>
              <p><strong>Ano de Fabricação:</strong> ${formatarData(
                data.data_fabricacao,
                "ano"
              )}</p>
            </div>
            <div class="relatorio-item ano-reforma">
              <i class="fas fa-calendar-alt"></i>
              <p><strong>Ano da Reforma:</strong> ${
                data.reformado === "true" || data.reformado === true
                  ? formatarData(data.data_reformado, "ano")
                  : "Não Reformado"
              }</p>
            </div>
            <div class="relatorio-item">
              <i class="fas fa-calendar-check"></i>
              <p><strong>Data do Formulário:</strong> ${formatarData(
                data.data_checklist,
                "completa"
              )}</p>
            </div>
            <div class="relatorio-item">
              <i class="fas fa-user"></i>
              <p><strong>Responsável:</strong> ${tratarValor(
                data.nome_responsavel
              )} (${tratarValor(data.matricula_responsavel)})</p>
            </div>
            <div class="relatorio-item">
              <i class="fas fa-user-tie"></i>
              <p><strong>Supervisor:</strong> ${tratarValor(
                data.nome_supervisor
              )} (${tratarValor(data.matricula_supervisor)})</p>
            </div>
          </div>
        </div>
  
        <div class="divisao">
          <h2>Dados do Transformador</h2>
          <div class="relatorio-grid">
            <div class="relatorio-item">
              <i class="fas fa-map-marker-alt"></i>
              <p><strong>Local de Retirada:</strong> ${tratarValor(
                data.local_retirada
              )}</p>
            </div>
            <div class="relatorio-item">
              <i class="fas fa-bolt"></i>
              <p><strong>Número de Fases:</strong> ${tratarValor(
                data.numero_fases
              )}</p>
            </div>
            <div class="relatorio-item">
              <i class="fas fa-bolt"></i>
              <p><strong>Potência (kVA):</strong> ${tratarValor(
                data.potencia
              )}</p>
            </div>
            <div class="relatorio-item">
              <i class="fas fa-industry"></i>
              <p><strong>Marca:</strong> ${tratarValor(data.marca)}</p>
            </div>
            <div class="relatorio-item">
              <i class="fas fa-globe"></i>
              <p><strong>Regional:</strong> ${tratarValor(data.regional)}</p>
            </div>
            <div class="relatorio-item">
              <i class="fas fa-exclamation-triangle"></i>
              <p><strong>Motivo de Desativação:</strong> ${tratarValor(
                data.motivo_desativacao
              )}</p>
            </div>
            <div class="relatorio-item">
              <i class="fas fa-calendar-day"></i>
              <p><strong>Data de Entrada no Almoxarifado:</strong> ${formatarData(
                data.data_entrada_almoxarifado,
                "completa"
              )}</p>
            </div>
          </div>
        </div>
  
        <div class="divisao">
          <h2>Checklist Visual e Elétrico</h2>
          <div class="checklist-grid">
            <div class="checklist-item">
              <i class="fas fa-box-open"></i>
              <p><strong>Detalhes do Tanque:</strong> ${formatarValoresConcatenados(
                data.detalhes_tanque
              )}</p>
            </div>
            <div class="checklist-item">
              <i class="fas fa-flask"></i>
              <p><strong>Corrosão do Tanque:</strong> ${tratarValor(
                data.corrosao_tanque
              )}</p>
            </div>
            <div class="checklist-item">
              <i class="fas fa-plug"></i>
              <p><strong>Conectores:</strong> ${formatarValoresConcatenados(
                data.conectores
              )}</p>
            </div>
            <div class="checklist-item">
              <i class="fas fa-oil-can"></i>
              <p><strong>Buchas Primárias:</strong> ${formatarValoresConcatenados(
                data.buchas_primarias
              )}</p>
            </div>
            <div class="checklist-item">
              <i class="fas fa-oil-can"></i>
              <p><strong>Buchas Secundárias:</strong> ${formatarValoresConcatenados(
                data.buchas_secundarias
              )}</p>
            </div>
            <div class="checklist-item">
              <i class="fas fa-wave-square"></i>
              <p><strong>Bobina 1:</strong> ${tratarValor(
                data.avaliacao_bobina_i
              )}</p>
            </div>
            <div class="checklist-item">
              <i class="fas fa-wave-square"></i>
              <p><strong>Bobina 2:</strong> ${tratarValor(
                data.avaliacao_bobina_ii
              )}</p>
            </div>
            <div class="checklist-item">
              <i class="fas fa-wave-square"></i>
              <p><strong>Bobina 3:</strong> ${tratarValor(
                data.avaliacao_bobina_iii
              )}</p>
            </div>
          </div>
        </div>
        
        <div class="divisao">
          <h2>Conclusão e Destino</h2>
          <div class="relatorio-grid">
              <div class="checklist-item">
                  <i class="fas fa-check-double"></i>
                  <p><strong>Conclusão Técnica:</strong> ${tratarValor(
                    data.conclusao
                  )}</p>
              </div>
              <div class="checklist-item">
                  <i class="fas fa-dolly"></i>
                  <p><strong>Transformador Destinado:</strong> ${tratarValor(
                    data.transformador_destinado
                  )}</p>
              </div>
          </div>
        </div>
  
        ${
          data.observacoes
            ? `
          <div class="divisao">
            <h2>Observações</h2>
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

// A função gerarPDF é chamada pelo onclick no HTML, então precisa ser global.
// eslint-disable-next-line no-unused-vars
function gerarPDF() {
  const urlParams = new URLSearchParams(window.location.search);
  const checklistId = urlParams.get("id");

  if (checklistId) {
    const noPrintElements = document.querySelectorAll(".no-print");
    noPrintElements.forEach((button) => {
      button.style.display = "none";
    });

    // Redireciona para a rota da API que gera e serve o PDF
    window.location.href = `/api/gerar_pdf/${checklistId}`;

    // Idealmente, o servidor forçaria o download.
    // Reexibir os botões pode não ser ideal se a navegação ocorrer.
    // Considerar uma abordagem onde o PDF abre em nova aba ou é baixado
    // sem que a página atual mude ou precise reexibir botões.
    // Por ora, mantendo a lógica original:
    setTimeout(() => {
      noPrintElements.forEach((button) => {
        button.style.display = "inline-block"; // ou o display original
      });
    }, 2000); // Aumentado o tempo, mas ainda não ideal
  } else {
    alert("ID do checklist não encontrado!");
  }
}

// Carrega o relatório quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", carregarRelatorio);
