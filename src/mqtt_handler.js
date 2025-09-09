const mqtt = require("mqtt");
const { promisePool } = require("./init");

async function salvarLeituraLogBox(serialNumber, dados, wss) {
  try {
    const { channels, timestamp } = dados;
    const sql = `INSERT INTO leituras (serial_number, ch1, ch2, ch3, ch4, ch5, ch6, ch7, ch8, timestamp_leitura) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await promisePool.query(sql, [
      serialNumber,
      channels[0],
      channels[1],
      channels[2],
      channels[3],
      channels[4],
      channels[5],
      channels[6],
      channels[7],
      timestamp,
    ]);

    await promisePool.query(
      "UPDATE dispositivos SET ultima_leitura = ?, status_json = ? WHERE serial_number = ?",
      [timestamp, JSON.stringify(dados), serialNumber]
    );

    if (wss) {
      const payloadWebSocket = {
        type: "nova_leitura",
        dados: {
          serial_number: serialNumber,
          ...dados,
        },
      };
      wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify(payloadWebSocket));
        }
      });
    }
  } catch (err) {
    console.error("Erro ao salvar leitura do LogBox:", err);
  }
}

async function salvarStatusConexao(dados, wss) {
  try {
    const { serial_number, connection_status } = dados;
    const statusJson = JSON.stringify({ connection_status });
    const sql = "UPDATE dispositivos SET status_conexao = ?, status_json = ? WHERE serial_number = ?";
    await promisePool.query(sql, [connection_status, statusJson, serial_number]);

    if (wss) {
      const payloadWebSocket = {
        type: "status_conexao",
        dados: dados,
      };
      wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify(payloadWebSocket));
        }
      });
    }
  } catch (err) {
    console.error("Erro ao salvar status de conexão:", err);
  }
}

async function salvarLeituraRele(data, wss) {
  try {
    const { rele_id, timestamp_leitura, tensao_a, tensao_b, tensao_c, corrente_a, corrente_b, corrente_c, frequencia, payload_completo } = data;

    const sqlInsert = `
      INSERT INTO leituras_reles 
      (rele_id, timestamp_leitura, tensao_a, tensao_b, tensao_c, corrente_a, corrente_b, corrente_c, frequencia, payload_completo) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await promisePool.query(sqlInsert, [rele_id, timestamp_leitura, tensao_a, tensao_b, tensao_c, corrente_a, corrente_b, corrente_c, frequencia, payload_completo]);

    const sqlUpdate = "UPDATE dispositivos_reles SET ultima_leitura = NOW(), status_json = ? WHERE id = ?";
    await promisePool.query(sqlUpdate, [JSON.stringify({ connection_status: "online", ...data }), rele_id]);

    console.log(`[MQTT Handler] Leitura do relé ID: ${rele_id} salva no banco de dados.`);

    if (wss) {
      const payloadWebSocket = {
        type: "nova_leitura_rele",
        dados: data
      };
      wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify(payloadWebSocket));
        }
      });
    }
  } catch (err) {
    console.error("[MQTT Handler] Erro ao salvar leitura do relé:", err);
  }
}

function iniciarClienteMQTT(app) {
  const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
  const client = mqtt.connect(MQTT_BROKER_URL);

  client.on("connect", () => {
    console.log("[MQTT Handler] Conectado ao broker Mosquitto local com sucesso!");
    
    const topicos = [
      "novus/+/status/channels", 
      "novus/neighbor", 
      "sel/reles/+/status"
    ];
    
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
      const dados = JSON.parse(message.toString());
      const wss = app.get("wss");

      if (topic.includes("status/channels")) {
        const serialNumber = topic.split("/")[1];
        salvarLeituraLogBox(serialNumber, dados, wss);
      } else if (topic === "novus/neighbor") {
        salvarStatusConexao(dados, wss);
      } else if (topic.startsWith("sel/reles/")) {
        console.log(`[MQTT Router] Mensagem de RELÉ recebida do tópico: ${topic}`);
        salvarLeituraRele(dados, wss);
      }
    } catch (e) {
      console.error("[MQTT Handler] Erro ao processar mensagem MQTT:", e, "Tópico:", topic, "Mensagem:", message.toString());
    }
  });

  client.on("error", (err) => {
    console.error("[MQTT Handler] Erro no cliente MQTT:", err);
  });

  app.set("mqttClient", client);
}

module.exports = { iniciarClienteMQTT };
