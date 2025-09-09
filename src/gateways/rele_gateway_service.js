const path = require('path');
require("dotenv").config({ path: path.resolve(__dirname, '../../.env') });

const net = require("net");
const mqtt = require("mqtt");
const mysql = require("mysql2/promise");

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const POLLING_INTERVAL_MS = 10000;

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const mqttClient = mqtt.connect(MQTT_BROKER_URL);
mqttClient.on("connect", () => {
  console.log(`[Gateway Rele] Conectado com sucesso ao Broker MQTT em ${MQTT_BROKER_URL}`);
});
mqttClient.on("error", (err) => {
  console.error("[Gateway Rele] Não foi possível conectar ao Broker MQTT:", err);
  process.exit(1);
});

const promisePool = mysql.createPool(dbConfig);

function parseSelResponse(response) {
  try {
    const data = {};
    const cleanedResponse = response.replace("=>", "").trim();
    const parts = cleanedResponse.split(/\s+/);

    parts.forEach(part => {
      const [key, value] = part.split('=');
      if (key && value) {
        const numValue = parseFloat(value);
        switch (key.toUpperCase()) {
          case 'VA': data.tensao_a = numValue; break;
          case 'VB': data.tensao_b = numValue; break;
          case 'VC': data.tensao_c = numValue; break;
          case 'IA': data.corrente_a = numValue; break;
          case 'IB': data.corrente_b = numValue; break;
          case 'IC': data.corrente_c = numValue; break;
          case 'FREQ': data.frequencia = numValue; break;
        }
      }
    });

    data.payload_completo = response;
    data.timestamp_leitura = new Date().toISOString();

    return Object.keys(data).length > 2 ? data : null;
  } catch (error) {
    console.error("[Gateway Rele] Erro crítico ao analisar resposta do relé:", error);
    return null;
  }
}

function pollRele(rele) {
  console.log(`[Gateway Rele] Consultando relé: ${rele.nome_rele} (${rele.ip_address}:${rele.port})`);
  const client = new net.Socket();
  client.setTimeout(5000);

  client.connect(rele.port, rele.ip_address, () => {
    client.write("ME\r\n");
  });

  let responseData = "";
  client.on("data", (data) => {
    responseData += data.toString();
    if (responseData.includes("=>")) {
      client.end();
    }
  });

  client.on("close", () => {
    if (responseData) {
      const parsedData = parseSelResponse(responseData);
      if (parsedData) {
        const topic = `sel/reles/${rele.id}/status`;
        const payload = JSON.stringify({
            rele_id: rele.id,
            local_tag: rele.local_tag,
            ...parsedData
        });

        mqttClient.publish(topic, payload);
        console.log(`[Gateway Rele] -> [MQTT] Dados de '${rele.nome_rele}' publicados no tópico: ${topic}`);
      } else {
        console.warn(`[Gateway Rele] Resposta recebida de '${rele.nome_rele}', mas não foi possível analisar: ${responseData}`);
      }
    }
  });

  client.on("error", (err) => {
    console.error(`[Gateway Rele] Erro de conexão com '${rele.nome_rele}' (${rele.ip_address}:${rele.port}): ${err.message}`);
  });
  
  client.on('timeout', () => {
    console.error(`[Gateway Rele] Timeout na conexão com '${rele.nome_rele}'. O dispositivo não respondeu em 5 segundos.`);
    client.destroy();
  });
}

async function startService() {
  console.log("[Gateway Rele] Iniciando serviço de monitoramento de relés...");
  
  setInterval(async () => {
    try {
      const [reles] = await promisePool.query("SELECT * FROM dispositivos_reles WHERE ativo = 1");
      
      if (reles.length === 0) {
        console.log("[Gateway Rele] Nenhum relé ativo encontrado no banco de dados para monitorar. Verificando novamente em 10s.");
        return;
      }

      for (const rele of reles) {
        pollRele(rele);
      }
    } catch (err) {
      console.error("[Gateway Rele] Erro grave ao buscar relés no banco de dados:", err);
    }
  }, POLLING_INTERVAL_MS);
}

startService();
