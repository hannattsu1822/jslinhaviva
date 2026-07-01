const { promisePool } = require("../../../infrastructure/database");
const ExcelJS = require("exceljs");
const fs = require("fs");

async function listarCiclos(filtros) {
  const {
    id,
    status,
    status_not_in,
    numero_serie,
    fabricante,
    pot,
    tecnico_responsavel,
    data_avaliacao_inicial,
    data_avaliacao_final,
    getAll,
    page,
    limit,
  } = filtros;
  let queryParams = [];
  let conditions = "WHERE 1=1";

  if (id) {
    conditions += " AND tr.id = ?";
    queryParams.push(id);
  }
  if (status) {
    conditions += " AND tr.status_avaliacao = ?";
    queryParams.push(status);
  }
  if (status_not_in) {
    conditions += " AND tr.status_avaliacao != ?";
    queryParams.push(status_not_in);
  }
  if (numero_serie) {
    conditions += " AND tr.numero_serie LIKE ?";
    queryParams.push(`%${numero_serie}%`);
  }
  if (fabricante) {
    conditions += " AND tr.fabricante LIKE ?";
    queryParams.push(`%${fabricante}%`);
  }
  if (pot) {
    conditions += " AND tr.pot LIKE ?";
    queryParams.push(`%${pot}%`);
  }
  if (tecnico_responsavel) {
    conditions += " AND tr.tecnico_responsavel = ?";
    queryParams.push(tecnico_responsavel);
  }
  if (data_avaliacao_inicial && data_avaliacao_final) {
    conditions += " AND DATE(tr.data_avaliacao) BETWEEN ? AND ?";
    queryParams.push(data_avaliacao_inicial, data_avaliacao_final);
  } else if (data_avaliacao_inicial) {
    conditions += " AND DATE(tr.data_avaliacao) >= ?";
    queryParams.push(data_avaliacao_inicial);
  } else if (data_avaliacao_final) {
    conditions += " AND DATE(tr.data_avaliacao) <= ?";
    queryParams.push(data_avaliacao_final);
  }

  const countQuery = `SELECT COUNT(*) as totalItems FROM trafos_reformados tr ${conditions}`;
  const [countResult] = await promisePool.query(countQuery, queryParams);
  const totalItems = countResult[0].totalItems;

  let totalPages = 1;
  if (getAll !== "true" && totalItems > 0) {
    totalPages = Math.ceil(totalItems / limit);
  }

  let dataQuery = `
        SELECT tr.*, u.nome as nome_tecnico,
            (SELECT COUNT(*) FROM trafos_reformados tr_hist WHERE tr_hist.numero_serie = tr.numero_serie) as total_ciclos,
            (SELECT MAX(tr_anterior.data_avaliacao) FROM trafos_reformados tr_anterior WHERE tr_anterior.numero_serie = tr.numero_serie AND tr_anterior.id < tr.id AND tr_anterior.status_avaliacao != 'pendente') AS ultima_avaliacao_anterior,
            IF(t_av.numero_serie IS NOT NULL, 1, 0) AS tem_historico_avaria,
            t_av.motivo_desativacao AS motivo_avaria,
            t_av.local_retirada AS local_retirada_avaria,
            t_av.regional AS regional_avaria,
            t_av.data_entrada_almoxarifado AS data_entrada_avaria,
            'REFORMADO' AS tipo_entrada
        FROM trafos_reformados tr
        LEFT JOIN users u ON tr.tecnico_responsavel = u.matricula
        LEFT JOIN transformadores t_av ON t_av.numero_serie = tr.numero_serie
        ${conditions} ORDER BY tr.id DESC`;

  if (getAll !== "true") {
    dataQuery += " LIMIT ? OFFSET ?";
    queryParams.push(limit, (page - 1) * limit);
  }

  const [trafos] = await promisePool.query(dataQuery, queryParams);
  return { trafos, totalItems, totalPages };
}

async function obterCicloPorId(id) {
  const [rows] = await promisePool.query(
    `SELECT tr.*,
      (SELECT COUNT(*) FROM trafos_reformados tr_hist WHERE tr_hist.numero_serie = tr.numero_serie) AS total_ciclos,
      (SELECT MAX(tr_anterior.data_avaliacao) FROM trafos_reformados tr_anterior WHERE tr_anterior.numero_serie = tr.numero_serie AND tr_anterior.id < tr.id AND tr_anterior.status_avaliacao != 'pendente') AS ultima_avaliacao_anterior,
      IF(t_av.numero_serie IS NOT NULL, 1, 0) AS tem_historico_avaria,
      t_av.motivo_desativacao AS motivo_avaria,
      t_av.local_retirada AS local_retirada_avaria,
      t_av.regional AS regional_avaria,
      t_av.data_entrada_almoxarifado AS data_entrada_avaria,
      'REFORMADO' AS tipo_entrada
     FROM trafos_reformados tr
     LEFT JOIN transformadores t_av ON t_av.numero_serie = tr.numero_serie
     WHERE tr.id = ?`,
    [id]
  );
  if (rows.length === 0) {
    throw new Error("Transformador não encontrado");
  }
  return rows[0];
}

async function reverterStatusCiclo(id) {
  const [result] = await promisePool.query(
    "UPDATE trafos_reformados SET status_avaliacao = 'pendente' WHERE id = ?",
    [id]
  );
  if (result.affectedRows === 0) {
    throw new Error("Transformador não encontrado.");
  }
}

async function buscarContextoAvaria(connection, numeroSerie) {
  const [rows] = await connection.query(
    `SELECT motivo_desativacao, local_retirada, regional, data_entrada_almoxarifado
     FROM transformadores WHERE numero_serie = ? LIMIT 1`,
    [numeroSerie]
  );

  if (rows.length === 0) {
    return {
      tem_historico_avaria: 0,
      motivo_avaria: null,
      local_retirada_avaria: null,
      regional_avaria: null,
      data_entrada_avaria: null,
    };
  }

  const trafo = rows[0];
  return {
    tem_historico_avaria: 1,
    motivo_avaria: trafo.motivo_desativacao || null,
    local_retirada_avaria: trafo.local_retirada || null,
    regional_avaria: trafo.regional || null,
    data_entrada_avaria: trafo.data_entrada_almoxarifado || null,
  };
}

async function buscarPendentePorSerie(connection, numeroSerie) {
  const [rows] = await connection.query(
    `SELECT id FROM trafos_reformados
     WHERE numero_serie = ? AND status_avaliacao = 'pendente'
     LIMIT 1`,
    [numeroSerie]
  );
  return rows.length > 0 ? rows[0].id : null;
}

async function contarCiclosPorSerie(connection, numeroSerie) {
  const [rows] = await connection.query(
    "SELECT COUNT(*) AS total FROM trafos_reformados WHERE numero_serie = ?",
    [numeroSerie]
  );
  return rows[0].total || 0;
}

async function inserirCicloReformado(connection, rowData, contextoAvaria) {
  const baseParams = [
    rowData.item,
    rowData.numero_projeto,
    rowData.pot,
    rowData.numero_serie,
    rowData.numero_nota,
    rowData.t_at,
    rowData.t_bt,
    rowData.taps,
    rowData.fabricante,
  ];

  const extendedSql = `INSERT INTO trafos_reformados (
      item, numero_projeto, pot, numero_serie, numero_nota, t_at, t_bt, taps, fabricante,
      tipo_entrada, tem_historico_avaria, motivo_avaria, local_retirada_avaria, regional_avaria, data_entrada_avaria,
      status_avaliacao, data_importacao
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'REFORMADO', ?, ?, ?, ?, ?, 'pendente', CURDATE())`;

  const extendedParams = [
    ...baseParams,
    contextoAvaria.tem_historico_avaria,
    contextoAvaria.motivo_avaria,
    contextoAvaria.local_retirada_avaria,
    contextoAvaria.regional_avaria,
    contextoAvaria.data_entrada_avaria,
  ];

  try {
    await connection.query(extendedSql, extendedParams);
    return;
  } catch (error) {
    if (error.code !== "ER_BAD_FIELD_ERROR") {
      throw error;
    }
  }

  const legacySql = `INSERT INTO trafos_reformados (
      item, numero_projeto, pot, numero_serie, numero_nota, t_at, t_bt, taps, fabricante,
      status_avaliacao, data_importacao
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', CURDATE())`;
  await connection.query(legacySql, baseParams);
}

async function importarCiclos(filePath, options = {}) {
  const dryRun = options.dryRun === true;
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount < 2) {
      throw new Error("Planilha vazia ou formato inválido");
    }
    
    const headerRow = worksheet.getRow(1);
    const headers = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber - 1] = cell.value ? String(cell.value).trim() : "";
    });

    const columnMap = {
      item: headers.findIndex((h) => h.toUpperCase() === "ITEM"),
      numero_projeto: headers.findIndex(
        (h) => h.toUpperCase().includes("PROJETO") || h.toUpperCase().includes("PROJ")
      ),
      pot: headers.findIndex(
        (h) =>
          h.toUpperCase() === "POT" ||
          h.toUpperCase() === "POTENCIA" ||
          h.toUpperCase() === "POTÊNCIA"
      ),
      numero_serie: headers.findIndex(
        (h) =>
          h.toUpperCase().includes("SÉRIE") ||
          h.toUpperCase().includes("SERIE") ||
          h.toUpperCase() === "N. SÉRIE"
      ),
      numero_nota: headers.findIndex(
        (h) => h.toUpperCase().includes("NOTA") || h.toUpperCase() === "N. NOTA"
      ),
      t_at: headers.findIndex(
        (h) => h.toUpperCase().includes("T AT") || h.toUpperCase().includes("TENSÃO AT")
      ),
      t_bt: headers.findIndex(
        (h) => h.toUpperCase().includes("T BT") || h.toUpperCase().includes("TENSÃO BT")
      ),
      taps: headers.findIndex((h) => h.toUpperCase().includes("TAP")),
      fabricante: headers.findIndex((h) => h.toUpperCase().includes("FABRICANTE")),
    };

    const requiredColumns = ["item", "numero_serie", "pot", "fabricante"];
    const missingColumns = requiredColumns.filter((col) => columnMap[col] === -1);
    if (missingColumns.length > 0) {
      throw new Error(
        `Colunas obrigatórias não encontradas na planilha: ${missingColumns.join(", ")}`
      );
    }

    const results = {
      total: worksheet.rowCount - 1,
      imported: 0,
      retorno_pos_avaria: 0,
      retorno_reforma: 0,
      primeira_avaliacao: 0,
      skipped: 0,
      failed: 0,
      errors_details: [],
      skipped_details: [],
      imported_details: [],
    };

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      let numeroSerie = "";
      try {
        const getValue = (key) => {
          const colIndex = columnMap[key];
          if (colIndex === -1) return null;
          const cell = row.getCell(colIndex + 1);
          if (!cell || cell.value === undefined || cell.value === null) return null;
          return String(cell.value).trim();
        };
        
        numeroSerie = getValue("numero_serie");
        if (!numeroSerie) throw new Error("Número de série é obrigatório");
        if (!getValue("item")) throw new Error("Coluna 'Item' é obrigatória.");
        if (!getValue("pot")) throw new Error("Coluna 'Potência (POT)' é obrigatória.");
        if (!getValue("fabricante")) throw new Error("Coluna 'Fabricante' é obrigatória.");

        const pendenteId = await buscarPendentePorSerie(connection, numeroSerie);
        if (pendenteId) {
          results.skipped++;
          results.skipped_details.push({
            linha: rowNumber,
            numero_serie: numeroSerie,
            motivo: `Já existe ciclo pendente (ID ${pendenteId}) para esta série.`,
          });
          continue;
        }

        const ciclosAnteriores = await contarCiclosPorSerie(connection, numeroSerie);
        const contextoAvaria = await buscarContextoAvaria(connection, numeroSerie);
        const rowData = {
          item: getValue("item"),
          numero_projeto: getValue("numero_projeto"),
          pot: getValue("pot"),
          numero_serie: numeroSerie,
          numero_nota: getValue("numero_nota"),
          t_at: getValue("t_at"),
          t_bt: getValue("t_bt"),
          taps: getValue("taps"),
          fabricante: getValue("fabricante"),
        };

        await inserirCicloReformado(connection, rowData, contextoAvaria);
        results.imported++;

        const tipoImportacao =
          contextoAvaria.tem_historico_avaria === 1
            ? "retorno_pos_avaria"
            : ciclosAnteriores > 0
              ? "retorno_reforma"
              : "primeira_avaliacao";

        if (tipoImportacao === "retorno_pos_avaria") {
          results.retorno_pos_avaria++;
        } else if (tipoImportacao === "retorno_reforma") {
          results.retorno_reforma++;
        } else {
          results.primeira_avaliacao++;
        }

        results.imported_details.push({
          linha: rowNumber,
          numero_serie: numeroSerie,
          tipo: tipoImportacao,
          ciclo: ciclosAnteriores + 1,
          motivo_avaria: contextoAvaria.motivo_avaria,
          local_retirada: contextoAvaria.local_retirada_avaria,
        });
      } catch (error) {
        results.failed++;
        results.errors_details.push({
          linha: rowNumber,
          numero_serie: numeroSerie || "",
          erro: error.message,
        });
      }
    }
    if (dryRun) {
      await connection.rollback();
      return { ...results, dry_run: true };
    }

    await connection.commit();
    return { ...results, dry_run: false };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

async function limparPendentes() {
  const [result] = await promisePool.query(
    "DELETE FROM trafos_reformados WHERE status_avaliacao = 'pendente'"
  );
  return result.affectedRows;
}

async function excluirCiclo(id) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const [trafoRows] = await connection.query(
      "SELECT numero_serie FROM trafos_reformados WHERE id = ?",
      [id]
    );
    if (trafoRows.length === 0)
      throw new Error("Transformador não encontrado!");

    const numero_serie = trafoRows[0].numero_serie;
    await connection.query(
      "DELETE FROM trafos_reformados_testes WHERE trafos_reformados_id = ?",
      [id]
    );
    const [result] = await connection.query(
      "DELETE FROM trafos_reformados WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0)
      throw new Error("Ciclo de avaliação não encontrado para exclusão!");

    await connection.commit();
    return { numero_serie };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function listarTecnicosResponsaveis() {
  const [rows] = await promisePool.query(`
        SELECT DISTINCT u.matricula, u.nome 
        FROM users u
        JOIN trafos_reformados tr ON u.matricula = tr.tecnico_responsavel
        ORDER BY u.nome
    `);
  return rows;
}

async function listarFabricantes() {
  const [rows] = await promisePool.query(
    'SELECT DISTINCT fabricante FROM trafos_reformados WHERE fabricante IS NOT NULL AND fabricante != "" ORDER BY fabricante'
  );
  return rows.map((row) => row.fabricante);
}

async function listarPotencias() {
  const [rows] = await promisePool.query(
    'SELECT DISTINCT pot FROM trafos_reformados WHERE pot IS NOT NULL AND pot != "" ORDER BY CAST(pot AS UNSIGNED)'
  );
  return rows.map((row) => row.pot);
}

module.exports = {
  listarCiclos,
  obterCicloPorId,
  reverterStatusCiclo,
  importarCiclos,
  limparPendentes,
  excluirCiclo,
  listarTecnicosResponsaveis,
  listarFabricantes,
  listarPotencias,
};
