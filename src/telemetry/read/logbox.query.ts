import { promisePool } from "../../infrastructure/database";
import { MAX_FAN_RUNTIME_MS } from "../constants";
import {
  validarTemperatura,
  verificarConexaoAtiva,
  extrairTemperaturaPayload,
  FAN_CONFIG,
} from "../rules/validation";
import type {
  FanStats,
  LogboxDeviceStatus,
  LogboxPayload,
  ReadingsChartData,
  StatsPeriod,
} from "../types";

interface ReadingRow {
  payload_json: string | LogboxPayload;
  timestamp_leitura: Date | string;
}

interface LatestReadingRow {
  payload: string | LogboxPayload;
  timestamp_leitura: Date | string;
}

interface DeviceStatusRow {
  status_json: string | LogboxPayload;
  ultima_leitura: Date | string | null;
}

interface StatsRow {
  min: string | number | null;
  avg: string | number | null;
  max: string | number | null;
}

interface VentilationHistoryRow {
  timestamp_inicio: Date | string;
  timestamp_fim?: Date | string | null;
  duracao_segundos?: number | null;
  status?: string;
}

export async function obterLeituras(serialNumber: string): Promise<ReadingsChartData> {
  const [rows] = await promisePool.query(
    "SELECT payload_json, timestamp_leitura FROM leituras_logbox WHERE serial_number = ? ORDER BY timestamp_leitura DESC LIMIT 300",
    [serialNumber]
  ) as [ReadingRow[], unknown];

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

export async function obterStatus(serialNumber: string): Promise<LogboxDeviceStatus> {
  const [rows] = await promisePool.query(
    "SELECT status_json, ultima_leitura FROM dispositivos_logbox WHERE serial_number = ?",
    [serialNumber]
  ) as [DeviceStatusRow[], unknown];

  if (rows.length === 0 || !rows[0].status_json) {
    throw new Error("Status não encontrado");
  }

  const ultimaLeitura = rows[0].ultima_leitura;
  let status: LogboxDeviceStatus;

  try {
    status =
      typeof rows[0].status_json === "string"
        ? JSON.parse(rows[0].status_json)
        : (rows[0].status_json as LogboxDeviceStatus);
  } catch {
    status = { connection_status: "offline" };
  }

  const temp = extrairTemperaturaPayload(status);
  if (!validarTemperatura(temp).valid) {
    status.ch_analog_1 = undefined;
    status.temperature_error = "Valor inválido no banco de dados";
  }

  const conexao = verificarConexaoAtiva(ultimaLeitura);
  status.connection_status = conexao.online ? "online" : "offline";
  status.last_seen_minutes = conexao.online
    ? conexao.minutes_ago
    : (conexao.minutes_offline ?? undefined);

  if (temp !== null && validarTemperatura(temp).valid) {
    status.fan_status =
      temp >= FAN_CONFIG.TEMP_ON
        ? "ON"
        : temp <= FAN_CONFIG.TEMP_OFF
          ? "OFF"
          : "HOLD";
  }

  const [[fanCount]] = await promisePool.query(
    "SELECT COUNT(*) as count FROM historico_ventilacao WHERE serial_number = ? AND timestamp_inicio >= CURDATE()",
    [serialNumber]
  ) as [{ count: number }[], unknown];

  status.fan_daily_count = fanCount?.count ?? 0;

  return status;
}

export async function obterUltimaLeitura(serialNumber: string) {
  const [rows] = await promisePool.query(
    "SELECT payload_json as payload, timestamp_leitura FROM leituras_logbox WHERE serial_number = ? ORDER BY timestamp_leitura DESC LIMIT 10",
    [serialNumber]
  ) as [LatestReadingRow[], unknown];

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
    latest: ultimaValida ?? rows[0],
    recent_readings: ultimas5Validas,
  };
}

export async function obterEstatisticas(
  serialNumber: string
): Promise<{ today: StatsPeriod; month: StatsPeriod }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const month = new Date(today.getFullYear(), today.getMonth(), 1);

  const [[todayStats]] = await promisePool.query(
    "SELECT MIN(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as min, AVG(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as avg, MAX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as max FROM leituras_logbox WHERE serial_number = ? AND timestamp_leitura >= ?",
    [serialNumber, today]
  ) as [StatsRow[], unknown];

  const [[monthStats]] = await promisePool.query(
    "SELECT MIN(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as min, AVG(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as avg, MAX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.ch_analog_1'))) as max FROM leituras_logbox WHERE serial_number = ? AND timestamp_leitura >= ?",
    [serialNumber, month]
  ) as [StatsRow[], unknown];

  const format = (stats: StatsRow): StatsPeriod => ({
    min: stats.min ? parseFloat(String(stats.min)).toFixed(1) : "N/A",
    avg: stats.avg ? parseFloat(String(stats.avg)).toFixed(1) : "N/A",
    max: stats.max ? parseFloat(String(stats.max)).toFixed(1) : "N/A",
  });

  return { today: format(todayStats), month: format(monthStats) };
}

export async function obterEstatisticasVentilacao(serialNumber: string): Promise<FanStats> {
  const [rows] = await promisePool.query(
    `SELECT COUNT(*) as total_count, MIN(duracao_segundos) as min_duration, MAX(duracao_segundos) as max_duration, AVG(duracao_segundos) as avg_duration FROM historico_ventilacao WHERE serial_number = ? AND duracao_segundos IS NOT NULL`,
    [serialNumber]
  ) as [FanStats[], unknown];

  const stats = rows[0];
  return {
    total_count: stats?.total_count ?? 0,
    min_duration: stats?.min_duration ? Math.round(Number(stats.min_duration)) : 0,
    max_duration: stats?.max_duration ? Math.round(Number(stats.max_duration)) : 0,
    avg_duration: stats?.avg_duration ? Math.round(Number(stats.avg_duration)) : 0,
  };
}

export async function obterHistoricoVentilacao(
  serialNumber: string
): Promise<VentilationHistoryRow[]> {
  const [history] = await promisePool.query(
    "SELECT timestamp_inicio, timestamp_fim, duracao_segundos FROM historico_ventilacao WHERE serial_number = ? ORDER BY timestamp_inicio DESC LIMIT 50",
    [serialNumber]
  ) as [VentilationHistoryRow[], unknown];

  const now = Date.now();
  return history.map((item) => {
    if (item.timestamp_fim) return item;

    const inicio = new Date(item.timestamp_inicio);
    const diff = now - inicio.getTime();

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

export async function obterHistoricoConexao(serialNumber: string) {
  const [history] = await promisePool.query(
    "SELECT * FROM historico_conexao WHERE serial_number = ? ORDER BY timestamp_offline DESC LIMIT 100",
    [serialNumber]
  ) as [Record<string, unknown>[], unknown];

  const [[summary]] = await promisePool.query(
    "SELECT COUNT(*) as total_disconnects, AVG(duracao_segundos) as avg_duration FROM historico_conexao WHERE serial_number = ?",
    [serialNumber]
  ) as [{ total_disconnects: number; avg_duration: number | null }[], unknown];

  return {
    summary: {
      total_disconnects: summary?.total_disconnects ?? 0,
      avg_duration_seconds: summary?.avg_duration ?? 0,
    },
    history,
  };
}
