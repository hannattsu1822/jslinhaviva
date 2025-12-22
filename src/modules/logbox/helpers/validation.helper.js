const TEMP_LIMITS = {
  MIN_VALID: -50,
  MAX_VALID: 150,
};

const FAN_CONFIG = {
  TEMP_ON: 60.0,
  TEMP_OFF: 58.5,
};

const CONNECTION_TIMEOUT_MS = 5 * 60 * 1000;

function validarTemperatura(temp) {
  if (temp === null || temp === undefined || isNaN(temp)) {
    return { valid: false, reason: "Valor nulo ou não numérico" };
  }

  const tempNum = parseFloat(temp);

  if (tempNum < TEMP_LIMITS.MIN_VALID || tempNum > TEMP_LIMITS.MAX_VALID) {
    return {
      valid: false,
      reason: `Fora do intervalo aceitável (${TEMP_LIMITS.MIN_VALID} a ${TEMP_LIMITS.MAX_VALID})`,
      value: tempNum
    };
  }

  return { valid: true, value: tempNum };
}

function verificarConexaoAtiva(ultimaLeitura) {
  if (!ultimaLeitura) {
    return { online: false, reason: "Nenhuma leitura registrada", minutes_offline: null };
  }

  const agora = new Date();
  const dataLeitura = new Date(ultimaLeitura);
  const diferencaMs = agora - dataLeitura;

  if (diferencaMs > CONNECTION_TIMEOUT_MS) {
    const minutosOffline = Math.floor(diferencaMs / 60000);
    return {
      online: false,
      reason: `Offline há ${minutosOffline} minutos`,
      minutes_offline: minutosOffline
    };
  }

  return {
    online: true,
    minutes_ago: Math.floor(diferencaMs / 60000)
  };
}

function extrairTemperaturaPayload(payload) {
  try {
    const dados = typeof payload === 'string' ? JSON.parse(payload) : payload;

    let temp = dados.ch_analog_1;

    if (temp === undefined && dados.value_channels && Array.isArray(dados.value_channels)) {
      temp = dados.value_channels[2];
    }

    if (temp === undefined) {
      temp = dados.temperature || dados.internal_temperature || dados.temp_int;
    }

    return temp !== undefined ? parseFloat(temp) : null;
  } catch (error) {
    return null;
  }
}

function sanitizarDadosLeitura(dados) {
  const temperatura = extrairTemperaturaPayload(dados);
  const validacao = validarTemperatura(temperatura);

  return {
    temperatura_valida: validacao.valid,
    temperatura_valor: validacao.valid ? validacao.value : null,
    temperatura_motivo_invalido: validacao.valid ? null : validacao.reason,
    dados_originais: dados
  };
}

function analisarEstadoVentilacao(temperatura, estadoAtual) {
  const validacao = validarTemperatura(temperatura);

  if (!validacao.valid) {
    return {
      novoEstado: estadoAtual,
      mudou: false,
      motivo: "Temperatura inválida"
    };
  }

  const temp = validacao.value;

  if (estadoAtual) {
    if (temp <= FAN_CONFIG.TEMP_OFF) {
      return {
        novoEstado: false,
        mudou: true,
        motivo: `Temperatura (${temp}) baixou do limite de desligamento (${FAN_CONFIG.TEMP_OFF})`
      };
    }
  } else {
    if (temp >= FAN_CONFIG.TEMP_ON) {
      return {
        novoEstado: true,
        mudou: true,
        motivo: `Temperatura (${temp}) atingiu limite de acionamento (${FAN_CONFIG.TEMP_ON})`
      };
    }
  }

  return {
    novoEstado: estadoAtual,
    mudou: false,
    motivo: "Histerese mantida"
  };
}

module.exports = {
  validarTemperatura,
  verificarConexaoAtiva,
  extrairTemperaturaPayload,
  sanitizarDadosLeitura,
  analisarEstadoVentilacao,
  TEMP_LIMITS,
  FAN_CONFIG,
  CONNECTION_TIMEOUT_MS
};
