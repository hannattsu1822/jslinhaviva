const mqtt = require("mqtt");
const { promisePool } = require("./init");
const WebSocket = require('ws');

async function salvarLeituraRele(dados, wss) {
  if (!dados || !dados.rele_id || !dados.dados) {
    console.error('[MQTT Handler] Erro: Dados recebidos do MQTT para o relé estão incompletos ou malformados.');
    return;
  }

  const { rele_id, device_id, timestamp, dados: dadosMedidos } = dados;

  try {
    const statusParaSalvar = JSON.stringify(dadosMedidos);
    await promisePool.query(
      "UPDATE dispositivos_reles SET status_json = ? WHERE id = ?",
      [statusParaSalvar, rele_id]
    );
    console.log(`[MQTT Handler] Último status do relé '${device_id}' (ID: ${rele_id}) salvo no banco.`);

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
        console.log(`[MQTT Handler] Dados do relé enviados para ${clientCount} cliente(s) WebSocket.`);
      }
    }
  } catch (error) {
    console.error(`[MQTT Handler] Erro ao processar e transmitir leitura do relé:`, error);
  }
}

async function salvarLeituraLogBox(serialNumber, dados, wss) {
  console.log(`[MQTT Handler] Recebida leitura do LogBox SN: ${serialNumber}`);
  let connection;
  try {
    connection = await promisePool.getConnection();
    await connection.beginTransaction();

    const payloadString = JSON.stringify(dados);
    
    await connection.query(
      "INSERT INTO leituras_logbox (serial_number, payload_json, timestamp_leitura) VALUES (?, ?, NOW())",
      [serialNumber, payloadString]
    );
    console.log(`[MQTT Handler] Leitura histórica do LogBox ${serialNumber} salva no banco.`);

    await connection.query(
      "UPDATE dispositivos_logbox SET status_json = ?, ultima_leitura = NOW() WHERE serial_number = ?",
      [payloadString, serialNumber]
    );
    console.log(`[MQTT Handler] Último status do LogBox ${serialNumber} salvo no banco.`);
    
    await connection.commit();
    connection.release();

    if (wss && wss.clients) {
      const payloadWebSocket = {
        type: 'nova_leitura_logbox',
        dados: {
          serial_number: serialNumber,
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
        console.log(`[MQTT Handler] Dados do LogBox ${serialNumber} enviados para ${clientCount} cliente(s) WebSocket.`);
      }
    }
  } catch(error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error(`[MQTT Handler] Erro ao processar leitura do LogBox SN ${serialNumber}:`, error);
  }
}

async function salvarStatusConexao(dados, wss) {
    console.log(`[MQTT Handler] Recebido status de conexão para LogBox SN: ${dados.serial_number}`);
    try {
        await promisePool.query(
          "UPDATE dispositivos_logbox SET status_json = ? WHERE serial_number = ?",
          [JSON.stringify(dados), dados.serial_number]
        );
        console.log(`[MQTT Handler] Status de conexão do LogBox ${dados.serial_number} salvo no banco.`);

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
            console.log(`[MQTT Handler] Status de conexão do LogBox ${dados.serial_number} enviado via WebSocket.`);
        }
    } catch(error) {
        console.error(`[MQTT Handler] Erro ao processar status de conexão do LogBox SN ${dados.serial_number}:`, error);
    }
}

function iniciarClienteMQTT(app) {
  const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
  const options = {
    clientId: "sistema_js_" + Math.random().toString(16).substr(2, 8),
  };
  const client = mqtt.connect(MQTT_BROKER_URL, options);

  client.on("connect", () => {
    console.log("[MQTT Handler] Conectado ao broker Mosquitto local com sucesso!");
    const topicos = ["novus/+/status/channels", "novus/neighbor", "sel/reles/+/status"];
    client.subscribe(topicos, (err) => {
      if (!err) {
        console.log(`[MQTT Handler] Inscrito com sucesso nos tópicos: "${topicos.join(", ")}"`);
      } else {
        console.error(`[MQTT Handler] Falha ao se inscrever nos tópicos:`, err);
      }
    });
  });

  client.on("message", (topic, message) => {
    try {
      console.log(`[MQTT Handler] Mensagem recebida no tópico: ${topic}`);
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
      console.error("[MQTT Handler] Erro crítico ao processar mensagem MQTT:", e);
      console.error("[MQTT Handler] Tópico:", topic);
      console.error("[MQTT Handler] Mensagem Bruta:", message.toString());
    }
  });

  client.on("error", (err) => {
    console.error("[MQTT Handler] Erro no cliente MQTT:", err);
  });
}

module.exports = { iniciarClienteMQTT };
