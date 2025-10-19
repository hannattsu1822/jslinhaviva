const { promisePool } = require("../../../init");
const ExcelJS = require("exceljs");

async function listarRegistrosPrv(filtros) {
  const { veiculoId, dataInicio, dataFim } = filtros;
  if (!veiculoId || !dataInicio || !dataFim) {
    throw new Error("Veículo e período de datas são obrigatórios.");
  }

  const sql = `
    SELECT 
      r.*, 
      v.placa, 
      v.modelo,
      STR_TO_DATE(CONCAT(r.dia, '/', r.mes_ano_referencia), '%d/%m/%Y') as dia
    FROM prv_registros r
    JOIN veiculos_frota v ON r.veiculo_id = v.id
    WHERE r.veiculo_id = ? 
      AND STR_TO_DATE(CONCAT(r.dia, '/', r.mes_ano_referencia), '%d/%m/%Y') BETWEEN ? AND ?
    ORDER BY dia, r.saida_horario
  `;
  const [registros] = await promisePool.query(sql, [
    veiculoId,
    dataInicio,
    dataFim,
  ]);

  if (registros.length === 0) {
    const [veiculoRows] = await promisePool.query(
      "SELECT placa, modelo FROM veiculos_frota WHERE id = ?",
      [veiculoId]
    );
    return {
      veiculo: veiculoRows[0] || {},
      registros: [],
    };
  }

  return {
    veiculo: {
      placa: registros[0].placa,
      modelo: registros[0].modelo,
    },
    registros: registros,
  };
}

async function exportarRegistrosPrv(filtros) {
  const { veiculoId, dataInicio, dataFim } = filtros;
  if (!veiculoId || !dataInicio || !dataFim) {
    throw new Error("Veículo e período de datas são obrigatórios.");
  }

  const sql = `
    SELECT 
      r.*, 
      v.placa, 
      v.modelo,
      u.nome as nome_motorista,
      STR_TO_DATE(CONCAT(r.dia, '/', r.mes_ano_referencia), '%d/%m/%Y') as dia_completo
    FROM prv_registros r
    JOIN veiculos_frota v ON r.veiculo_id = v.id
    LEFT JOIN users u ON r.motorista_matricula = u.matricula
    WHERE r.veiculo_id = ? 
      AND STR_TO_DATE(CONCAT(r.dia, '/', r.mes_ano_referencia), '%d/%m/%Y') BETWEEN ? AND ?
    ORDER BY dia_completo, r.saida_horario
  `;
  const [registros] = await promisePool.query(sql, [
    veiculoId,
    dataInicio,
    dataFim,
  ]);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Roteiro de Viagem");

  worksheet.mergeCells("A1:K1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "PLANILHA ROTEIRO DE VIAGEM DO VEÍCULO - PRV";
  titleCell.font = { name: "Arial", size: 16, bold: true };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };

  const veiculoInfo =
    registros.length > 0
      ? `${registros[0].placa} / ${registros[0].modelo}`
      : "N/A";

  const formatDate = (dateStr) => {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  worksheet.getCell("A3").value = "Placa/Tipo:";
  worksheet.getCell("B3").value = veiculoInfo;
  worksheet.getCell("A4").value = "Período:";
  worksheet.getCell("B4").value = `${formatDate(dataInicio)} a ${formatDate(
    dataFim
  )}`;

  const headerRow = worksheet.getRow(6);
  headerRow.values = [
    "DATA",
    "SAÍDA",
    "",
    "",
    "CHEGADA",
    "",
    "",
    "MOTORISTA/MATRÍCULA",
    "PROCESSO",
    "TIPO DE SERVIÇO",
  ];
  worksheet.mergeCells("B6:D6");
  worksheet.mergeCells("E6:G6");

  const subHeaderRow = worksheet.getRow(7);
  subHeaderRow.values = [
    "",
    "HORÁRIO",
    "LOCAL",
    "KM",
    "HORÁRIO",
    "LOCAL",
    "KM",
  ];

  ["A6", "H6", "I6", "J6"].forEach((cell) => {
    worksheet.mergeCells(`${cell}:${cell.charAt(0)}7`);
    worksheet.getCell(cell).alignment = {
      vertical: "middle",
      horizontal: "center",
    };
  });

  const headerCells = [
    "A6",
    "B6",
    "E6",
    "H6",
    "I6",
    "J6",
    "B7",
    "C7",
    "D7",
    "E7",
    "F7",
    "G7",
  ];
  headerCells.forEach((cell) => {
    worksheet.getCell(cell).font = { bold: true };
    worksheet.getCell(cell).alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    worksheet.getCell(cell).border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  registros.forEach((r) => {
    const motoristaFormatado = r.nome_motorista
      ? `${r.nome_motorista} - ${r.motorista_matricula}`
      : r.motorista_matricula;

    worksheet.addRow([
      r.dia_completo,
      r.saida_horario,
      r.saida_local,
      r.saida_km,
      r.chegada_horario,
      r.chegada_local,
      r.chegada_km,
      motoristaFormatado,
      r.processo,
      r.tipo_servico,
    ]);
  });

  worksheet.columns = [
    { key: "dia", width: 12, style: { numFmt: "dd/mm/yyyy" } },
    { key: "saida_h", width: 10 },
    { key: "saida_l", width: 25 },
    { key: "saida_k", width: 10 },
    { key: "chegada_h", width: 10 },
    { key: "chegada_l", width: 25 },
    { key: "chegada_k", width: 10 },
    { key: "motorista", width: 35 },
    { key: "processo", width: 15 },
    { key: "servico", width: 30 },
  ];

  const fileName = `PRV_${
    veiculoInfo.split(" / ")[0]
  }_${dataInicio}_a_${dataFim}.xlsx`;

  return { workbook, fileName };
}

module.exports = {
  listarRegistrosPrv,
  exportarRegistrosPrv,
};
