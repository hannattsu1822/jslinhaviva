const { promisePool } = require("../../../init");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");

// --- CORREÇÃO AQUI ---
// Mudamos de "./helpers..." para "../helpers..." para subir um nível e achar a pasta correta
const { 
  validarTemperatura, 
  verificarConexaoAtiva, 
  extrairTemperaturaPayload 
} = require("../helpers/validation.helper");

async function getReportData(filters) {
  const { deviceId, reportType, date, month, year } = filters;
  let deviceInfo = null;
  let startDate, endDate;

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

  deviceInfo = deviceRows[0];

  let chartData = { labels: [], datasets: [] };
  let processedReadings = [];

  if (reportType === "detailed") {
    const [readings] = await promisePool.query(
      "SELECT payload_json, timestamp_leitura FROM leituras_logbox WHERE serial_number = ? AND timestamp_leitura BETWEEN ? AND ? ORDER BY timestamp_leitura ASC",
      [deviceInfo.serial_number, startDate, endDate]
    );

    processedReadings = readings.map((r) => {
      const temp = extrairTemperaturaPayload(r.payload_json);
      return {
        temperatura_externa: temp,
        timestamp_leitura: r.timestamp_leitura,
      };
    }).filter(r => validarTemperatura(r.temperatura_externa).valid);

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
      `SELECT
        DATE(timestamp_leitura) as data_dia,
        MIN(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as min_temp,
        AVG(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as avg_temp,
        MAX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as max_temp
      FROM leituras_logbox
      WHERE serial_number = ? AND timestamp_leitura BETWEEN ? AND ?
      GROUP BY DATE(timestamp_leitura)
      ORDER BY data_dia ASC`,
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
    `SELECT
      MIN(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as temp_min,
      AVG(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as temp_avg,
      MAX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as temp_max,
      COUNT(*) as total_count
    FROM leituras_logbox
    WHERE serial_number = ? AND timestamp_leitura BETWEEN ? AND ?`,
    [deviceInfo.serial_number, startDate, endDate]
  );

  const [fanHistory] = await promisePool.query(
    "SELECT * FROM historico_ventilacao WHERE serial_number = ? AND timestamp_inicio >= ? AND timestamp_inicio <= ? ORDER BY timestamp_inicio DESC",
    [deviceInfo.serial_number, startDate, endDate]
  );

  let fanHistoryAgregado = [];
  if (reportType !== "detailed") {
    const mapAgregado = {};
    fanHistory.forEach((item) => {
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
    chartData: chartData,
    stats: stats[0],
    fanHistory,
    fanHistoryAgregado,
    connectionHistory,
  };
}

async function obterLeituras(serialNumber) {
  const [rows] = await promisePool.query(
    "SELECT payload_json, timestamp_leitura FROM leituras_logbox WHERE serial_number = ? ORDER BY timestamp_leitura DESC LIMIT 300",
    [serialNumber]
  );

  const leiturasValidas = rows.filter(r => {
    const temp = extrairTemperaturaPayload(r.payload_json);
    return validarTemperatura(temp).valid;
  });

  const reversedRows = leiturasValidas.slice(0, 200).reverse();

  return {
    labels: reversedRows.map((r) =>
      new Date(r.timestamp_leitura).toLocaleString("pt-BR")
    ),
    temperaturas: reversedRows.map((r) => extrairTemperaturaPayload(r.payload_json)),
  };
}

async function obterStatus(serialNumber) {
  const [rows] = await promisePool.query(
    "SELECT status_json, ultima_leitura FROM dispositivos_logbox WHERE serial_number = ?",
    [serialNumber]
  );

  if (rows.length === 0 || !rows[0].status_json) {
    throw new Error("Status não encontrado");
  }

  let status = {};
  try {
    status = typeof rows[0].status_json === "string" 
      ? JSON.parse(rows[0].status_json) 
      : rows[0].status_json;
  } catch (e) {
    status = {};
  }

  const conexao = verificarConexaoAtiva(rows[0].ultima_leitura);
  
  status.connection_status = conexao.online ? 'online' : 'offline';
  status.last_seen_minutes = conexao.minutes_ago || conexao.minutes_offline;

  return status;
}

async function obterUltimaLeitura(serialNumber) {
  const [latest] = await promisePool.query(
    "SELECT payload_json as payload, timestamp_leitura FROM leituras_logbox WHERE serial_number = ? ORDER BY timestamp_leitura DESC LIMIT 1",
    [serialNumber]
  );

  if (latest.length === 0) {
    throw new Error("Nenhuma leitura encontrada");
  }

  return latest[0];
}

async function obterEstatisticas(serialNumber) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const month = new Date(today.getFullYear(), today.getMonth(), 1);

  const [[todayStats]] = await promisePool.query(
    "SELECT MIN(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as min, AVG(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as avg, MAX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as max FROM leituras_logbox WHERE serial_number = ? AND timestamp_leitura >= ?",
    [serialNumber, today]
  );

  const [[monthStats]] = await promisePool.query(
    "SELECT MIN(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as min, AVG(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as avg, MAX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as max FROM leituras_logbox WHERE serial_number = ? AND timestamp_leitura >= ?",
    [serialNumber, month]
  );

  const format = (stats) => ({
    min: stats.min ? parseFloat(stats.min).toFixed(1) : "N/A",
    avg: stats.avg ? parseFloat(stats.avg).toFixed(1) : "N/A",
    max: stats.max ? parseFloat(stats.max).toFixed(1) : "N/A",
  });

  return { today: format(todayStats), month: format(monthStats) };
}

async function obterHistoricoVentilacao(serialNumber) {
  const [history] = await promisePool.query(
    "SELECT timestamp_inicio, timestamp_fim, duracao_segundos FROM historico_ventilacao WHERE serial_number = ? ORDER BY timestamp_inicio DESC LIMIT 50",
    [serialNumber]
  );

  return history;
}

async function obterHistoricoConexao(serialNumber) {
  const [history] = await promisePool.query(
    "SELECT * FROM historico_conexao WHERE serial_number = ? ORDER BY timestamp_offline DESC LIMIT 100",
    [serialNumber]
  );

  const [[summary]] = await promisePool.query(
    "SELECT COUNT(*) as total_disconnects, AVG(duracao_segundos) as avg_duration FROM historico_conexao WHERE serial_number = ?",
    [serialNumber]
  );

  return {
    summary: {
      total_disconnects: summary.total_disconnects || 0,
      avg_duration_seconds: summary.avg_duration || 0,
    },
    history,
  };
}

async function gerarPdfRelatorio(filters) {
  const data = await getReportData(filters);
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 800, height: 400 });

  let datasets = [];
  let labels = data.chartData.labels;

  if (filters.reportType === 'detailed') {
    datasets.push({
      label: "Temperatura (°C)",
      data: data.chartData.datasets[1].data,
      borderColor: "rgb(75, 192, 192)",
      borderWidth: 2,
      tension: 0.1,
      pointRadius: 0
    });
  } else {
    datasets.push({
      label: "Média (°C)",
      data: data.chartData.datasets[1].data,
      borderColor: "rgb(255, 159, 64)",
      borderWidth: 2
    });
  }

  const configuration = {
    type: "line",
    data: {
      labels: labels,
      datasets: datasets,
    },
    options: {
      scales: { y: { beginAtZero: false } },
      plugins: { legend: { display: true } }
    },
  };

  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const image = await pdfDoc.embedPng(imageBuffer);
  const imageDims = image.scale(0.6);

  page.drawText(`Relatório de Monitoramento - ${data.device.local_tag}`, {
    x: 50,
    y: height - 50,
    font,
    size: 18,
  });

  const periodo = `${new Date(data.filters.startDate).toLocaleDateString('pt-BR')} a ${new Date(data.filters.endDate).toLocaleDateString('pt-BR')}`;
  page.drawText(`Período: ${periodo}`, { x: 50, y: height - 75, font, size: 12 });

  page.drawImage(image, {
    x: 50,
    y: height - 120 - imageDims.height,
    width: imageDims.width,
    height: imageDims.height,
  });

  let y = height - 140 - imageDims.height;
  page.drawText(`Estatísticas: Mín: ${parseFloat(data.stats.temp_min).toFixed(1)}°C | Méd: ${parseFloat(data.stats.temp_avg).toFixed(1)}°C | Máx: ${parseFloat(data.stats.temp_max).toFixed(1)}°C`, {
    x: 50, y, font, size: 10
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

module.exports = {
  getReportData,
  obterLeituras,
  obterStatus,
  obterUltimaLeitura,
  obterEstatisticas,
  obterHistoricoVentilacao,
  obterHistoricoConexao,
  gerarPdfRelatorio,
};
