const path = require('path');
require("dotenv").config({ path: path.resolve(__dirname, '../../.env') });

const net = require("net");
const mysql = require("mysql2/promise");
const mqtt = require("mqtt");

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

function parseTelnetData(data) {
  const buffer = Buffer.from(data);
  let output = '';
  let i = 0;
  
  while (i < buffer.length) {
    if (buffer[i] === 0xFF) {
      if (i + 2 >= buffer.length) break;
      
      const command = buffer[i + 1];
      const option = buffer[i + 2];
      
      if (command === 0xFB || command === 0xFC || command === 0xFD || command === 0xFE) {
        i += 3;
        continue;
      }
      
      if (command === 0xFA) {
        let j = i + 3;
        while (j < buffer.length && buffer[j] !== 0xF0) {
          j++;
        }
        i = j + 1;
      } else {
        i += 3;
      }
    } else {
      if (buffer[i] >= 32 && buffer[i] <= 126) {
        output += String.fromCharCode(buffer[i]);
      }
      i++;
    }
  }
  
  return output;
}

function parseData(metResponse, tempResponse) {
    const data = {};
    const metStartIndex = metResponse.indexOf('SEL-2414');
    const tempStartIndex = tempResponse.indexOf('SEL-2414');
    if (metStartIndex === -1 || tempStartIndex === -1) {
        console.warn("[TCP Parser] Padrão 'SEL-2414' não encontrado. Descartando.");
        return null;
    }
    const cleanMet = metResponse.substring(metStartIndex);
    const cleanTemp = tempResponse.substring(tempStartIndex);
    try {
        const currentMatch = cleanMet.match(/Current.*?\(A\).*?([\d.-]+).*?([\d.-]+).*?([\d.-]+)/s);
        if (currentMatch) {
            data.corrente_a = parseFloat(currentMatch[1]);
            data.corrente_b = parseFloat(currentMatch[2]);
            data.corrente_c = parseFloat(currentMatch[3]);
        }
        const voltageMatch = cleanMet.match(/Voltage.*?\(V\).*?([\d.-]+).*?([\d.-]+).*?([\d.-]+)/s);
        if (voltageMatch) {
            data.tensao_a = parseFloat(voltageMatch[1]);
            data.tensao_b = parseFloat(voltageMatch[2]);
            data.tensao_c = parseFloat(voltageMatch[3]);
        }
        const frequencyMatch = cleanMet.match(/Freque?ncy.*?\(Hz\)\s*=\s*([\d.-]+)/s);
        if (frequencyMatch) {
            const cleanNumber = frequencyMatch[1].replace(/[^\d.-]/g, '');
            data.frequencia = parseFloat(cleanNumber);
        }
        const tempAmbMatch = cleanTemp.match(/AMBT \(deg\. C\)\s*:\s*([\d.-]+)/);
        if (tempAmbMatch) data.temperatura_ambiente = parseFloat(tempAmbMatch[1]);
        const tempHotSpotMatch = cleanTemp.match(/HS \(deg\. C\)\s*:\s*([\d.-]+)/);
        if (tempHotSpotMatch) data.temperatura_enrolamento = parseFloat(tempHotSpotMatch[1]);
        const tempDeviceMatch = cleanTemp.match(/TOILC \(deg\. C\)\s*:\s*([\d.-]+)/);
        if (tempDeviceMatch) data.temperatura_dispositivo = parseFloat(tempDeviceMatch[1]);
        const requiredKeys = ['corrente_a', 'corrente_b', 'corrente_c', 'tensao_a', 'tensao_b', 'tensao_c', 'frequencia'];
        for (const key of requiredKeys) {
            if (data[key] === undefined || (typeof data[key] === 'number' && isNaN(data[key]))) {
                console.warn(`[TCP Parser] Falha ao extrair o valor obrigatório de '${key}'.`);
                return null;
            }
        }
        return data;
    } catch (error) {
        console.error("[TCP Parser] Erro crítico ao fazer parse:", error);
        return null;
    }
}

const server = net.createServer((socket) => {
    const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP Service] Nova conexão de ${remoteAddress}. Aguardando pacote de identidade customizado.`);

    socket.state = 'AWAITING_IDENTITY';
    socket.deviceId = null;
    socket.rele_id_db = null;
    socket.buffer = '';
    socket.metData = '';
    socket.tempData = '';
    socket.pollTimer = null;

    const startPolling = () => {
        if (socket.pollTimer) clearInterval(socket.pollTimer);
        const poll = () => {
            if (!socket.writable) {
                console.warn(`[Polling] Socket para ${socket.deviceId} não está gravável. Encerrando.`);
                socket.end();
                return;
            }
            console.log(`[Polling] [${socket.deviceId}] Iniciando ciclo de coleta.`);
            socket.buffer = '';
            socket.metData = '';
            socket.tempData = '';
            setTimeout(() => {
                console.log(`[Polling] [${socket.deviceId}] Enviando MET.`);
                socket.write("MET\r\n");
            }, 500);
            setTimeout(() => {
                socket.metData = socket.buffer;
                socket.buffer = '';
                console.log(`[Polling] [${socket.deviceId}] Enviando THE.`);
                socket.write("THE\r\n");
            }, 2500);
            setTimeout(() => {
                socket.tempData = socket.buffer;
                socket.buffer = '';
                const parsedData = parseData(socket.metData, socket.tempData);
                if (parsedData) {
                    const topic = `sel/reles/${socket.rele_id_db}/status`;
                    const now = new Date();
                    const timestampMySQL = now.toISOString().slice(0, 19).replace('T', ' ');
                    const payload = JSON.stringify({
                        rele_id: socket.rele_id_db,
                        local_tag: socket.deviceId,
                        ...parsedData,
                        timestamp_leitura: timestampMySQL,
                        payload_completo: `MET:\n${socket.metData}\nTEMP:\n${socket.tempData}`
                    });
                    mqttClient.publish(topic, payload);
                    console.log(`[Polling] [${socket.deviceId}] Dados VÁLIDOS publicados.`);
                } else {
                    console.warn(`[Polling] [${socket.deviceId}] Parser falhou.`);
                }
            }, 4500);
        };
        poll();
        socket.pollTimer = setInterval(poll, pollInterval);
    };

    socket.on('data', async (data) => {
        if (socket.state === 'AWAITING_IDENTITY') {
            console.log(`[TELNET DEBUG] Recebido ${data.length} bytes: ${data.toString('hex')}`);
            
            const cleanData = parseTelnetData(data);
            const customId = cleanData.trim();
            
            console.log(`[TELNET DEBUG] Após filtro: '${customId}' (${customId.length} chars)`);
            
            if (!customId || customId.length < 1) {
                console.warn(`[TCP Service] ID vazio ou inválido após filtro Telnet`);
                return;
            }

            try {
                const [rows] = await promisePool.query("SELECT id, local_tag FROM dispositivos_reles WHERE custom_id = ? AND ativo = 1", [customId]);
                if (rows.length > 0) {
                    socket.deviceId = rows[0].local_tag;
                    socket.rele_id_db = rows[0].id;
                    console.log(`[TCP Service] Dispositivo identificado como '${socket.deviceId}' (ID: ${socket.rele_id_db}). Iniciando login.`);
                    socket.state = 'LOGGING_IN';
                    
                    setTimeout(() => socket.write("ACC\r\n"), 500);
                    setTimeout(() => socket.write("OTTER\r\n"), 1500);
                    setTimeout(() => {
                        console.log(`[TCP Service] Login para ${socket.deviceId} concluído. Iniciando polling.`);
                        socket.buffer = '';
                        startPolling();
                    }, 2500);

                } else {
                    console.warn(`[TCP Service] Nenhum dispositivo ativo encontrado para o ID Customizado "${customId}".`);
                    socket.end();
                }
            } catch (err) {
                console.error("[TCP Service] Erro de DB ao identificar por ID Customizado:", err);
                socket.end();
            }
        } else {
            const filteredData = parseTelnetData(data);
            socket.buffer += filteredData;
        }
    });

    socket.on("close", () => {
        if (socket.pollTimer) clearInterval(socket.pollTimer);
        console.log(`[TCP Service] Conexão com ${socket.deviceId || remoteAddress} fechada.`);
    });

    socket.on("error", (err) => {
        console.error(`[TCP Service] Erro no socket de ${remoteAddress}:`, err.message);
    });
});

server.listen(port, () => {
    console.log(`[TCP Service] Servidor TCP ouvindo na porta ${port}`);
});
