const TEMP_LIMITS = {
  MIN_VALID: -40,
  MAX_VALID: 85,
  MIN_REALISTIC: -10,
  MAX_REALISTIC: 60
};

const CONNECTION_TIMEOUT_MS = 5 * 60 * 1000;

function validarTemperatura(temp, strict = false) {
  if (temp === null || temp === undefined || isNaN(temp)) {
    return { valid: false, reason: "Valor inválido ou ausente" };
  }

  const tempNum = parseFloat(temp);

  if (strict) {
    if (tempNum < TEMP_LIMITS.MIN_REALISTIC || tempNum > TEMP_LIMITS.MAX_REALISTIC) {
      return { 
        valid: false, 
        reason: `Temperatura fora do esperado (${TEMP_LIMITS.MIN_REALISTIC}°C a ${TEMP_LIMITS.MAX_REALISTIC}°C)`,
        value: tempNum
      };
    }
  } else {
    if (tempNum < TEMP_LIMITS.MIN_VALID || tempNum > TEMP_LIMITS.MAX_VALID) {
      return { 
        valid: false, 
        reason: `Temperatura inválida (${TEMP_LIMITS.MIN_VALID}°C a ${TEMP_LIMITS.MAX_VALID}°C)`,
        value: tempNum
      };
    }
  }

  return { valid: true, value: tempNum };
}

function verificarConexaoAtiva(ultimaLeitura) {
  if (!ultimaLeitura) {
    return { online: false, reason: "Nenhuma leitura registrada", offlineMinutes: null };
  }

  const agora = new Date();
  const dataLeitura = new Date(ultimaLeitura);
  const diferencaMs = agora - dataLeitura;

  if (diferencaMs > CONNECTION_TIMEOUT_MS) {
    const minutosOffline = Math.floor(diferencaMs / 60000);
    return { 
      online: false, 
      reason: `Última leitura há ${minutosOffline} minutos`,
      lastSeen: dataLeitura,
      offlineMinutes: minutosOffline
    };
  }

  return { 
    online: true, 
    lastSeen: dataLeitura,
    minutesAgo: Math.floor(diferencaMs / 60000)
  };
}

function extrairTemperaturaPayload(payload) {
  try {
    const dados = typeof payload === 'string' ? JSON.parse(payload) : payload;
    
    let temp = dados.ch_analog_1;
    
    if (temp === undefined && dados.value_channels && Array.isArray(dados.value_channels)) {
      temp = dados.value_channels[2];
    }

    return temp !== undefined ? parseFloat(temp) : null;
  } catch (error) {
    return null;
  }
}

function validarStatusDispositivo(status, ultimaLeitura) {
  const conexao = verificarConexaoAtiva(ultimaLeitura);
  
  let statusFinal = {
    ...status,
    connection_status: conexao.online ? "online" : "offline",
    last_seen: conexao.lastSeen,
    minutes_since_last_reading: conexao.minutesAgo || conexao.offlineMinutes || null
  };

  if (!conexao.online) {
    statusFinal.connection_warning = conexao.reason;
  }

  return statusFinal;
}

function filtrarLeiturasValidas(leituras) {
  return leituras.filter(leitura => {
    const temp = extrairTemperaturaPayload(leitura.payload_json);
    const validacao = validarTemperatura(temp, false);
    return validacao.valid;
  }).map(leitura => {
    const temp = extrairTemperaturaPayload(leitura.payload_json);
    return {
      ...leitura,
      temperatura_extraida: temp,
      timestamp_leitura: leitura.timestamp_leitura
    };
  });
}

function sanitizarDadosLeitura(dados) {
  const temperaturaExterna = extrairTemperaturaPayload(dados);
  const validacao = validarTemperatura(temperaturaExterna);

  return {
    temperatura_valida: validacao.valid,
    temperatura_valor: validacao.valid ? validacao.value : null,
    temperatura_motivo_invalido: validacao.valid ? null : validacao.reason,
    dados_originais: dados
  };
}

module.exports = {
  validarTemperatura,
  verificarConexaoAtiva,
  extrairTemperaturaPayload,
  validarStatusDispositivo,
  filtrarLeiturasValidas,
  sanitizarDadosLeitura,
  TEMP_LIMITS,
  CONNECTION_TIMEOUT_MS
};
