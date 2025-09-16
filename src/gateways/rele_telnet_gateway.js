const path = require('path');
require("dotenv").config({ path: path.resolve(__dirname, '../../.env') });

const { Telnet } = require('telnet-client');
const mqtt = require("mqtt");
const mysql = require("mysql2/promise");

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const POLLING_INTERVAL_MS = 15000; // A cada 15 segundos

const dbConfig = {
  host: '127.0.0.1',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const mqttClient = mqtt.connect(MQTT_BROKER_URL);
const promisePool = mysql.createPool(dbConfig);

function parseSelData(rawString) {
  const data = {};
  try {
    let cleanedString = rawString.replace(/[\x00-\x1F\x7F-\x9F]+/g, " ").trim();
    
    const currentMatch = cleanedString.match(/Current Magnitude \(A\)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)/);
    if (currentMatch) {
      data.corrente_a = parseFloat(currentMatch[1]);
      data.corrente_b = parseFloat(currentMatch[2]);
      data.corrente_c = parseFloat(currentMatch[3]);
    }

    const voltageMatch = cleanedString.match(/Voltage Magnitude \(V\)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)/);
    if (voltageMatch) {
      data.tensao_a = parseFloat(voltageMatch[1]);
      data.tensao_b = parseFloat(voltageMatch[2]);
      data.tensao_c = parseFloat(voltageMatch[3]);
    }

    const frequencyMatch = cleanedString.match(/Frequency \(Hz\)\s*=\s*([\d.-]+)/);
    if (frequencyMatch) {
      data.frequencia = parseFloat(frequencyMatch[1]);
    }

    if (Object.keys(data).length === 0) return null;
    return data;
  } catch (error) {
    console.error("[Telnet Gateway] Erro ao fazer parse:", error);
    return null;
  }
}

async function pollRele(rele) {
  const connection = new Telnet();

  const params = {
    host: rele.ip_address,
    port: rele.port,
    shellPrompt: '=>',
    loginPrompt: 'User>',
    passwordPrompt: 'Password>',
    username: 'ACC',
    password: 'OTTER',
    timeout: 10000
  };

  console.log(`[Telnet Gateway] Conectando ao relé ${rele.nome_rele} em ${params.host}:${params.port}...`);

  try {
    await connection.connect(params);
    console.log(`[Telnet Gateway] [${rele.local_tag}] Conectado e logado com sucesso.`);

    const response = await connection.exec('MET');
    console.log(`[Telnet Gateway] [${rele.local_tag}] Resposta do comando MET recebida.`);

    const parsedData = parseSelData(response);
    if (parsedData) {
      const timestamp = new Date();
      const { tensao_a, tensao_b, tensao_c, corrente_a, corrente_b, corrente_c, frequencia } = parsedData;
      
      const topic = `sel/reles/${rele.id}/status`;
      const payload = JSON.stringify({ 
        rele_id: rele.id, 
        local_tag: rele.local_tag, 
        ...parsedData, 
        timestamp_leitura: timestamp.toISOString(),
        payload_completo: response
      });
      mqttClient.publish(topic, payload);
      console.log(`[Telnet Gateway] [${rele.local_tag}] SUCESSO: Dados publicados no MQTT.`);

    } else {
      console.warn(`[Telnet Gateway] [${rele.local_tag}] Parser falhou ao extrair dados.`);
    }

  } catch (error) {
    console.error(`[Telnet Gateway] [${rele.local_tag}] ERRO GERAL:`, error.message || error);
  } finally {
    try {
      await connection.end();
    } catch (e) { /* ignora erros ao fechar */ }
  }
}

async function startService() {
  console.log("[Telnet Gateway] Iniciando serviço...");
  setInterval(async () => {
    try {
      const [reles] = await promisePool.query("SELECT * FROM dispositivos_reles WHERE ativo = 1");
      for (const rele of reles) {
        await pollRele(rele);
      }
    } catch (err) {
      console.error("[Telnet Gateway] Erro ao buscar relés no DB:", err);
    }
  }, POLLING_INTERVAL_MS);
}

startService();
