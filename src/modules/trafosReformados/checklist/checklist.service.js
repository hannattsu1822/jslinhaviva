const { promisePool } = require("../../../infrastructure/database");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;
const { projectRootDir, publicPage } = require("../../../shared/path.helper");
const { escapeHtml } = require("../../../shared/htmlEscape.helper");
const {
  wrapReportHtml,
  htmlToPdf,
  formatReportDate,
  buildDocumentCode,
  buildReformadoDocumentCode,
} = require("../../../shared/reports/pdfReport.service");
const {
  renderInfoItem,
  renderTextBlock,
  renderStatusBadge,
  gerarGaleriaHtml,
  gerarAnexoImpressaoIndividualHtml,
  applyTemplatePlaceholders,
} = require("../../../shared/reports/reportHtml.helper");

function formatarDataHora(val) {
  if (!val) return "N/A";
  const date = new Date(val);
  if (isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("pt-BR", { timeZone: "America/Maceio" });
}

function formatarData(val) {
  if (!val) return "N/A";
  const date = new Date(val);
  if (isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function formatarDataParaPDFRelatorioTabela(dataISO) {
  if (!dataISO) return "N/A";
  if (typeof dataISO === "string" && dataISO.match(/^\d{2}\/\d{2}\/\d{4}/)) {
    return dataISO.substring(0, 10);
  }
  const dateParts = String(dataISO).split("-");
  if (dateParts.length === 3) {
    return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
  }
  try {
    const dateObj = new Date(dataISO);
    if (!isNaN(dateObj.getTime())) {
      const dia = String(dateObj.getUTCDate()).padStart(2, "0");
      const mes = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
      const ano = dateObj.getUTCFullYear();
      return `${dia}/${mes}/${ano}`;
    }
  } catch (e) {}
  return dataISO;
}

function resolverTecnicoLabel(checklist) {
  if (checklist.nome_tecnico) {
    const matricula = checklist.tecnico_responsavel_teste || "N/A";
    return `${checklist.nome_tecnico} (${matricula})`;
  }
  return checklist.tecnico_responsavel_teste || "N/A";
}

async function processarAnexosParaRelatorio(anexos = []) {
  const imagens = [];
  const anexoImpressaoItems = [];

  for (const anexo of anexos) {
    if (!anexo?.caminho_arquivo) continue;
    const absolutePath = path.join(projectRootDir, anexo.caminho_arquivo);
    if (!fs.existsSync(absolutePath)) continue;

    try {
      const buffer = await fsPromises.readFile(absolutePath);
      const mimeType = anexo.tipo_mime || "image/jpeg";
      const src = `data:${mimeType};base64,${buffer.toString("base64")}`;
      const nome = anexo.nome_original || "Anexo fotográfico";
      imagens.push({ src, nome });
      anexoImpressaoItems.push({ type: "photo", src, nome });
    } catch (err) {
      console.error(`Erro ao ler anexo ${absolutePath}:`, err.message);
    }
  }

  return { imagens, anexoImpressaoItems };
}

function gerarTabelaBobinasHtml(checklist) {
  return `
    <table class="lv-table lv-table--checklist lv-table--phases">
      <thead>
        <tr>
          <th class="lv-table__label-col">Verificação</th>
          <th class="lv-table__phase-col">Fase I</th>
          <th class="lv-table__phase-col">Fase II</th>
          <th class="lv-table__phase-col">Fase III</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="lv-table__label-col"><strong>Bobinas Primárias</strong></td>
          <td class="lv-table__phase-col">${escapeHtml(checklist.bobina_primaria_i || "N/A")}</td>
          <td class="lv-table__phase-col">${escapeHtml(checklist.bobina_primaria_ii || "N/A")}</td>
          <td class="lv-table__phase-col">${escapeHtml(checklist.bobina_primaria_iii || "N/A")}</td>
        </tr>
        <tr>
          <td class="lv-table__label-col"><strong>Bobinas Secundárias</strong></td>
          <td class="lv-table__phase-col">${escapeHtml(checklist.bobina_secundaria_i || "N/A")}</td>
          <td class="lv-table__phase-col">${escapeHtml(checklist.bobina_secundaria_ii || "N/A")}</td>
          <td class="lv-table__phase-col">${escapeHtml(checklist.bobina_secundaria_iii || "N/A")}</td>
        </tr>
        <tr>
          <td class="lv-table__label-col"><strong>Valores Teste TTR</strong></td>
          <td class="lv-table__phase-col">${escapeHtml(checklist.valor_bobina_i || "N/A")}</td>
          <td class="lv-table__phase-col">${escapeHtml(checklist.valor_bobina_ii || "N/A")}</td>
          <td class="lv-table__phase-col">${escapeHtml(checklist.valor_bobina_iii || "N/A")}</td>
        </tr>
      </tbody>
    </table>`;
}

async function preencherTemplateHtmlChecklistReformado(
  checklist,
  transformador,
  options = {}
) {
  const {
    sectionOffset = 0,
    includeAnexos = true,
  } = options;

  const templatePath = publicPage(
    "templates/relatorio_checklist_trafo_reformado.html"
  );
  let templateHtml = await fsPromises.readFile(templatePath, "utf-8");

  const tecnicoLabel = resolverTecnicoLabel(checklist);
  const conclusao = checklist.conclusao_checklist || "N/A";
  const conclusaoBadge = renderStatusBadge(
    conclusao === "APROVADO" ? "Aprovado" : conclusao === "REPROVADO" ? "Reprovado" : conclusao
  );

  const detalhesIdentificacaoGrid = [
    renderInfoItem("ID do Teste", escapeHtml(String(checklist.id ?? "N/A"))),
    renderInfoItem(
      "ID do Registro",
      escapeHtml(String(transformador.id ?? checklist.trafos_reformados_id ?? "N/A"))
    ),
    renderInfoItem(
      "Nº de Série",
      escapeHtml(transformador.numero_serie || checklist.numero_serie || "N/A")
    ),
    renderInfoItem(
      "Fabricante",
      escapeHtml(transformador.fabricante || checklist.fabricante || "N/A")
    ),
    renderInfoItem(
      "Potência (kVA)",
      escapeHtml(String(transformador.pot ?? checklist.pot ?? "N/A"))
    ),
    renderInfoItem("Data do Teste", escapeHtml(formatarDataHora(checklist.data_teste))),
    renderInfoItem("Técnico Responsável", escapeHtml(tecnicoLabel), true),
  ].join("");

  const detalhesConclusaoGrid = [
    renderInfoItem("Status Final", conclusaoBadge),
  ].join("");

  let anexosGaleria = '<p class="lv-empty">Nenhum registro fotográfico encontrado.</p>';
  let anexoImpressaoItems = [];

  if (includeAnexos && checklist.anexos?.length) {
    const anexosProcessados = await processarAnexosParaRelatorio(checklist.anexos);
    anexoImpressaoItems = anexosProcessados.anexoImpressaoItems;
    if (anexosProcessados.imagens.length) {
      anexosGaleria = gerarGaleriaHtml(anexosProcessados.imagens, 3, {
        technical: true,
      });
    }
  }

  templateHtml = applyTemplatePlaceholders(templateHtml, {
    secao_identificacao: String(sectionOffset + 1),
    secao_avaliacao: String(sectionOffset + 2),
    secao_conclusao: String(sectionOffset + 3),
    secao_anexos: String(sectionOffset + 4),
    detalhes_identificacao_grid: detalhesIdentificacaoGrid,
    avaliacao_bobinas_table: gerarTabelaBobinasHtml(checklist),
    estado_fisico_block: renderTextBlock(
      escapeHtml(checklist.estado_fisico || "N/A")
    ),
    observacoes_checklist_block: renderTextBlock(
      escapeHtml(checklist.observacoes_checklist || "Nenhuma observação registrada.")
    ),
    observacoes_gerais_block: renderTextBlock(
      escapeHtml(
        transformador.resultado_avaliacao ||
          checklist.resultado_avaliacao ||
          "Nenhuma observação registrada."
      )
    ),
    detalhes_conclusao_grid: detalhesConclusaoGrid,
    anexos_galeria: anexosGaleria,
  });

  return { templateHtml, anexoImpressaoItems, tecnicoLabel };
}

async function montarBlocoAvaliacaoHistorico(
  checklist,
  transformador,
  index
) {
  const tecnicoLabel = resolverTecnicoLabel(checklist);
  const conclusao = checklist.conclusao_checklist || "N/A";
  const conclusaoBadge = renderStatusBadge(
    conclusao === "APROVADO"
      ? "Aprovado"
      : conclusao === "REPROVADO"
        ? "Reprovado"
        : conclusao
  );

  let anexosGaleria =
    '<p class="lv-empty">Nenhum registro fotográfico nesta avaliação.</p>';
  let anexoImpressaoItems = [];

  if (checklist.anexos?.length) {
    const anexosProcessados = await processarAnexosParaRelatorio(
      checklist.anexos
    );
    anexoImpressaoItems = anexosProcessados.anexoImpressaoItems;
    if (anexosProcessados.imagens.length) {
      anexosGaleria = gerarGaleriaHtml(anexosProcessados.imagens, 3, {
        technical: true,
      });
    }
  }

  const html = `
    <section class="lv-section rt-section rt-evaluation-block">
      <h2 class="rt-section__heading">
        <span class="rt-section__num">${index + 1}</span>
        Avaliação — Teste ${escapeHtml(String(checklist.id))}
      </h2>
      <div class="lv-section__body">
        <div class="lv-info-grid lv-info-grid--4col">
          ${renderInfoItem("Data do Teste", escapeHtml(formatarDataHora(checklist.data_teste)))}
          ${renderInfoItem("ID do Registro", escapeHtml(String(checklist.trafos_reformados_id ?? transformador.id ?? "N/A")))}
          ${renderInfoItem("Técnico Responsável", escapeHtml(tecnicoLabel))}
          ${renderInfoItem("Status Final", conclusaoBadge)}
        </div>
        ${gerarTabelaBobinasHtml(checklist)}
        <p class="lv-subsection-title">Estado Físico Geral</p>
        ${renderTextBlock(escapeHtml(checklist.estado_fisico || "N/A"))}
        <p class="lv-subsection-title">Observações do Checklist</p>
        ${renderTextBlock(
          escapeHtml(
            checklist.observacoes_checklist || "Nenhuma observação registrada."
          )
        )}
        <p class="lv-subsection-title">Observações Gerais / Motivo da Reprovação</p>
        ${renderTextBlock(
          escapeHtml(
            transformador.resultado_avaliacao ||
              checklist.resultado_avaliacao ||
              "Nenhuma observação registrada."
          )
        )}
        <p class="lv-subsection-title">Registro Fotográfico</p>
        ${anexosGaleria}
      </div>
    </section>`;

  return { html, anexoImpressaoItems };
}

async function montarHtmlChecklistReformado(
  checklist,
  transformador,
  usuarioLogado,
  options = {}
) {
  const { templateHtml, anexoImpressaoItems, tecnicoLabel } =
    await preencherTemplateHtmlChecklistReformado(
      checklist,
      transformador,
      options
    );

  const numeroSerie =
    transformador.numero_serie || checklist.numero_serie || checklist.id;
  const docCode = buildReformadoDocumentCode(checklist.id, numeroSerie);
  const author =
    usuarioLogado?.nome && usuarioLogado?.matricula
      ? `${usuarioLogado.nome} (${usuarioLogado.matricula})`
      : tecnicoLabel;

  const appendixHtml = gerarAnexoImpressaoIndividualHtml(anexoImpressaoItems, {
    docCode,
    processo: `REF-${checklist.id}`,
  });

  const htmlContent = await wrapReportHtml(templateHtml, {
    title: "Relatório Técnico de Avaliação de Transformador Reformado",
    badge: "Reformados · Avaliação Técnica",
    processo: `REF-${checklist.id}`,
    referenceId: checklist.id,
    generatedAt: formatReportDate(),
    author,
    showSignatures: Boolean(tecnicoLabel && tecnicoLabel !== "N/A"),
    appendixHtml,
  });

  return { htmlContent, docCode };
}

async function obterChecklistPorRegistroId(registroId) {
  const [rows] = await promisePool.query(
    `SELECT 
        tst.*, 
        u.nome as nome_tecnico,
        tr.numero_serie,
        tr.fabricante,
        tr.pot,
        tr.resultado_avaliacao
     FROM trafos_reformados_testes tst
     JOIN trafos_reformados tr ON tst.trafos_reformados_id = tr.id
     LEFT JOIN users u ON tst.tecnico_responsavel_teste = u.matricula
     WHERE tst.trafos_reformados_id = ?
     ORDER BY tst.data_teste DESC, tst.id DESC
     LIMIT 1`,
    [registroId]
  );
  if (rows.length === 0) {
    throw new Error("Nenhum checklist encontrado para este registro.");
  }

  const checklist = rows[0];

  const [anexos] = await promisePool.query(
    "SELECT * FROM reform_anexos_checklist WHERE teste_id = ?",
    [checklist.id]
  );

  checklist.anexos = anexos;

  return checklist;
}

async function obterHistoricoPorSerie(numero_serie) {
  const [checklists] = await promisePool.query(
    `SELECT 
        tst.*, 
        tr.numero_serie, 
        tr.fabricante,
        tr.pot,
        tr.resultado_avaliacao,
        u.nome as nome_tecnico
     FROM trafos_reformados_testes tst
     JOIN trafos_reformados tr ON tst.trafos_reformados_id = tr.id
     LEFT JOIN users u ON tst.tecnico_responsavel_teste = u.matricula
     WHERE tr.numero_serie = ? 
     ORDER BY tst.data_teste DESC, tst.id DESC`,
    [numero_serie]
  );

  if (checklists.length > 0) {
    const testeIds = checklists.map((c) => c.id);
    const [anexos] = await promisePool.query(
      "SELECT * FROM reform_anexos_checklist WHERE teste_id IN (?)",
      [testeIds]
    );

    const anexosMap = anexos.reduce((acc, anexo) => {
      if (!acc[anexo.teste_id]) {
        acc[anexo.teste_id] = [];
      }
      acc[anexo.teste_id].push(anexo);
      return acc;
    }, {});

    checklists.forEach((checklist) => {
      checklist.anexos = anexosMap[checklist.id] || [];
    });
  }

  return checklists;
}

async function avaliarCompleto(id, dadosAvaliacao) {
  const {
    matricula_responsavel,
    status_avaliacao,
    resultado_avaliacao,
    anexos_imagem,
  } = dadosAvaliacao;

  const checklist_data = JSON.parse(dadosAvaliacao.checklist_data);

  if (!matricula_responsavel || !status_avaliacao) {
    throw new Error(
      "Matrícula do responsável e status da avaliação são obrigatórios."
    );
  }
  if (!checklist_data) {
    throw new Error("Dados do checklist são obrigatórios.");
  }

  let conclusaoChecklistParaDb;
  if (status_avaliacao === "avaliado") {
    conclusaoChecklistParaDb = "APROVADO";
  } else if (status_avaliacao === "reprovado") {
    conclusaoChecklistParaDb = "REPROVADO";
  } else {
    throw new Error("Status de avaliação inválido para o checklist.");
  }

  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();

    const [tecnico] = await connection.query(
      `SELECT matricula FROM users WHERE matricula = ? AND cargo IN ('ADMIN', 'ADM', 'Engenheiro', 'Técnico', 'Inspetor')`,
      [matricula_responsavel]
    );
    if (tecnico.length === 0) {
      throw new Error("Técnico responsável não encontrado ou não autorizado.");
    }

    await connection.query(
      `UPDATE trafos_reformados SET tecnico_responsavel = ?, status_avaliacao = ?, resultado_avaliacao = ?, data_avaliacao = NOW() WHERE id = ?`,
      [matricula_responsavel, status_avaliacao, resultado_avaliacao || null, id]
    );

    const [testeResult] = await connection.query(
      `INSERT INTO trafos_reformados_testes (
                trafos_reformados_id, bobina_primaria_i, bobina_primaria_ii, bobina_primaria_iii,
                bobina_secundaria_i, bobina_secundaria_ii, bobina_secundaria_iii, estado_fisico,
                conclusao_checklist, observacoes_checklist, tecnico_responsavel_teste, data_teste,
                valor_bobina_i, valor_bobina_ii, valor_bobina_iii
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
      [
        id,
        checklist_data.bobina_primaria_i,
        checklist_data.bobina_primaria_ii,
        checklist_data.bobina_primaria_iii,
        checklist_data.bobina_secundaria_i,
        checklist_data.bobina_secundaria_ii,
        checklist_data.bobina_secundaria_iii,
        checklist_data.estado_fisico,
        conclusaoChecklistParaDb,
        checklist_data.observacoes_checklist,
        matricula_responsavel,
        checklist_data.valor_bobina_i || null,
        checklist_data.valor_bobina_ii || null,
        checklist_data.valor_bobina_iii || null,
      ]
    );

    const novoTesteId = testeResult.insertId;
    const anexosSalvos = [];

    if (anexos_imagem && anexos_imagem.length > 0) {
      for (const file of anexos_imagem) {
        const anexoPathParaDB = `trafos_reformados_anexos/${id}/${file.filename}`;
        const [anexoResult] = await connection.query(
          `INSERT INTO reform_anexos_checklist (teste_id, caminho_arquivo, nome_original, tamanho_arquivo, tipo_mime) VALUES (?, ?, ?, ?, ?)`,
          [
            novoTesteId,
            anexoPathParaDB,
            file.originalname,
            file.size,
            file.mimetype,
          ]
        );
        anexosSalvos.push({
          id: anexoResult.insertId,
          caminho_arquivo: anexoPathParaDB,
          nome_original: file.originalname,
        });
      }
    }

    await connection.commit();
    return { teste_id: novoTesteId, anexos: anexosSalvos };
  } catch (err) {
    await connection.rollback();
    if (anexos_imagem && anexos_imagem.length > 0) {
      for (const file of anexos_imagem) {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }
    throw err;
  } finally {
    connection.release();
  }
}

async function gerarPdfChecklist(checklist, transformador, usuarioLogado) {
  const { htmlContent, docCode } = await montarHtmlChecklistReformado(
    checklist,
    transformador,
    usuarioLogado
  );

  return htmlToPdf(htmlContent, {
    landscape: true,
    footerOnly: true,
    docCode,
  });
}

async function gerarPdfTabelaHistorico(dados, filtros, usuario) {
  if (!dados?.length) {
    throw new Error("Não há dados para gerar o relatório.");
  }

  const filtrosLinhas = Object.entries(filtros || {})
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`);

  if (filtrosLinhas.length === 0) {
    filtrosLinhas.push("Nenhum filtro específico aplicado.");
  }

  const linhasTabela = dados
    .map((trafo) => {
      const statusLabel =
        trafo.status_avaliacao === "avaliado" ? "Aprovado" : "Reprovado";
      return `<tr>
        <td>${escapeHtml(String(trafo.id ?? "-"))}</td>
        <td>${escapeHtml(trafo.numero_serie || "-")}</td>
        <td>${escapeHtml(trafo.fabricante || "-")}</td>
        <td>${escapeHtml(String(trafo.pot ?? "-"))}</td>
        <td>${escapeHtml(statusLabel)}</td>
        <td>${escapeHtml(formatarData(trafo.data_avaliacao))}</td>
        <td>${escapeHtml(trafo.nome_tecnico || "-")}</td>
      </tr>`;
    })
    .join("");

  const bodyHtml = `
    <section class="lv-section rt-section">
      <h2 class="rt-section__heading">
        <span class="rt-section__num">1</span> Filtros Aplicados
      </h2>
      <div class="lv-section__body">
        <div class="lv-text-block">${filtrosLinhas.map((l) => escapeHtml(l)).join("<br>")}</div>
      </div>
    </section>
    <section class="lv-section rt-section">
      <h2 class="rt-section__heading">
        <span class="rt-section__num">2</span> Listagem de Checklists Avaliados
      </h2>
      <div class="lv-section__body">
        <table class="lv-table lv-table--checklist">
          <thead>
            <tr>
              <th>ID Registro</th>
              <th>Nº de Série</th>
              <th>Fabricante</th>
              <th>Potência</th>
              <th>Status</th>
              <th>Data Avaliação</th>
              <th>Técnico</th>
            </tr>
          </thead>
          <tbody>${linhasTabela}</tbody>
        </table>
      </div>
    </section>`;

  const docCode = buildDocumentCode("LIST", Date.now(), { prefix: "LV-REF" });
  const author =
    usuario?.nome && usuario?.matricula
      ? `${usuario.nome} (${usuario.matricula})`
      : "";

  const htmlContent = await wrapReportHtml(bodyHtml, {
    title: "Relatório de Checklists de Transformadores Reformados",
    badge: "Reformados · Listagem",
    processo: "LISTAGEM",
    referenceId: "000",
    generatedAt: formatReportDate(),
    author,
    showSignatures: false,
  });

  return htmlToPdf(htmlContent, {
    landscape: true,
    footerOnly: true,
    docCode,
  });
}

async function gerarPdfListaHistorico(checklists, transformador, usuarioLogado) {
  if (!checklists?.length) {
    throw new Error("Não há avaliações para gerar o relatório.");
  }

  const numeroSerie = transformador.numero_serie || checklists[0]?.numero_serie;
  if (!numeroSerie) {
    throw new Error("Número de série não informado.");
  }

  const resumoLinhas = checklists
    .map((item) => {
      const statusLabel =
        item.conclusao_checklist === "APROVADO" ? "Aprovado" : "Reprovado";
      return `<tr>
        <td>${escapeHtml(String(item.id ?? "-"))}</td>
        <td>${escapeHtml(String(item.trafos_reformados_id ?? "-"))}</td>
        <td>${escapeHtml(formatarDataHora(item.data_teste))}</td>
        <td>${escapeHtml(item.nome_tecnico || item.tecnico_responsavel_teste || "-")}</td>
        <td>${escapeHtml(statusLabel)}</td>
      </tr>`;
    })
    .join("");

  let secoesDetalhadas = [];
  const todosAnexoItems = [];

  for (let index = 0; index < checklists.length; index += 1) {
    const checklist = checklists[index];
    const transformadorItem = {
      id: checklist.trafos_reformados_id || transformador.id,
      numero_serie: numeroSerie,
      fabricante: checklist.fabricante || transformador.fabricante,
      pot: checklist.pot || transformador.pot,
      resultado_avaliacao:
        checklist.resultado_avaliacao || transformador.resultado_avaliacao,
    };

    const { html, anexoImpressaoItems } = await montarBlocoAvaliacaoHistorico(
      checklist,
      transformadorItem,
      index
    );

    todosAnexoItems.push(...anexoImpressaoItems);
    secoesDetalhadas.push(`
      <div class="lv-page-break"></div>
      ${html}
    `);
  }

  const bodyHtml = `
    <section class="lv-section rt-section">
      <h2 class="rt-section__heading">
        <span class="rt-section__num">A</span> Identificação do Transformador
      </h2>
      <div class="lv-section__body">
        <div class="lv-info-grid lv-info-grid--4col">
          ${renderInfoItem("Nº de Série", escapeHtml(numeroSerie))}
          ${renderInfoItem(
            "Fabricante",
            escapeHtml(checklists[0]?.fabricante || transformador.fabricante || "N/A")
          )}
          ${renderInfoItem(
            "Potência (kVA)",
            escapeHtml(String(checklists[0]?.pot || transformador.pot || "N/A"))
          )}
          ${renderInfoItem(
            "Total de Avaliações",
            escapeHtml(String(checklists.length))
          )}
        </div>
      </div>
    </section>
    <section class="lv-section rt-section">
      <h2 class="rt-section__heading">
        <span class="rt-section__num">B</span> Resumo das Avaliações
      </h2>
      <div class="lv-section__body">
        <table class="lv-table lv-table--checklist">
          <thead>
            <tr>
              <th>ID Teste</th>
              <th>ID Registro</th>
              <th>Data do Teste</th>
              <th>Técnico</th>
              <th>Conclusão</th>
            </tr>
          </thead>
          <tbody>${resumoLinhas}</tbody>
        </table>
      </div>
    </section>
    <section class="lv-section rt-section rt-section--annex">
      <h2 class="rt-section__heading">
        <span class="rt-section__num">C</span> Detalhamento das Avaliações
      </h2>
      <div class="lv-section__body">
        <p class="rt-section__intro">Registros completos de cada teste realizado para o número de série ${escapeHtml(numeroSerie)}.</p>
      </div>
    </section>
    ${secoesDetalhadas.join("")}`;

  const docCode = buildReformadoDocumentCode("HIST", numeroSerie);
  const author =
    usuarioLogado?.nome && usuarioLogado?.matricula
      ? `${usuarioLogado.nome} (${usuarioLogado.matricula})`
      : "";

  const appendixHtml = gerarAnexoImpressaoIndividualHtml(todosAnexoItems, {
    docCode,
    processo: numeroSerie,
  });

  const htmlContent = await wrapReportHtml(bodyHtml, {
    title: "Histórico de Avaliações — Transformador Reformado",
    badge: "Reformados · Histórico por Série",
    processo: numeroSerie,
    referenceId: "HIST",
    generatedAt: formatReportDate(),
    author,
    showSignatures: false,
    appendixHtml,
  });

  return htmlToPdf(htmlContent, {
    landscape: true,
    footerOnly: true,
    docCode,
  });
}

async function excluirAnexo(anexoId) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();

    const [anexoRows] = await connection.query(
      "SELECT caminho_arquivo FROM reform_anexos_checklist WHERE id = ?",
      [anexoId]
    );

    if (anexoRows.length === 0) {
      throw new Error("Anexo não encontrado.");
    }

    const anexo = anexoRows[0];
    const absolutePath = path.join(projectRootDir, anexo.caminho_arquivo);

    const [deleteResult] = await connection.query(
      "DELETE FROM reform_anexos_checklist WHERE id = ?",
      [anexoId]
    );

    if (deleteResult.affectedRows === 0) {
      throw new Error(
        "Falha ao excluir o registro do anexo do banco de dados."
      );
    }

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  obterChecklistPorRegistroId,
  obterHistoricoPorSerie,
  avaliarCompleto,
  gerarPdfChecklist,
  gerarPdfTabelaHistorico,
  gerarPdfListaHistorico,
  excluirAnexo,
};
