const { promisePool } = require("../../../init");
const { chromium } = require("playwright");
const path = require("path");
const { projectRootDir } = require("../../../shared/path.helper");

async function listarInspecoes() {
  const [rows] = await promisePool.query(
    "SELECT * FROM inspecoes ORDER BY data_inspecao DESC"
  );
  return rows;
}

async function obterInspecaoPorId(id) {
  const [rows] = await promisePool.query(
    "SELECT * FROM inspecoes WHERE id = ?",
    [id]
  );
  if (rows.length === 0) {
    throw new Error("Inspeção não encontrada!");
  }
  return rows[0];
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

async function excluirInspecao(id) {
  const [result] = await promisePool.query(
    "DELETE FROM inspecoes WHERE id = ?",
    [id]
  );
  if (result.affectedRows === 0) {
    throw new Error("Inspeção não encontrada!");
  }
}

async function atualizarInspecao(id, dadosInspecao) {
  const {
    placa,
    matricula,
    data_inspecao,
    km_atual,
    horimetro,
    observacoes,
    ...checklistFields
  } = dadosInspecao;

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

async function gerarPdfInspecao(id, protocol, host) {
  const [rows] = await promisePool.query(
    "SELECT placa FROM inspecoes WHERE id = ?",
    [id]
  );
  if (rows.length === 0) {
    throw new Error("Inspeção não encontrada!");
  }
  const { placa } = rows[0];
  const placaFormatada = String(placa || "SEM_PLACA").replace(
    /[^a-zA-Z0-9]/g,
    "_"
  );
  const nomeArquivo = `inspecao_${id}_${placaFormatada}.pdf`;

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  const url = `${protocol}://${host}/relatorio_publico_veiculos?id=${id}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

  const headerFooterStyle = `font-family: 'Poppins', Arial, sans-serif; font-size: 9px; color: #333; width: 100%;`;
  const primaryColorForHeader = "#004494";
  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "40mm", right: "10mm", bottom: "25mm", left: "10mm" },
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="${headerFooterStyle} padding: 0 10mm; height: 30mm; display: flex; flex-direction: column; justify-content: center; align-items: center; border-bottom: 1px solid #ddd;">
        <div style="font-size: 14px; color: ${primaryColorForHeader}; font-weight: 600;">Relatório de Inspeção Veicular</div>
        <div style="font-size: 10px; color: #555;">SULGIPE - LINHA VIVA SYSTEM</div>
      </div>
    `,
    footerTemplate: `
      <div style="${headerFooterStyle} padding: 0 10mm; height: 15mm; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #ddd;">
        <span>Gerado em: <span class="date"></span></span>
        <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
      </div>
    `,
  });
  await browser.close();

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
