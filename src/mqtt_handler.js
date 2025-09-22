const mqtt = require("mqtt");
const { promisePool } = require("./init");
const WebSocket = require('ws');

async function salvarLeituraRele(dados, wss) {
  console.log('[MQTT Handler] Função salvarLeituraRele chamada com os dados:', JSON.stringify(dados, null, 2));

  if (!dados || !dados.rele_id || !dados.dados) {
    console.error('[MQTT Handler] Erro: Dados recebidos do MQTT para o relé estão incompletos ou malformados.');
    return;
  }

  const { rele_id, device_id, timestamp, dados: dadosMedidos } = dados;

  try {
    console.log(`[MQTT Handler] Leitura do relé '${device_id}' (ID: ${rele_id}) recebida para transmissão.`);

    if (wss && wss.clients) {
      const payloadWebSocket = {
        type: "nova_leitura_rele",
        dados: {
          rele_id,
          device_id,
          timestamp,
          ...dadosMedidos,
        },
      };

      console.log('[MQTT Handler] Preparando para enviar payload para clientes WebSocket:', JSON.stringify(payloadWebSocket, null, 2));

      let clientCount = 0;
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(payloadWebSocket));
          clientCount++;
        }
      });
      
      if (clientCount > 0) {
        console.log(`[MQTT Handler] Dados do relé enviados para ${clientCount} cliente(s) WebSocket.`);
      } else {
        console.warn('[MQTT Handler] Nenhum cliente WebSocket estava conectado para receber os dados.');
      }

    } else {
       console.error('[MQTT Handler] Erro: Servidor WebSocket (wss) não encontrado ou sem clientes.');
    }
  } catch (error) {
    console.error(`[MQTT Handler] Erro ao processar e transmitir leitura do relé:`, error);
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

      if (topic.includes("status/channels")) {
        // salvarLeituraLogBox(serialNumber, dados, wss);
      } else if (topic === "novus/neighbor") {
        // salvarStatusConexao(dados, wss);
      } else if (topic.startsWith("sel/reles/")) {
        salvarLeituraRele(dados, wss);
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
