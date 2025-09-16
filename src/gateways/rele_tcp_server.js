const path = require('path');
require("dotenv").config({ path: path.resolve(__dirname, '../../.env') });

const net = require("net");
const mysql = require("mysql2/promise");
const mqtt = require("mqtt");

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const port = process.env.TCP_SERVER_PORT || 4000;
const pollInterval = 15000;

const dbConfig = {
  host: '127.0.0.1',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const promisePool = mysql.createPool(dbConfig);
const mqttClient = mqtt.connect(MQTT_BROKER_URL);
const releClients = new Map();

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
    console.error("[TCP Service] Erro ao fazer parse:", error);
    return null;
  }
}

const server = net.createServer((socket) => {
  const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[TCP Service] Nova conexão de ${remoteAddress}.`);

  socket.state = 'AWAITING_REGISTRATION';
  socket.deviceId = null;
  socket.buffer = '';

  // Listener ÚNICO e PERSISTENTE para todos os dados
  socket.on('data', async (data) => {
    socket.buffer += data.toString();

    // Lógica de Registro
    if (socket.state === 'AWAITING_REGISTRATION') {
      const deviceId = data.toString('hex').toUpperCase();
      socket.buffer = ''; // Limpa o buffer após o registro
      try {
        const [rows] = await promisePool.query("SELECT id FROM dispositivos_reles WHERE local_tag = ? AND ativo = 1", [deviceId]);
        if (rows.length > 0) {
          socket.deviceId = deviceId;
          socket.rele_id_db = rows[0].id;
          releClients.set(deviceId, socket);
          console.log(`[TCP Service] [${deviceId}] Registrado. Enviando 'ACC'.`);
          socket.state = 'AWAITING_USER_PROMPT';
          socket.write("ACC\r\n");
        } else {
          console.warn(`[TCP Service] MAC "${deviceId}" não encontrado. Fechando.`);
          socket.end();
        }
      } catch (err) {
        console.error("[TCP Service] Erro de DB no registro:", err);
        socket.end();
      }
      return;
    }

    // Lógica de Conversa (Login e Polling)
    // Processa o buffer apenas quando a mensagem estiver completa
    if (socket.buffer.includes('=>') || socket.buffer.includes('User>') || socket.buffer.includes('Password>')) {
      const responseStr = socket.buffer.trim();
      socket.buffer = ''; // Limpa o buffer para a próxima mensagem
      console.log(`[TCP Service] [${socket.deviceId}] Mensagem completa recebida.`);

      switch (socket.state) {
        case 'AWAITING_USER_PROMPT':
          console.log(`[TCP Service] [${socket.deviceId}] Enviando 'OTTER'.`);
          socket.state = 'AWAITING_PASS_PROMPT';
          socket.write("OTTER\r\n");
          break;
        
        case 'AWAITING_PASS_PROMPT':
          console.log(`[TCP Service] [${socket.deviceId}] Login concluído.`);
          socket.state = 'LOGGED_IN_IDLE';
          break;

        case 'LOGGED_IN_WAITING_RESPONSE':
          const parsedData = parseSelData(responseStr);
          if (parsedData) {
            const topic = `sel/reles/${socket.rele_id_db}/status`;
            const payload = JSON.stringify({
              rele_id: socket.rele_id_db,
              local_tag: socket.deviceId,
              ...parsedData,
              timestamp_leitura: new Date().toISOString(),
              payload_completo: responseStr
            });
            mqttClient.publish(topic, payload);
            console.log(`[TCP Service] [${socket.deviceId}] Dados publicados no MQTT.`);
          } else {
            console.warn(`[TCP Service] [${socket.deviceId}] Parser falhou.`);
          }
          socket.state = 'LOGGED_IN_IDLE';
          break;
      }
    }
  });

  socket.on("close", () => {
    if (socket.deviceId) releClients.delete(socket.deviceId);
    console.log(`[TCP Service] Conexão com ${socket.deviceId || remoteAddress} fechada.`);
  });
  socket.on("error", (err) => {
    console.error(`[TCP Service] Erro no socket de ${remoteAddress}:`, err.message);
  });
});

server.listen(port, () => {
  console.log(`[TCP Service] Servidor TCP ouvindo na porta ${port}`);
});

setInterval(() => {
  for (const socket of releClients.values()) {
    if (socket.state === 'LOGGED_IN_IDLE' && socket.writable) {
      console.log(`[TCP Service] [${socket.deviceId}] Enviando comando 'MET'.`);
      socket.state = 'LOGGED_IN_WAITING_RESPONSE';
      socket.write("MET\r\n");
    }
  }
}, pollInterval);
