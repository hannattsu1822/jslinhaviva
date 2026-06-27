const { promisePool } = require("../../infrastructure/database");
const {
  extrairTemperaturaPayload,
  analisarEstadoVentilacao,
  validarTemperatura,
} = require("../rules/validation");
const { registrarLeituraRecebida } = require("./connectionHistory");

async function processarNovaLeitura(serialNumber, payload) {
  try {
    const payloadString = typeof payload === "object" ? JSON.stringify(payload) : payload;
    const temperatura = extrairTemperaturaPayload(payload);

    await gerenciarLogicaVentilacao(serialNumber, temperatura);

    await promisePool.query(
      "INSERT INTO leituras_logbox (serial_number, payload_json, timestamp_leitura) VALUES (?, ?, NOW())",
      [serialNumber, payloadString]
    );

    await promisePool.query(
      "UPDATE dispositivos_logbox SET ultima_leitura = NOW(), status_json = ? WHERE serial_number = ?",
      [payloadString, serialNumber]
    );

    await registrarLeituraRecebida(serialNumber);

    return { success: true };
  } catch (error) {
    console.error(`Erro ao processar leitura para ${serialNumber}:`, error);
    throw error;
  }
}

async function gerenciarLogicaVentilacao(serialNumber, temperatura) {
  const validacao = validarTemperatura(temperatura);
  if (!validacao.valid) return;

  const [rows] = await promisePool.query(
    "SELECT id, timestamp_inicio FROM historico_ventilacao WHERE serial_number = ? AND timestamp_fim IS NULL ORDER BY id DESC LIMIT 1",
    [serialNumber]
  );

  const eventoAberto = rows[0];
  const estadoAtual = !!eventoAberto;
  const analise = analisarEstadoVentilacao(temperatura, estadoAtual);

  if (!analise.mudou) return;

  if (analise.novoEstado === true) {
    await promisePool.query(
      "INSERT INTO historico_ventilacao (serial_number, timestamp_inicio) VALUES (?, NOW())",
      [serialNumber]
    );
    return;
  }

  if (eventoAberto) {
    const fim = new Date();
    const inicio = new Date(eventoAberto.timestamp_inicio);
    const duracao = (fim - inicio) / 1000;

    await promisePool.query(
      "UPDATE historico_ventilacao SET timestamp_fim = ?, duracao_segundos = ? WHERE id = ?",
      [fim, duracao, eventoAberto.id]
    );
  }
}

module.exports = {
  processarNovaLeitura,
};
