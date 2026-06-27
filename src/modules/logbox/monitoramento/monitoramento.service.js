const { promisePool } = require("../../../infrastructure/database");
const { PDFDocument, StandardFonts } = require("pdf-lib");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const {
  validarTemperatura,
  extrairTemperaturaPayload,
} = require("../../../telemetry/rules/validation");
const {
  obterLeituras,
  obterStatus,
  obterUltimaLeitura,
  obterEstatisticas,
  obterEstatisticasVentilacao,
  obterHistoricoVentilacao,
  obterHistoricoConexao,
} = require("../../../telemetry/read/logbox.query");

async function getReportData(filters) {
  const { deviceId, reportType, date, month, year } = filters;
  let startDate;
  let endDate;

  switch (reportType) {
    case "monthly":
      startDate = new Date(`${month}-01T00:00:00`);
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case "annual":
      startDate = new Date(`${year}-01-01T00:00:00`);
      endDate = new Date(`${year}-12-31T23:59:59`);
      break;
    default:
      startDate = new Date(`${date}T00:00:00`);
      endDate = new Date(`${date}T23:59:59`);
      break;
  }

  const [deviceRows] = await promisePool.query(
    "SELECT * FROM dispositivos_logbox WHERE id = ?",
    [deviceId]
  );
  if (deviceRows.length === 0) {
    throw new Error("Dispositivo não encontrado");
  }

  const deviceInfo = deviceRows[0];
  let chartData = { labels: [], datasets: [] };
  let processedReadings = [];

  if (reportType === "detailed") {
    const [readings] = await promisePool.query(
      "SELECT payload_json, timestamp_leitura FROM leituras_logbox WHERE serial_number = ? AND timestamp_leitura BETWEEN ? AND ? ORDER BY timestamp_leitura ASC",
      [deviceInfo.serial_number, startDate, endDate]
    );
    processedReadings = readings
      .map((r) => ({
        temperatura_externa: extrairTemperaturaPayload(r.payload_json),
        timestamp_leitura: r.timestamp_leitura,
      }))
      .filter((r) => validarTemperatura(r.temperatura_externa).valid);

    chartData.labels = processedReadings.map((r) =>
      new Date(r.timestamp_leitura).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );

    chartData.datasets.push(
      { label: "Min", data: [] },
      {
        label: "Temperatura",
        data: processedReadings.map((r) => r.temperatura_externa),
      }
    );
  } else {
    const [aggregated] = await promisePool.query(
      `SELECT DATE(timestamp_leitura) as data_dia, MIN(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as min_temp, AVG(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as avg_temp, MAX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as max_temp FROM leituras_logbox WHERE serial_number = ? AND timestamp_leitura BETWEEN ? AND ? GROUP BY DATE(timestamp_leitura) ORDER BY data_dia ASC`,
      [deviceInfo.serial_number, startDate, endDate]
    );
    chartData.labels = aggregated.map((r) =>
      new Date(r.data_dia).toLocaleDateString("pt-BR")
    );

    chartData.datasets.push(
      { label: "Mínima", data: aggregated.map((r) => r.min_temp) },
      { label: "Média", data: aggregated.map((r) => r.avg_temp) },
      { label: "Máxima", data: aggregated.map((r) => r.max_temp) }
    );
  }

  const [stats] = await promisePool.query(
    `SELECT MIN(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as temp_min, AVG(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as temp_avg, MAX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as temp_max, COUNT(*) as total_count FROM leituras_logbox WHERE serial_number = ? AND timestamp_leitura BETWEEN ? AND ?`,
    [deviceInfo.serial_number, startDate, endDate]
  );

  const fanHistory = await obterHistoricoVentilacao(deviceInfo.serial_number);
  const fanHistoryFiltrado = fanHistory.filter((h) => {
    const dataInicio = new Date(h.timestamp_inicio);
    return dataInicio >= startDate && dataInicio <= endDate;
  });

  let fanHistoryAgregado = [];
  if (reportType !== "detailed") {
    const mapAgregado = {};
    fanHistoryFiltrado.forEach((item) => {
      const key = new Date(item.timestamp_inicio).toLocaleDateString("pt-BR");
      if (!mapAgregado[key]) {
        mapAgregado[key] = { dia: key, count: 0, total_duration: 0 };
      }
      mapAgregado[key].count++;
      mapAgregado[key].total_duration += item.duracao_segundos || 0;
    });
    fanHistoryAgregado = Object.values(mapAgregado);
  }

  const [connectionHistory] = await promisePool.query(
    "SELECT * FROM historico_conexao WHERE serial_number = ? AND timestamp_offline >= ? AND timestamp_offline <= ? ORDER BY timestamp_offline DESC",
    [deviceInfo.serial_number, startDate, endDate]
  );

  return {
    device: deviceInfo,
    filters: { ...filters, startDate, endDate },
    readings: processedReadings,
    chartData,
    stats: stats[0],
    fanHistory: fanHistoryFiltrado,
    fanHistoryAgregado,
    connectionHistory,
  };
}

async function gerarPdfRelatorio(filters) {
  const data = await getReportData(filters);
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 800, height: 400 });
  let datasets = [];
  const labels = data.chartData.labels;

  if (filters.reportType === "detailed") {
    datasets.push({
      label: "Temperatura (°C)",
      data: data.chartData.datasets[1].data,
      borderColor: "rgb(75, 192, 192)",
      borderWidth: 2,
      tension: 0.1,
      pointRadius: 0,
    });
  } else {
    datasets.push({
      label: "Média (°C)",
      data: data.chartData.datasets[1].data,
      borderColor: "rgb(255, 159, 64)",
      borderWidth: 2,
    });
  }

  const configuration = {
    type: "line",
    data: { labels, datasets },
    options: {
      scales: { y: { beginAtZero: false } },
      plugins: { legend: { display: true } },
    },
  };

  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const image = await pdfDoc.embedPng(imageBuffer);
  const imageDims = image.scale(0.6);

  page.drawText(`Relatório de Monitoramento - ${data.device.local_tag}`, {
    x: 50,
    y: height - 50,
    font,
    size: 18,
  });

  const periodo = `${new Date(data.filters.startDate).toLocaleDateString("pt-BR")} a ${new Date(data.filters.endDate).toLocaleDateString("pt-BR")}`;
  page.drawText(`Período: ${periodo}`, { x: 50, y: height - 75, font, size: 12 });
  page.drawImage(image, {
    x: 50,
    y: height - 120 - imageDims.height,
    width: imageDims.width,
    height: imageDims.height,
  });

  const y = height - 140 - imageDims.height;
  page.drawText(
    `Estatísticas: Mín: ${parseFloat(data.stats.temp_min).toFixed(1)}°C | Méd: ${parseFloat(data.stats.temp_avg).toFixed(1)}°C | Máx: ${parseFloat(data.stats.temp_max).toFixed(1)}°C`,
    { x: 50, y, font, size: 10 }
  );

  return pdfDoc.save();
}

module.exports = {
  getReportData,
  gerarPdfRelatorio,
  obterLeituras,
  obterStatus,
  obterUltimaLeitura,
  obterEstatisticas,
  obterEstatisticasVentilacao,
  obterHistoricoVentilacao,
  obterHistoricoConexao,
};
