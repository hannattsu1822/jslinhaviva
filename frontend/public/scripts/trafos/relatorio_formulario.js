// public/scripts/trafos/relatorio_formulario.js

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

function tratarValor(valor) {
  return valor || "Não informado";
}

function formatarValoresConcatenados(valor) {
  if (!valor) return "Não informado";
  return String(valor)
    .split(",")
    .map((item) => item.trim())
    .join(", ");
}

function parseObservacoesSecoes(data) {
  if (!data?.observacoes_secoes) return {};
  try {
    return typeof data.observacoes_secoes === "string"
      ? JSON.parse(data.observacoes_secoes)
      : data.observacoes_secoes;
  } catch {
    return {};
  }
}

function isReformado(data) {
  return (
    data.reformado === 1 ||
    data.reformado === true ||
    String(data.reformado).toLowerCase() === "true"
  );
}

function extrairItensAvaliacao(data, obsSecoes) {
  return [
    {
      label: "Detalhes do Tanque",
      value: formatarValoresConcatenados(data.detalhes_tanque),
      observacao: obsSecoes.tanque,
    },
    {
      label: "Corrosão do Tanque",
      value: data.corrosao_tanque || "N/A",
    },
    {
      label: "Buchas Primárias",
      value: formatarValoresConcatenados(data.buchas_primarias),
      observacao: obsSecoes.buchas_primarias,
    },
    {
      label: "Buchas Secundárias",
      value: formatarValoresConcatenados(data.buchas_secundarias),
      observacao: obsSecoes.buchas_secundarias,
    },
    {
      label: "Conectores",
      value: formatarValoresConcatenados(data.conectores),
      observacao: obsSecoes.conectores,
    },
    {
      label: "Bobina I",
      value: data.avaliacao_bobina_i || "N/A",
      observacao: obsSecoes.bobina_i,
    },
    {
      label: "Bobina II",
      value: data.avaliacao_bobina_ii || "N/A",
      observacao: obsSecoes.bobina_ii,
    },
    {
      label: "Bobina III",
      value: data.avaliacao_bobina_iii || "N/A",
      observacao: obsSecoes.bobina_iii,
    },
  ];
}

function buildKeyValueTable(items, dualColumn = true) {
  function singleTable(slice) {
    const rows = slice
      .map(
        (item) => `
      <tr>
        <td class="lv-table__item-col">${esc(item.label)}</td>
        <td class="lv-table__value-col">${esc(item.value)}</td>
        <td class="lv-table__obs-col">${item.observacao ? esc(item.observacao) : "—"}</td>
      </tr>`
      )
      .join("");

    return `
      <table class="lv-table lv-table--checklist lv-table--keyvalue">
        <thead>
          <tr>
            <th class="lv-table__item-col">Item</th>
            <th class="lv-table__value-col">Avaliação</th>
            <th class="lv-table__obs-col">Observações</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  if (!items.length) {
    return '<p class="lv-empty">Nenhum item registrado.</p>';
  }

  if (dualColumn && items.length >= 6) {
    const mid = Math.ceil(items.length / 2);
    return `<div class="lv-checklist-dual">
      ${singleTable(items.slice(0, mid))}
      ${singleTable(items.slice(mid))}
    </div>`;
  }

  return singleTable(items);
}

function montarRelatorioHtml(data, checklistId) {
  const obsSecoes = parseObservacoesSecoes(data);
  const responsavel = `${tratarValor(data.nome_responsavel)} (${tratarValor(data.matricula_responsavel)})`;
  const supervisor = `${tratarValor(data.nome_supervisor_fmt)} (${tratarValor(data.matricula_supervisor_fmt)})`;
  const anoReforma = isReformado(data)
    ? tratarValor(data.data_reformado_formatada)
    : "Não Reformado";
  const numeroSerie = data.numero_serie || data.serie_transformador_ref || "N/A";
  const docCode = `LV-TRF-${String(numeroSerie).replace(/\s+/g, "").replace(/[^a-zA-Z0-9\-]/g, "")}`;
  const emissao = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Maceio",
  });
  const avaliacaoTable = buildKeyValueTable(
    extrairItensAvaliacao(data, obsSecoes),
    true
  );

  return `
    <table class="rt-doc-control" aria-label="Controle documental">
      <tr>
        <td><span>Documento</span><strong>${esc(docCode)}</strong></td>
        <td><span>Revisão</span><strong>00</strong></td>
        <td><span>Data</span><strong>${esc(tratarValor(data.data_formulario_completa))}</strong></td>
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
        <h1 class="rt-cover__title">Relatório Técnico de Inspeção de Transformador</h1>
        <p class="rt-cover__module">Transformadores · Checklist</p>
      </div>
      <div class="rt-cover__meta">
        <strong>Checklist:</strong> CHK-${esc(checklistId)}<br />
        <strong>Emissão:</strong> ${esc(emissao)}<br />
        <strong>Responsável:</strong> ${esc(responsavel)}
      </div>
    </header>

    <main class="lv-report-main">
      <section class="lv-section rt-section">
        <h2 class="rt-section__heading">
          <span class="rt-section__num">1</span> Identificação do Checklist
        </h2>
        <div class="lv-section__body">
          <div class="lv-info-grid lv-info-grid--4col">
            <div class="lv-info-item">
              <span class="lv-info-item__label">ID do Checklist</span>
              <span class="lv-info-item__value">${esc(checklistId)}</span>
            </div>
            <div class="lv-info-item">
              <span class="lv-info-item__label">Nº de Série</span>
              <span class="lv-info-item__value">${esc(numeroSerie)}</span>
            </div>
            <div class="lv-info-item">
              <span class="lv-info-item__label">Ano de Fabricação</span>
              <span class="lv-info-item__value">${esc(tratarValor(data.data_fabricacao_formatada))}</span>
            </div>
            <div class="lv-info-item">
              <span class="lv-info-item__label">Ano da Reforma</span>
              <span class="lv-info-item__value">${esc(anoReforma)}</span>
            </div>
            <div class="lv-info-item">
              <span class="lv-info-item__label">Data do Formulário</span>
              <span class="lv-info-item__value">${esc(tratarValor(data.data_formulario_completa))}</span>
            </div>
            <div class="lv-info-item">
              <span class="lv-info-item__label">Responsável</span>
              <span class="lv-info-item__value">${esc(responsavel)}</span>
            </div>
            <div class="lv-info-item lv-info-item--full">
              <span class="lv-info-item__label">Supervisor Técnico</span>
              <span class="lv-info-item__value">${esc(supervisor)}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="lv-section rt-section">
        <h2 class="rt-section__heading">
          <span class="rt-section__num">2</span> Dados Cadastrais do Transformador
        </h2>
        <div class="lv-section__body">
          <div class="lv-info-grid lv-info-grid--4col">
            <div class="lv-info-item">
              <span class="lv-info-item__label">Marca</span>
              <span class="lv-info-item__value">${esc(tratarValor(data.marca))}</span>
            </div>
            <div class="lv-info-item">
              <span class="lv-info-item__label">Potência (kVA)</span>
              <span class="lv-info-item__value">${esc(tratarValor(data.potencia))}</span>
            </div>
            <div class="lv-info-item">
              <span class="lv-info-item__label">Número de Fases</span>
              <span class="lv-info-item__value">${esc(tratarValor(data.numero_fases))}</span>
            </div>
            <div class="lv-info-item">
              <span class="lv-info-item__label">Local de Retirada</span>
              <span class="lv-info-item__value">${esc(tratarValor(data.local_retirada))}</span>
            </div>
            <div class="lv-info-item">
              <span class="lv-info-item__label">Regional</span>
              <span class="lv-info-item__value">${esc(tratarValor(data.regional))}</span>
            </div>
            <div class="lv-info-item">
              <span class="lv-info-item__label">Entrada no Almoxarifado</span>
              <span class="lv-info-item__value">${esc(tratarValor(data.data_entrada_almoxarifado_formatada))}</span>
            </div>
            <div class="lv-info-item">
              <span class="lv-info-item__label">Último Proc. Remessa</span>
              <span class="lv-info-item__value">${esc(tratarValor(data.data_processamento_remessa_formatada))}</span>
            </div>
            <div class="lv-info-item lv-info-item--full">
              <span class="lv-info-item__label">Motivo de Desativação</span>
              <span class="lv-info-item__value">${esc(tratarValor(data.motivo_desativacao))}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="lv-section rt-section">
        <h2 class="rt-section__heading">
          <span class="rt-section__num">3</span> Avaliação Técnica
        </h2>
        <div class="lv-section__body">${avaliacaoTable}</div>
      </section>

      <section class="lv-section rt-section">
        <h2 class="rt-section__heading">
          <span class="rt-section__num">4</span> Conclusão e Destino
        </h2>
        <div class="lv-section__body">
          <div class="lv-info-grid lv-info-grid--2col">
            <div class="lv-info-item">
              <span class="lv-info-item__label">Conclusão Técnica</span>
              <span class="lv-info-item__value">${esc(tratarValor(data.conclusao))}</span>
            </div>
            <div class="lv-info-item">
              <span class="lv-info-item__label">Transformador Destinado Para</span>
              <span class="lv-info-item__value">${esc(tratarValor(data.transformador_destinado))}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="lv-section rt-section">
        <h2 class="rt-section__heading">
          <span class="rt-section__num">5</span> Observações Gerais
        </h2>
        <div class="lv-section__body">
          <div class="lv-text-block">${esc(data.observacoes || "Nenhuma observação registrada.")}</div>
        </div>
      </section>
    </main>`;
}

async function carregarRelatorio() {
  const urlParams = new URLSearchParams(window.location.search);
  const checklistId = urlParams.get("id");
  const reportToken = urlParams.get("token");
  const relatorioContent = document.getElementById("relatorioContent");

  if (!checklistId) {
    if (relatorioContent) {
      relatorioContent.innerHTML =
        '<p class="lv-empty" style="color:#dc2626;text-align:center;">ID do checklist não fornecido.</p>';
    }
    return;
  }

  if (!relatorioContent) return;

  relatorioContent.innerHTML =
    '<p class="lv-empty" style="text-align:center;padding:24px;">Carregando dados do relatório...</p>';

  try {
    const response = reportToken
      ? await fetch(
          `/api/checklist_transformadores_publico/${checklistId}?token=${encodeURIComponent(reportToken)}`,
          { credentials: "same-origin" }
        )
      : await fetch(`/api/checklist_transformadores/${checklistId}`, {
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
      throw new Error("Dados do checklist não encontrados.");
    }

    relatorioContent.innerHTML = montarRelatorioHtml(data, checklistId);
  } catch (error) {
    console.error("Erro ao carregar relatório:", error);
    if (relatorioContent) {
      relatorioContent.innerHTML = `<p class="lv-empty" style="color:#dc2626;text-align:center;">Erro ao carregar o relatório: ${esc(error.message)}</p>`;
    }
  }
}

function gerarPDF() {
  const urlParams = new URLSearchParams(window.location.search);
  const checklistId = urlParams.get("id");
  if (checklistId) {
    window.location.href = `/api/gerar_pdf/${checklistId}`;
  } else {
    alert("ID do checklist não encontrado na URL para gerar PDF!");
  }
}

window.gerarPDF = gerarPDF;

document.addEventListener("DOMContentLoaded", carregarRelatorio);
