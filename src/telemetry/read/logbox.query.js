const { promisePool } = require("../../infrastructure/database");
const { MAX_FAN_RUNTIME_MS } = require("../constants");
const {
  validarTemperatura,
  verificarConexaoAtiva,
  extrairTemperaturaPayload,
  FAN_CONFIG,
} = require("../rules/validation");

async function obterLeituras(serialNumber) {
  const [rows] = await promisePool.query(
    "SELECT payload_json, timestamp_leitura FROM leituras_logbox WHERE serial_number = ? ORDER BY timestamp_leitura DESC LIMIT 300",
    [serialNumber]
  );
  const leiturasValidas = rows.filter((r) => {
    const temp = extrairTemperaturaPayload(r.payload_json);
    return validarTemperatura(temp).valid;
  });
  const reversedRows = leiturasValidas.slice(0, 200).reverse();
  return {
    labels: reversedRows.map((r) => r.timestamp_leitura),
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

  const ultimaLeitura = rows[0].ultima_leitura;
  let status = {};
  try {
    status = typeof rows[0].status_json === "string"
      ? JSON.parse(rows[0].status_json)
      : rows[0].status_json;
  } catch {
    status = {};
  }

  const temp = extrairTemperaturaPayload(status);
  if (!validarTemperatura(temp).valid) {
    status.ch_analog_1 = null;
    status.temperature_error = "Valor inválido no banco de dados";
  }

  const conexao = verificarConexaoAtiva(ultimaLeitura);
  status.connection_status = conexao.online ? "online" : "offline";
  status.last_seen_minutes = conexao.minutes_ago || conexao.minutes_offline;

  if (temp !== null && validarTemperatura(temp).valid) {
    status.fan_status = temp >= FAN_CONFIG.TEMP_ON
      ? "ON"
      : temp <= FAN_CONFIG.TEMP_OFF
        ? "OFF"
        : "HOLD";
  }

  const [[fanCount]] = await promisePool.query(
    "SELECT COUNT(*) as count FROM historico_ventilacao WHERE serial_number = ? AND timestamp_inicio >= CURDATE()",
    [serialNumber]
  );
  status.fan_daily_count = fanCount ? fanCount.count : 0;

  return status;
}

async function obterUltimaLeitura(serialNumber) {
  const [rows] = await promisePool.query(
    "SELECT payload_json as payload, timestamp_leitura FROM leituras_logbox WHERE serial_number = ? ORDER BY timestamp_leitura DESC LIMIT 10",
    [serialNumber]
  );

  if (rows.length === 0) {
    throw new Error("Nenhuma leitura encontrada");
  }

  const ultimaValida = rows.find((row) => {
    const temp = extrairTemperaturaPayload(row.payload);
    return validarTemperatura(temp).valid;
  });

  const ultimas5Validas = rows
    .map((row) => ({
      timestamp: row.timestamp_leitura,
      valor: extrairTemperaturaPayload(row.payload),
    }))
    .filter((item) => validarTemperatura(item.valor).valid)
    .slice(0, 5)
    .reverse();

  return {
    latest: ultimaValida || rows[0],
    recent_readings: ultimas5Validas,
  };
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

async function obterEstatisticasVentilacao(serialNumber) {
  const [rows] = await promisePool.query(
    `SELECT COUNT(*) as total_count, MIN(duracao_segundos) as min_duration, MAX(duracao_segundos) as max_duration, AVG(duracao_segundos) as avg_duration FROM historico_ventilacao WHERE serial_number = ? AND duracao_segundos IS NOT NULL`,
    [serialNumber]
  );
  const stats = rows[0];
  return {
    total_count: stats.total_count || 0,
    min_duration: stats.min_duration ? Math.round(stats.min_duration) : 0,
    max_duration: stats.max_duration ? Math.round(stats.max_duration) : 0,
    avg_duration: stats.avg_duration ? Math.round(stats.avg_duration) : 0,
  };
}

async function obterHistoricoVentilacao(serialNumber) {
  const [history] = await promisePool.query(
    "SELECT timestamp_inicio, timestamp_fim, duracao_segundos FROM historico_ventilacao WHERE serial_number = ? ORDER BY timestamp_inicio DESC LIMIT 50",
    [serialNumber]
  );
  const now = new Date();
  return history.map((item) => {
    if (item.timestamp_fim) return item;
    const inicio = new Date(item.timestamp_inicio);
    const diff = now - inicio;
    if (diff > MAX_FAN_RUNTIME_MS) {
      return {
        ...item,
        timestamp_fim: new Date(inicio.getTime() + MAX_FAN_RUNTIME_MS),
        duracao_segundos: MAX_FAN_RUNTIME_MS / 1000,
        status: "Erro: Tempo Excedido",
      };
    }
    return {
      ...item,
      duracao_segundos: Math.floor(diff / 1000),
      status: "Em andamento",
    };
  });
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

module.exports = {
  obterLeituras,
  obterStatus,
  obterUltimaLeitura,
  obterEstatisticas,
  obterEstatisticasVentilacao,
  obterHistoricoVentilacao,
  obterHistoricoConexao,
};
