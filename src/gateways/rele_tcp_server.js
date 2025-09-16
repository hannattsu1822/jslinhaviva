const path = require('path');
require("dotenv").config({ path: path.resolve(__dirname, '../../.env') });

const net = require("net");
const mysql = require("mysql2/promise");
const mqtt =require("mqtt");

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const port = process.env.TCP_SERVER_PORT || 4000;
const pollInterval = 60000;

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
    let cleanedString = rawString.replace(/[\x00-\x1F\x7F-\x9F]+/g, "").trim();
    
    const currentMatch = cleanedString.match(/Current Magnitude \(A\)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+[\d.-]+/);
    if (currentMatch) {
      data.corrente_a = parseFloat(currentMatch[1]);
      data.corrente_b = parseFloat(currentMatch[2]);
      data.corrente_c = parseFloat(currentMatch[3]);
    }

    const voltageMatch = cleanedString.match(/ge Magnitude \(V\)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+[\d.-]+/);
    if (voltageMatch) {
      data.tensao_a = parseFloat(voltageMatch[1]);
      data.tensao_b = parseFloat(voltageMatch[2]);
      data.tensao_c = parseFloat(voltageMatch[3]);
    }

    const frequencyMatch = cleanedString.match(/Frequency \(Hz\)\s*=\s*([\d.-]+)/);
    if (frequencyMatch) {
      data.frequencia = parseFloat(frequencyMatch[1]);
    }

    if (Object.keys(data).length < 3) return null;
    return data;
  } catch (error) {
    console.error("[TCP Service] Erro ao fazer parse:", error);
    return null;
  }
}

const server = net.createServer((socket) => {
  const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[TCP Service] Nova conexão de ${remoteAddress}.`);

  socket.state = 'AWAITING_ID';
  socket.deviceId = null;
  socket.buffer = '';

  socket.on('data', async (data) => {
    const cleanedData = data.toString().replace(/[\x00-\x1F\x7F-\x9F]+/g, "");
    if (!cleanedData) return;

    socket.buffer += cleanedData;

    try {
      switch (socket.state) {
        
        case 'AWAITING_LOGIN':
          console.log(`[TCP Service] [${socket.deviceId}] Iniciando sequência de login.`);
          socket.state = 'AWAITING_ACC_RESPONSE';
          socket.write("ACC\r\n");
          break;

        case 'AWAITING_ACC_RESPONSE':
          if (socket.buffer.includes('Password:')) {
            console.log(`[TCP Service] [${socket.deviceId}] Prompt de senha recebido. Enviando senha.`);
            socket.buffer = '';
            socket.state = 'AWAITING_LOGIN_CONFIRMATION';
            socket.write("OTTER\r\n");
          } else if (socket.buffer.includes('=>')) {
            console.log(`[TCP Service] [${socket.deviceId}] Login direto detectado. Enviando MET.`);
            socket.buffer = '';
            socket.state = 'LOGGED_IN_WAITING_RESPONSE';
            releClients.set(socket.deviceId, socket);
            socket.write("MET\r\n");
          }
          break;

        case 'AWAITING_LOGIN_CONFIRMATION':
          if (socket.buffer.includes('=>')) {
            console.log(`[TCP Service] [${socket.deviceId}] Login com senha bem-sucedido. Enviando MET.`);
            socket.buffer = '';
            socket.state = 'LOGGED_IN_WAITING_RESPONSE';
            releClients.set(socket.deviceId, socket);
            socket.write("MET\r\n");
          }
          break;
        
        case 'LOGGED_IN_WAITING_RESPONSE':
            if (socket.buffer.includes('=>')) {
                const responseStr = socket.buffer;
                socket.buffer = '';

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
                    console.warn(`[TCP Service] [${socket.deviceId}] Parser falhou ao extrair dados da resposta.`);
                }
                
                socket.state = 'LOGGED_IN_IDLE';
                console.log(`[TCP Service] [${socket.deviceId}] Ciclo de coleta concluído. Aguardando próximo intervalo.`);
            }
            break;
      }
    } catch(err) {
        console.error(`[TCP Service] [${socket.deviceId || remoteAddress}] Erro na máquina de estados:`, err);
        socket.end();
    }
  });

  socket.on("close", () => {
    if (socket.deviceId) releClients.delete(socket.deviceId);
    console.log(`[TCP Service] Conexão com ${socket.deviceId || remoteAddress} fechada.`);
  });

  socket.on("error", (err) => {
    console.error(`[TCP Service] Erro no socket de ${remoteAddress}:`, err.message);
  });

  (async () => {
    try {
      const clientIp = socket.remoteAddress.includes('::') 
          ? socket.remoteAddress.split(':').pop() 
          : socket.remoteAddress;

      console.log(`[TCP Service] Tentando identificar dispositivo pelo IP: ${clientIp}`);
      const [rows] = await promisePool.query("SELECT id, local_tag FROM dispositivos_reles WHERE ip_address = ? AND ativo = 1", [clientIp]);

      if (rows.length > 0) {
        socket.deviceId = rows[0].local_tag;
        socket.rele_id_db = rows[0].id;
        console.log(`[TCP Service] Dispositivo identificado como '${socket.deviceId}' (ID: ${socket.rele_id_db}). Iniciando ciclo de coleta.`);
        socket.state = 'AWAITING_LOGIN';
        socket.emit('data', '');
      } else {
        console.warn(`[TCP Service] Nenhum dispositivo ativo encontrado para o IP "${clientIp}". Fechando conexão.`);
        socket.end();
      }
    } catch (err) {
      console.error("[TCP Service] Erro de DB ao identificar por IP:", err);
      socket.end();
    }
  })();
});

server.listen(port, () => {
  console.log(`[TCP Service] Servidor TCP ouvindo na porta ${port}`);
});

setInterval(() => {
  for (const socket of releClients.values()) {
    if (socket.state === 'LOGGED_IN_IDLE' && socket.writable) {
      console.log(`[Polling Loop] [${socket.deviceId}] Disparando novo ciclo de login e coleta.`);
      socket.state = 'AWAITING_LOGIN';
      socket.emit('data', '');
    }
  }
}, pollInterval);
