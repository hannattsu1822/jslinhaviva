import {
  TEMP_LIMITS,
  FAN_CONFIG,
  CONNECTION_TIMEOUT_MS,
} from "../constants";
import type {
  ConnectionCheck,
  ConnectionStatus,
  DeviceStatusValidation,
  FanStateAnalysis,
  LogboxPayload,
  SanitizedReading,
  TemperatureValidation,
} from "../types";

export { TEMP_LIMITS, FAN_CONFIG, CONNECTION_TIMEOUT_MS };

export function validarTemperatura(
  temp: unknown
): TemperatureValidation {
  if (temp === null || temp === undefined || Number.isNaN(Number(temp))) {
    return { valid: false, reason: "Valor nulo ou não numérico" };
  }

  const tempNum = parseFloat(String(temp));

  if (tempNum < TEMP_LIMITS.MIN_VALID || tempNum > TEMP_LIMITS.MAX_VALID) {
    return {
      valid: false,
      reason: `Fora do intervalo aceitável (${TEMP_LIMITS.MIN_VALID} a ${TEMP_LIMITS.MAX_VALID})`,
      value: tempNum,
    };
  }

  return { valid: true, value: tempNum };
}

export function verificarConexaoAtiva(
  ultimaLeitura: Date | string | null | undefined
): ConnectionCheck {
  if (!ultimaLeitura) {
    return {
      online: false,
      reason: "Nenhuma leitura registrada",
      minutes_offline: null,
    };
  }

  const agora = new Date();
  const dataLeitura = new Date(ultimaLeitura);
  const diferencaMs = agora.getTime() - dataLeitura.getTime();

  if (diferencaMs > CONNECTION_TIMEOUT_MS) {
    const minutosOffline = Math.floor(diferencaMs / 60000);
    return {
      online: false,
      reason: `Offline há ${minutosOffline} minutos`,
      minutes_offline: minutosOffline,
    };
  }

  return {
    online: true,
    minutes_ago: Math.floor(diferencaMs / 60000),
  };
}

export function extrairTemperaturaPayload(
  payload: unknown
): number | null {
  try {
    const dados: LogboxPayload =
      typeof payload === "string" ? JSON.parse(payload) : (payload as LogboxPayload);

    let temp: unknown = dados.ch_analog_1;

    if (temp === undefined && Array.isArray(dados.value_channels)) {
      temp = dados.value_channels[2];
    }

    if (temp === undefined) {
      temp = dados.temperature ?? dados.internal_temperature ?? dados.temp_int;
    }

    return temp !== undefined ? parseFloat(String(temp)) : null;
  } catch {
    return null;
  }
}

export function sanitizarDadosLeitura(dados: LogboxPayload): SanitizedReading {
  const temperatura = extrairTemperaturaPayload(dados);
  const validacao = validarTemperatura(temperatura);

  return {
    temperatura_valida: validacao.valid,
    temperatura_valor: validacao.valid ? (validacao.value ?? null) : null,
    temperatura_motivo_invalido: validacao.valid ? null : (validacao.reason ?? null),
    dados_originais: dados,
  };
}

export function validarStatusDispositivo(
  status: LogboxPayload | null | undefined,
  ultimaLeitura: Date | string | null | undefined
): DeviceStatusValidation {
  const conexao = verificarConexaoAtiva(ultimaLeitura);
  const statusObj = status && typeof status === "object" ? status : {};

  let connection_status: ConnectionStatus = conexao.online ? "online" : "offline";

  if (
    statusObj.connection_status === "online" ||
    statusObj.connection_status === "offline"
  ) {
    connection_status = conexao.online ? statusObj.connection_status : "offline";
  }

  const minutes_since_last_reading = conexao.online
    ? conexao.minutes_ago
    : conexao.minutes_offline;

  let connection_warning: string | null = null;
  if (!conexao.online) {
    connection_warning = conexao.reason;
  } else if (conexao.minutes_ago >= 3) {
    connection_warning = `Última leitura há ${conexao.minutes_ago} minutos`;
  }

  return {
    connection_status,
    minutes_since_last_reading,
    connection_warning,
  };
}

export function analisarEstadoVentilacao(
  temperatura: number | null,
  estadoAtual: boolean
): FanStateAnalysis {
  const validacao = validarTemperatura(temperatura);

  if (!validacao.valid || validacao.value === undefined) {
    return {
      novoEstado: estadoAtual,
      mudou: false,
      motivo: "Temperatura inválida",
    };
  }

  const temp = validacao.value;

  if (estadoAtual) {
    if (temp <= FAN_CONFIG.TEMP_OFF) {
      return {
        novoEstado: false,
        mudou: true,
        motivo: `Temperatura (${temp}) baixou do limite de desligamento (${FAN_CONFIG.TEMP_OFF})`,
      };
    }
  } else if (temp >= FAN_CONFIG.TEMP_ON) {
    return {
      novoEstado: true,
      mudou: true,
      motivo: `Temperatura (${temp}) atingiu limite de acionamento (${FAN_CONFIG.TEMP_ON})`,
    };
  }

  return {
    novoEstado: estadoAtual,
    mudou: false,
    motivo: "Histerese mantida",
  };
}
