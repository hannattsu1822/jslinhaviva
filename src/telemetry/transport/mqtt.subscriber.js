const mqtt = require("mqtt");
const logger = require("../../config/logger");
const { promisePool } = require("../../infrastructure/database");
const { sanitizarDadosLeitura } = require("../rules/validation");
const { processarNovaLeitura } = require("../ingest/logbox.ingest");
const { broadcastToClients } = require("./websocket.broadcast");
const { MQTT_BROKER_DEFAULT, MQTT_TOPICS } = require("../constants");

async function salvarLeituraRele(dados, wss) {
  if (!dados || !dados.rele_id || !dados.dados) {
    logger.error("[MQTT] Dados incompletos para relé.");
    return;
  }

  const { rele_id, device_id, timestamp, dados: dadosMedidos } = dados;

  try {
    await promisePool.query(
      "UPDATE dispositivos_reles SET status_json = ? WHERE id = ?",
      [JSON.stringify(dadosMedidos), rele_id]
    );

    broadcastToClients(wss, {
      type: "nova_leitura_rele",
      dados: { rele_id, device_id, timestamp, ...dadosMedidos },
    });
  } catch (error) {
    logger.error(`[MQTT] Erro ao processar leitura do relé: ${error.message}`);
  }
}

async function salvarLeituraLogBox(serialNumber, dados, wss) {
  const dadosSanitizados = sanitizarDadosLeitura(dados);

  if (!dadosSanitizados.temperatura_valida) {
    logger.warn(
      `[MQTT] Leitura ignorada (SN: ${serialNumber}): valor inválido (${dadosSanitizados.temperatura_valor})`
    );
    return;
  }

  try {
    await processarNovaLeitura(serialNumber, dados);

    broadcastToClients(wss, {
      type: "nova_leitura_logbox",
      dados: {
        serial_number: serialNumber,
        temperatura_valida: true,
        ...dados,
      },
    });
  } catch (error) {
    logger.error(`[MQTT] Erro ao processar LogBox SN ${serialNumber}: ${error.message}`);
  }
}

async function salvarStatusConexao(dados, wss) {
  try {
    await promisePool.query(
      "UPDATE dispositivos_logbox SET status_json = ? WHERE serial_number = ?",
      [JSON.stringify(dados), dados.serial_number]
    );

    broadcastToClients(wss, {
      type: "atualizacao_status",
      dados,
    });
  } catch (error) {
    logger.error(`[MQTT] Erro ao salvar status de conexão (SN: ${dados.serial_number}): ${error.message}`);
  }
}

function iniciarClienteMQTT(app) {
  const brokerUrl = process.env.MQTT_BROKER_URL || MQTT_BROKER_DEFAULT;
  const client = mqtt.connect(brokerUrl, {
    clientId: "sistema_js_" + Math.random().toString(16).substr(2, 8),
  });

  const topicos = [
    MQTT_TOPICS.LOGOBOX_CHANNELS,
    MQTT_TOPICS.LOGOBOX_NEIGHBOR,
    MQTT_TOPICS.RELE_STATUS,
  ];

  client.on("connect", () => {
    logger.info("[MQTT] Conectado ao broker.");

    client.subscribe(topicos, (err) => {
      if (err) {
        logger.error(`[MQTT] Falha ao inscrever nos tópicos: ${err.message}`);
      } else {
        logger.info(`[MQTT] Inscrito nos tópicos: ${topicos.join(", ")}`);
      }
    });
  });

  client.on("message", (topic, message) => {
    try {
      const dados = JSON.parse(message.toString());
      const wss = app.get("wss");

      if (topic.startsWith("sel/reles/")) {
        salvarLeituraRele(dados, wss);
      } else if (topic.includes("status/channels")) {
        const serialNumber = topic.split("/")[1];
        salvarLeituraLogBox(serialNumber, dados, wss);
      } else if (topic === MQTT_TOPICS.LOGOBOX_NEIGHBOR) {
        salvarStatusConexao(dados, wss);
      }
    } catch (e) {
      logger.error(`[MQTT] Erro ao processar mensagem do tópico ${topic}: ${e.message}`);
    }
  });

  client.on("error", (err) => {
    logger.error(`[MQTT] Erro de conexão: ${err.message}`);
  });
}

module.exports = { iniciarClienteMQTT };
