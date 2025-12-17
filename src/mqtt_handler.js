const mqtt = require("mqtt");
const { promisePool, logger } = require("./init");
const WebSocket = require('ws');
const { 
  validarTemperatura, 
  extrairTemperaturaPayload,
  sanitizarDadosLeitura
} = require("./modules/logbox/helpers/validation.helper");

async function salvarLeituraRele(dados, wss) {
  if (!dados || !dados.rele_id || !dados.dados) {
    logger.error('[MQTT Handler] Erro: Dados recebidos do MQTT para o relé estão incompletos ou malformados.');
    return;
  }

  const { rele_id, device_id, timestamp, dados: dadosMedidos } = dados;

  try {
    const statusParaSalvar = JSON.stringify(dadosMedidos);
    
    await promisePool.query(
      "UPDATE dispositivos_reles SET status_json = ? WHERE id = ?",
      [statusParaSalvar, rele_id]
    );

    logger.info(`[MQTT Handler] Último status do relé '${device_id}' (ID: ${rele_id}) salvo no banco.`);

    if (wss && wss.clients) {
      const payloadWebSocket = {
        type: "nova_leitura_rele",
        dados: { rele_id, device_id, timestamp, ...dadosMedidos },
      };

      let clientCount = 0;
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(payloadWebSocket));
          clientCount++;
        }
      });

      if (clientCount > 0) {
        logger.info(`[MQTT Handler] Dados do relé enviados para ${clientCount} cliente(s) WebSocket.`);
      }
    }
  } catch (error) {
    logger.error(`[MQTT Handler] Erro ao processar e transmitir leitura do relé: ${error.message}`);
  }
}

async function salvarLeituraLogBox(serialNumber, dados, wss) {
  logger.info(`[MQTT Handler] Recebida leitura do LogBox SN: ${serialNumber}`);
  
  const dadosSanitizados = sanitizarDadosLeitura(dados);
  
  if (!dadosSanitizados.temperatura_valida) {
    logger.warn(`[MQTT Handler] Temperatura inválida recebida do LogBox ${serialNumber}: ${dadosSanitizados.temperatura_valor}°C - Motivo: ${dadosSanitizados.temperatura_motivo_invalido}`);
  }

  let connection;
  try {
    connection = await promisePool.getConnection();
    await connection.beginTransaction();

    const payloadString = JSON.stringify(dados);

    if (dadosSanitizados.temperatura_valida) {
      await connection.query(
        "INSERT INTO leituras_logbox (serial_number, payload_json, timestamp_leitura) VALUES (?, ?, NOW())",
        [serialNumber, payloadString]
      );
      logger.info(`[MQTT Handler] Leitura histórica do LogBox ${serialNumber} salva no banco.`);
    } else {
      logger.warn(`[MQTT Handler] Leitura do LogBox ${serialNumber} não salva no histórico devido à temperatura inválida.`);
    }

    await connection.query(
      "UPDATE dispositivos_logbox SET status_json = ?, ultima_leitura = NOW() WHERE serial_number = ?",
      [payloadString, serialNumber]
    );

    logger.info(`[MQTT Handler] Último status do LogBox ${serialNumber} atualizado no banco.`);

    await connection.commit();

    if (wss && wss.clients) {
      const payloadWebSocket = {
        type: 'nova_leitura_logbox',
        dados: {
          serial_number: serialNumber,
          temperatura_valida: dadosSanitizados.temperatura_valida,
          temperatura_aviso: dadosSanitizados.temperatura_motivo_invalido,
          ...dados
        }
      };

      let clientCount = 0;
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(payloadWebSocket));
          clientCount++;
        }
      });

      if (clientCount > 0) {
        logger.info(`[MQTT Handler] Dados do LogBox ${serialNumber} enviados para ${clientCount} cliente(s) WebSocket.`);
      }
    }
  } catch(error) {
    logger.error(`[MQTT Handler] Erro ao processar leitura do LogBox SN ${serialNumber}: ${error.message}`);
    
    if (connection) {
      try {
        await connection.rollback();
        logger.info(`[MQTT Handler] Rollback executado para LogBox SN ${serialNumber}`);
      } catch(rollbackError) {
        logger.error(`[MQTT Handler] Erro ao executar rollback: ${rollbackError.message}`);
      }
    }
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function salvarStatusConexao(dados, wss) {
  logger.info(`[MQTT Handler] Recebido status de conexão para LogBox SN: ${dados.serial_number}`);
  
  try {
    await promisePool.query(
      "UPDATE dispositivos_logbox SET status_json = ? WHERE serial_number = ?",
      [JSON.stringify(dados), dados.serial_number]
    );

    logger.info(`[MQTT Handler] Status de conexão do LogBox ${dados.serial_number} salvo no banco.`);

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

      logger.info(`[MQTT Handler] Status de conexão do LogBox ${dados.serial_number} enviado via WebSocket.`);
    }
  } catch(error) {
    logger.error(`[MQTT Handler] Erro ao processar status de conexão do LogBox SN ${dados.serial_number}: ${error.message}`);
  }
}

function iniciarClienteMQTT(app) {
  const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
  const options = {
    clientId: "sistema_js_" + Math.random().toString(16).substr(2, 8),
  };

  const client = mqtt.connect(MQTT_BROKER_URL, options);

  client.on("connect", () => {
    logger.info("[MQTT Handler] Conectado ao broker Mosquitto local com sucesso!");
    
    const topicos = ["novus/+/status/channels", "novus/neighbor", "sel/reles/+/status"];
    
    client.subscribe(topicos, (err) => {
      if (!err) {
        logger.info(`[MQTT Handler] Inscrito com sucesso nos tópicos: "${topicos.join(", ")}"`);
      } else {
        logger.error(`[MQTT Handler] Falha ao se inscrever nos tópicos: ${err.message}`);
      }
    });
  });

  client.on("message", (topic, message) => {
    try {
      logger.debug(`[MQTT Handler] Mensagem recebida no tópico: ${topic}`);
      
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
      logger.error(`[MQTT Handler] Erro crítico ao processar mensagem MQTT: ${e.message}`);
      logger.error(`[MQTT Handler] Tópico: ${topic}`);
      logger.error(`[MQTT Handler] Mensagem Bruta: ${message.toString()}`);
    }
  });

  client.on("error", (err) => {
    logger.error(`[MQTT Handler] Erro no cliente MQTT: ${err.message}`);
  });
}

module.exports = { iniciarClienteMQTT };
