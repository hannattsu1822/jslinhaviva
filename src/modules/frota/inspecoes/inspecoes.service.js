const { promisePool } = require("../../../infrastructure/database");
const fsPromises = require("fs").promises;
const { publicPage } = require("../../../shared/path.helper");
const { escapeHtml } = require("../../../shared/htmlEscape.helper");
const {
  wrapReportHtml,
  htmlToPdf,
  formatReportDate,
  buildFleetDocumentCode,
} = require("../../../shared/reports/pdfReport.service");
const {
  renderInfoItem,
  renderTextBlock,
  gerarTabelaChecklistHtml,
  applyTemplatePlaceholders,
} = require("../../../shared/reports/reportHtml.helper");

const MAPEAMENTO_ITENS_INSPECAO = {
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

const CAMPOS_SKY = [
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

const CAMPOS_METADADOS = [
  "id",
  "matricula",
  "placa",
  "data_inspecao",
  "km_atual",
  "horimetro",
  "observacoes",
  "responsavel_nome",
];

function formatarDataInspecao(dataStr) {
  if (!dataStr) return "N/A";
  const dataObj = new Date(dataStr);
  if (isNaN(dataObj.getTime())) return "Data inválida";
  return dataObj.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function extrairItensChecklist(inspecao, grupoSky = false) {
  return Object.keys(MAPEAMENTO_ITENS_INSPECAO)
    .filter((key) => {
      if (CAMPOS_METADADOS.includes(key)) return false;
      const isSky = CAMPOS_SKY.includes(key);
      return grupoSky ? isSky : !isSky;
    })
    .map((key) => ({
      label: MAPEAMENTO_ITENS_INSPECAO[key],
      value: inspecao[key],
    }));
}

async function preencherTemplateHtmlInspecao(inspecao) {
  const templatePath = publicPage("templates/relatorio_inspecao_veiculo.html");
  let templateHtml = await fsPromises.readFile(templatePath, "utf-8");

  const responsavelLabel = inspecao.responsavel_nome
    ? `${inspecao.responsavel_nome} (${inspecao.matricula || "N/A"})`
    : inspecao.matricula || "N/A";

  const detalhesInspecaoGrid = [
    renderInfoItem("Nº da Inspeção", escapeHtml(String(inspecao.id))),
    renderInfoItem("Placa", escapeHtml(inspecao.placa || "N/A")),
    renderInfoItem(
      "Data da Inspeção",
      formatarDataInspecao(inspecao.data_inspecao)
    ),
    renderInfoItem("KM Atual", escapeHtml(String(inspecao.km_atual ?? "N/A"))),
    renderInfoItem(
      "Horímetro",
      escapeHtml(String(inspecao.horimetro ?? "N/A"))
    ),
    renderInfoItem("Responsável", escapeHtml(responsavelLabel), true),
  ].join("");

  const checklistVeiculo = extrairItensChecklist(inspecao, false);
  const checklistSky = extrairItensChecklist(inspecao, true);
  const observacoesBlock = renderTextBlock(
    escapeHtml(inspecao.observacoes || "Nenhuma observação registrada.")
  );

  templateHtml = applyTemplatePlaceholders(templateHtml, {
    detalhes_inspecao_grid: detalhesInspecaoGrid,
    checklist_veiculo_table: gerarTabelaChecklistHtml(checklistVeiculo),
    checklist_sky_table: gerarTabelaChecklistHtml(checklistSky),
    observacoes_block: observacoesBlock,
  });

  const docCode = buildFleetDocumentCode(inspecao.id, inspecao.placa);

  return wrapReportHtml(templateHtml, {
    title: "Relatório Técnico de Inspeção Veicular",
    badge: "Frota · Checklist Veicular",
    processo: `INS-${inspecao.id}`,
    referenceId: inspecao.id,
    generatedAt: formatReportDate(),
    author: responsavelLabel,
    showSignatures: Boolean(inspecao.responsavel_nome || inspecao.matricula),
  });
}

async function listarInspecoes(user) {
  if (user?.nivel >= 4) {
    const [rows] = await promisePool.query(
      "SELECT * FROM inspecoes ORDER BY data_inspecao DESC"
    );
    return rows;
  }
  const [rows] = await promisePool.query(
    "SELECT * FROM inspecoes WHERE matricula = ? ORDER BY data_inspecao DESC",
    [user.matricula]
  );
  return rows;
}

async function obterInspecaoPorId(id, user = null) {
  const [rows] = await promisePool.query(
    `SELECT i.*, u.nome AS responsavel_nome
     FROM inspecoes i
     LEFT JOIN users u ON i.matricula = u.matricula
     WHERE i.id = ?`,
    [id]
  );
  if (rows.length === 0) {
    throw new Error("Inspeção não encontrada!");
  }
  const inspecao = rows[0];
  if (user) {
    const { assertAcessoRecursoProprio } = require("../../../shared/accessControl.helper");
    assertAcessoRecursoProprio(user, inspecao.matricula, "Acesso negado a esta inspeção.");
  }
  return inspecao;
}

async function salvarInspecao(dadosInspecao) {
  const {
    agendamento_id,
    matricula,
    placa,
    data_inspecao,
    km_atual,
    horimetro,
  } = dadosInspecao;

  if (!matricula || !placa || !data_inspecao || !km_atual || !horimetro) {
    throw new Error("Dados obrigatórios faltando!");
  }
  if (parseFloat(km_atual) < 0 || parseFloat(horimetro) < 0) {
    throw new Error("KM atual e horímetro devem ser valores positivos!");
  }

  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();

    const campos = [
      "matricula",
      "placa",
      "data_inspecao",
      "km_atual",
      "horimetro",
      "observacoes",
      "buzina",
      "cinto_seguranca",
      "quebra_sol",
      "retrovisor_inteiro",
      "retrovisor_direito_esquerdo",
      "limpador_para_brisa",
      "farol_baixa",
      "farol_alto",
      "meia_luz",
      "luz_freio",
      "luz_re",
      "bateria",
      "luzes_painel",
      "seta_direita_esquerdo",
      "pisca_alerta",
      "luz_interna",
      "velocimetro_tacografo",
      "freios",
      "macaco",
      "chave_roda",
      "triangulo_sinalizacao",
      "extintor_incendio",
      "portas_travas",
      "sirene",
      "fechamento_janelas",
      "para_brisa",
      "oleo_motor",
      "oleo_freio",
      "nivel_agua_radiador",
      "pneus_estado_calibragem",
      "pneu_reserva_estepe",
      "bancos_encosto_assentos",
      "para_choque_dianteiro",
      "para_choque_traseiro",
      "lataria",
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
    const placeholders = campos.map(() => "?").join(", ");
    const values = campos.map((campo) =>
      dadosInspecao[campo] !== undefined ? dadosInspecao[campo] : null
    );
    const query = `INSERT INTO inspecoes (${campos.join(
      ", "
    )}) VALUES (${placeholders})`;
    const [inspecaoResult] = await connection.query(query, values);
    const novaInspecaoId = inspecaoResult.insertId;

    if (agendamento_id) {
      const updateAgendamentoQuery = `
        UPDATE agendamentos_checklist
        SET status = 'Concluído', data_conclusao = NOW(), inspecao_id = ?
        WHERE id = ? AND status = 'Agendado'
      `;
      const [updateResult] = await connection.query(updateAgendamentoQuery, [
        novaInspecaoId,
        agendamento_id,
      ]);

      if (updateResult.affectedRows === 0) {
        await connection.rollback();
        throw new Error(
          "Agendamento não encontrado ou já foi concluído/cancelado. Inspeção não salva."
        );
      }
    }

    await connection.commit();
    return { novaInspecaoId };
  } catch (err) {
    if (connection) await connection.rollback();
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

async function filtrarInspecoes(filtros) {
  const { placa, matricula, dataInicial, dataFinal } = filtros;
  let query = "SELECT * FROM inspecoes WHERE 1=1";
  const values = [];
  if (placa) {
    query += ` AND placa = ?`;
    values.push(placa);
  }
  if (matricula) {
    query += ` AND matricula = ?`;
    values.push(matricula);
  }
  if (dataInicial && dataFinal) {
    query += ` AND data_inspecao BETWEEN ? AND ?`;
    values.push(dataInicial, dataFinal);
  } else if (dataInicial) {
    query += ` AND data_inspecao >= ?`;
    values.push(dataInicial);
  } else if (dataFinal) {
    query += ` AND data_inspecao <= ?`;
    values.push(dataFinal);
  }
  query += " ORDER BY data_inspecao DESC";
  const [rows] = await promisePool.query(query, values);
  return rows;
}

async function excluirInspecao(id, user) {
  await obterInspecaoPorId(id, user);
  const [result] = await promisePool.query(
    "DELETE FROM inspecoes WHERE id = ?",
    [id]
  );
  if (result.affectedRows === 0) {
    throw new Error("Inspeção não encontrada!");
  }
}

async function atualizarInspecao(id, dadosInspecao, user) {
  const existente = await obterInspecaoPorId(id, user);
  const {
    placa,
    data_inspecao,
    km_atual,
    horimetro,
    observacoes,
    ...checklistFields
  } = dadosInspecao;

  const matricula =
    user?.nivel >= 4 && dadosInspecao.matricula
      ? dadosInspecao.matricula
      : existente.matricula;

  if (!matricula || !placa || !data_inspecao || !km_atual || !horimetro) {
    throw new Error("Dados básicos da inspeção faltando!");
  }
  if (parseFloat(km_atual) < 0 || parseFloat(horimetro) < 0) {
    throw new Error("KM atual e horímetro devem ser valores positivos!");
  }

  const camposParaAtualizar = {
    placa,
    matricula,
    data_inspecao,
    km_atual,
    horimetro,
    observacoes: observacoes || null,
    ...checklistFields,
  };
  for (const key in camposParaAtualizar) {
    if (camposParaAtualizar[key] === undefined) {
      delete camposParaAtualizar[key];
    }
  }
  const camposNomes = Object.keys(camposParaAtualizar);
  if (camposNomes.length === 0) {
    throw new Error("Nenhum dado para atualizar!");
  }

  const setClauses = camposNomes.map((campo) => `${campo} = ?`).join(", ");
  const values = camposNomes.map((campo) => camposParaAtualizar[campo]);
  values.push(id);

  const query = `UPDATE inspecoes SET ${setClauses} WHERE id = ?`;
  const [result] = await promisePool.query(query, values);

  if (result.affectedRows === 0) {
    throw new Error("Inspeção não encontrada para atualização!");
  }
}

async function obterUltimoHorimetro(placa) {
  if (!placa) {
    throw new Error("Placa é obrigatória!");
  }
  const [rows] = await promisePool.query(
    "SELECT horimetro FROM inspecoes WHERE placa = ? ORDER BY data_inspecao DESC LIMIT 1",
    [placa]
  );
  if (rows.length === 0) {
    throw new Error("Nenhuma inspeção encontrada para esta placa.");
  }
  return rows[0];
}

async function gerarPdfInspecao(id, _protocol, _host, user) {
  const inspecao = await obterInspecaoPorId(id, user);

  const placaFormatada = String(inspecao.placa || "SEM_PLACA").replace(
    /[^a-zA-Z0-9]/g,
    "_"
  );
  const nomeArquivo = `inspecao_${id}_${placaFormatada}.pdf`;
  const docCode = buildFleetDocumentCode(inspecao.id, inspecao.placa);

  const htmlContent = await preencherTemplateHtmlInspecao(inspecao);
  const pdfBuffer = await htmlToPdf(htmlContent, {
    landscape: true,
    footerOnly: true,
    docCode,
  });

  return { nomeArquivo, pdfBuffer };
}

module.exports = {
  listarInspecoes,
  obterInspecaoPorId,
  salvarInspecao,
  filtrarInspecoes,
  excluirInspecao,
  atualizarInspecao,
  obterUltimoHorimetro,
  gerarPdfInspecao,
};
