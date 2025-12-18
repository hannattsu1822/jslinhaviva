const mqtt = require("mqtt");
const { promisePool, logger } = require("./init");
const WebSocket = require('ws');
const { 
  sanitizarDadosLeitura 
} = require("./modules/logbox/helpers/validation.helper");

async function salvarLeituraRele(dados, wss) {
  if (!dados || !dados.rele_id || !dados.dados) {
    logger.error('[MQTT Handler] Erro: Dados recebidos do MQTT para o relé estão incompletos.');
    return;
  }

  const { rele_id, device_id, timestamp, dados: dadosMedidos } = dados;

  try {
    const statusParaSalvar = JSON.stringify(dadosMedidos);
    
    await promisePool.query(
      "UPDATE dispositivos_reles SET status_json = ? WHERE id = ?",
      [statusParaSalvar, rele_id]
    );

    if (wss && wss.clients) {
      const payloadWebSocket = {
        type: "nova_leitura_rele",
        dados: { rele_id, device_id, timestamp, ...dadosMedidos },
      };

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(payloadWebSocket));
        }
      });
    }
  } catch (error) {
    logger.error(`[MQTT Handler] Erro ao processar leitura do relé: ${error.message}`);
  }
}

async function salvarLeituraLogBox(serialNumber, dados, wss) {
  const dadosSanitizados = sanitizarDadosLeitura(dados);
  
  if (!dadosSanitizados.temperatura_valida) {
    logger.warn(`[MQTT Handler] Leitura IGNORADA (SN: ${serialNumber}): Valor inválido (${dadosSanitizados.temperatura_valor})`);
    return;
  }

  let connection;
  try {
    connection = await promisePool.getConnection();
    await connection.beginTransaction();

    const payloadString = JSON.stringify(dados);

    await connection.query(
      "INSERT INTO leituras_logbox (serial_number, payload_json, timestamp_leitura) VALUES (?, ?, NOW())",
      [serialNumber, payloadString]
    );

    await connection.query(
      "UPDATE dispositivos_logbox SET status_json = ?, ultima_leitura = NOW() WHERE serial_number = ?",
      [payloadString, serialNumber]
    );

    await connection.commit();

    if (wss && wss.clients) {
      const payloadWebSocket = {
        type: 'nova_leitura_logbox',
        dados: {
          serial_number: serialNumber,
          temperatura_valida: true,
          ...dados
        }
      };

      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(payloadWebSocket));
        }
      });
    }
  } catch(error) {
    logger.error(`[MQTT Handler] Erro ao salvar LogBox SN ${serialNumber}: ${error.message}`);
    
    if (connection) {
      try {
        await connection.rollback();
      } catch(rollbackError) {
        logger.error(`[MQTT Handler] Erro no rollback: ${rollbackError.message}`);
      }
    }
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function salvarStatusConexao(dados, wss) {
  try {
    await promisePool.query(
      "UPDATE dispositivos_logbox SET status_json = ? WHERE serial_number = ?",
      [JSON.stringify(dados), dados.serial_number]
    );

    if (wss && wss.clients) {
      const payloadWebSocket = {
        type: 'atualizacao_status',
        dados: dados
      };

      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(payloadWebSocket));
        }
      });
    }
  } catch(error) {
    logger.error(`[MQTT Handler] Erro ao salvar status de conexão (SN: ${dados.serial_number}): ${error.message}`);
  }
}

function iniciarClienteMQTT(app) {
  const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
  const options = {
    clientId: "sistema_js_" + Math.random().toString(16).substr(2, 8),
  };

  const client = mqtt.connect(MQTT_BROKER_URL, options);

  client.on("connect", () => {
    logger.info("[MQTT Handler] Conectado ao broker MQTT.");
    
    const topicos = ["novus/+/status/channels", "novus/neighbor", "sel/reles/+/status"];
    
    client.subscribe(topicos, (err) => {
      if (err) {
        logger.error(`[MQTT Handler] Falha ao inscrever nos tópicos: ${err.message}`);
      } else {
        logger.info(`[MQTT Handler] Inscrito nos tópicos: ${topicos.join(", ")}`);
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
      } else if (topic === "novus/neighbor") {
        salvarStatusConexao(dados, wss);
      }
    } catch (e) {
      logger.error(`[MQTT Handler] Erro ao processar mensagem do tópico ${topic}: ${e.message}`);
    }
  });

  client.on("error", (err) => {
    logger.error(`[MQTT Handler] Erro de conexão: ${err.message}`);
  });
}

module.exports = { iniciarClienteMQTT };
