const { promisePool } = require("../../../init");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");

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

  const [readings] = await promisePool.query(
    "SELECT payload_json, timestamp_leitura FROM leituras_logbox WHERE serial_number = ? AND timestamp_leitura BETWEEN ? AND ? ORDER BY timestamp_leitura ASC",
    [deviceInfo.serial_number, startDate, endDate]
  );

  const processedReadings = readings.map((r) => {
    const payload = JSON.parse(r.payload_json);
    return {
      temperatura_externa:
        payload.ch_analog_1 ||
        (payload.value_channels ? payload.value_channels[2] : null),
      timestamp_leitura: r.timestamp_leitura,
    };
  });

  const [stats] = await promisePool.query(
    "SELECT MIN(JSON_EXTRACT(payload_json, '$.ch_analog_1')) as temp_min, AVG(JSON_EXTRACT(payload_json, '$.ch_analog_1')) as temp_avg, MAX(JSON_EXTRACT(payload_json, '$.ch_analog_1')) as temp_max FROM leituras_logbox WHERE serial_number = ? AND timestamp_leitura BETWEEN ? AND ?",
    [deviceInfo.serial_number, startDate, endDate]
  );
  const [fanHistory] = await promisePool.query(
    "SELECT * FROM historico_ventilacao WHERE dispositivo_id = ? AND timestamp_inicio >= ? AND timestamp_inicio <= ? ORDER BY timestamp_inicio DESC",
    [deviceId, startDate, endDate]
  );
  const [connectionHistory] = await promisePool.query(
    "SELECT * FROM historico_conexao WHERE serial_number = ? AND timestamp_offline >= ? AND timestamp_offline <= ? ORDER BY timestamp_offline DESC",
    [deviceInfo.serial_number, startDate, endDate]
  );

  return {
    device: deviceInfo,
    filters: { ...filters, startDate, endDate },
    readings: processedReadings,
    stats: stats[0],
    fanHistory,
    connectionHistory,
  };
}

async function obterLeituras(serialNumber) {
  const [rows] = await promisePool.query(
    "SELECT payload_json, timestamp_leitura FROM leituras_logbox WHERE serial_number = ? ORDER BY timestamp_leitura DESC LIMIT 200",
    [serialNumber]
  );
  const reversedRows = rows.reverse();
  return {
    labels: reversedRows.map((r) =>
      new Date(r.timestamp_leitura).toLocaleString("pt-BR")
    ),
    temperaturas: reversedRows.map((r) => {
      const payload = JSON.parse(r.payload_json);
      return (
        payload.ch_analog_1 ||
        (payload.value_channels ? payload.value_channels[2] : null)
      );
    }),
  };
}

async function obterStatus(serialNumber) {
  const [rows] = await promisePool.query(
    "SELECT status_json FROM dispositivos_logbox WHERE serial_number = ?",
    [serialNumber]
  );
  if (rows.length === 0 || !rows[0].status_json) {
    throw new Error("Status não encontrado");
  }
  return rows[0].status_json;
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
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 700, height: 350 });
  const configuration = {
    type: "line",
    data: {
      labels: data.readings.map((r) =>
        new Date(r.timestamp_leitura).toLocaleDateString("pt-BR")
      ),
      datasets: [
        {
          label: "Temperatura (°C)",
          data: data.readings.map((r) => r.temperatura_externa),
          borderColor: "rgb(75, 192, 192)",
          tension: 0.1,
        },
      ],
    },
    options: {
      scales: { y: { beginAtZero: false } },
      animation: { duration: 0 },
    },
  };
  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const image = await pdfDoc.embedPng(imageBuffer);
  const imageDims = image.scale(0.5);

  page.drawText(`Relatório de Monitoramento - ${data.device.local_tag}`, {
    x: 50,
    y: height - 50,
    font,
    size: 18,
  });
  page.drawImage(image, {
    x: 50,
    y: height - 100 - imageDims.height,
    width: imageDims.width,
    height: imageDims.height,
  });

  let y = height - 120 - imageDims.height;
  data.readings.forEach((reading) => {
    if (y < 40) {
      page.addPage();
      y = height - 40;
    }
    page.drawText(
      `${new Date(reading.timestamp_leitura).toLocaleString(
        "pt-BR"
      )}: ${reading.temperatura_externa.toFixed(1)}°C`,
      { x: 50, y, font, size: 10 }
    );
    y -= 15;
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
