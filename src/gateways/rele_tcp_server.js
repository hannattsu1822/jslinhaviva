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
const releClients = new Map();

function cleanString(rawString) {
    return rawString.replace(/[\x00-\x1F\x7F-\x9F]|¥%êX/g, '').trim();
}

function parseData(metResponse, tempResponse) {
    const data = {};
    const rawMet = metResponse; 
    const cleanedTemp = cleanString(tempResponse);

    try {
        const currentMatch = rawMet.match(/Current.*?\(A\).*?([\d.-]+).*?([\d.-]+).*?([\d.-]+)/s);
        if (currentMatch) {
            data.corrente_a = parseFloat(currentMatch[1]);
            data.corrente_b = parseFloat(currentMatch[2]);
            data.corrente_c = parseFloat(currentMatch[3]);
        }

        const voltageMatch = rawMet.match(/Voltage.*?\(V\).*?([\d.-]+).*?([\d.-]+).*?([\d.-]+)/s);
        if (voltageMatch) {
            data.tensao_a = parseFloat(voltageMatch[1]);
            data.tensao_b = parseFloat(voltageMatch[2]);
            data.tensao_c = parseFloat(voltageMatch[3]);
        }

        const frequencyMatch = rawMet.match(/Freque?ncy.*?\(Hz\)\s*=\s*([\d.-]+)/s);
        if (frequencyMatch) {
            const cleanNumber = frequencyMatch[1].replace(/[^\d.-]/g, '');
            data.frequencia = parseFloat(cleanNumber);
        }

        const tempAmbMatch = cleanedTemp.match(/AMBT \(deg\. C\)\s*:\s*([\d.-]+)/);
        if (tempAmbMatch) data.temperatura_ambiente = parseFloat(tempAmbMatch[1]);

        const tempHotSpotMatch = cleanedTemp.match(/HS \(deg\. C\)\s*:\s*([\d.-]+)/);
        if (tempHotSpotMatch) data.temperatura_enrolamento = parseFloat(tempHotSpotMatch[1]);
        
        const tempDeviceMatch = cleanedTemp.match(/TOILC \(deg\. C\)\s*:\s*([\d.-]+)/);
        if (tempDeviceMatch) data.temperatura_dispositivo = parseFloat(tempDeviceMatch[1]);

        const requiredKeys = [
            'corrente_a', 'corrente_b', 'corrente_c', 
            'tensao_a', 'tensao_b', 'tensao_c', 'frequencia'
        ];
        
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
    console.log(`[TCP Service] Nova conexão de ${remoteAddress}.`);

    socket.state = 'AWAITING_ID';
    socket.deviceId = null;
    socket.buffer = '';
    socket.metData = '';
    socket.tempData = '';

    const processBuffer = () => {
        if (socket.buffer.includes('=>')) {
            const parts = socket.buffer.split('=>');
            const completeResponse = parts.shift() + '=>'; // Pega a primeira resposta completa
            socket.buffer = parts.join('=>'); // Guarda o resto no buffer

            handleResponse(completeResponse);
        }
    };

    const handleResponse = (response) => {
        try {
            switch (socket.state) {
                case 'WAITING_LOGIN_CONFIRM':
                    releClients.set(socket.deviceId, socket);
                    socket.state = 'SENDING_MET';
                    sendNextCommand();
                    break;
                
                case 'WAITING_MET_RESPONSE':
                    socket.metData = response;
                    socket.state = 'SENDING_TEMP';
                    sendNextCommand();
                    break;

                case 'WAITING_TEMP_RESPONSE':
                    socket.tempData = response;
                    
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
                        console.log(`[TCP Service] [${socket.deviceId}] Dados VÁLIDOS (MET+THE) publicados.`);
                    } else {
                        console.warn(`[TCP Service] [${socket.deviceId}] Parser falhou. Descartando leitura.`);
                    }
                    
                    socket.state = 'IDLE';
                    console.log(`[TCP Service] [${socket.deviceId}] Ciclo concluído.`);
                    break;
            }
        } catch (err) {
            console.error(`[TCP Service] [${socket.deviceId}] Erro ao manusear resposta:`, err);
            socket.end();
        }
    };

    const sendNextCommand = () => {
        try {
            switch (socket.state) {
                case 'AWAITING_LOGIN':
                    socket.write("ACC\r\n");
                    socket.state = 'WAITING_LOGIN_CONFIRM';
                    break;
                
                case 'SENDING_MET':
                    console.log(`[TCP Service] [${socket.deviceId}] Enviando comando MET.`);
                    socket.write("MET\r\n");
                    socket.state = 'WAITING_MET_RESPONSE';
                    break;
                
                case 'SENDING_TEMP':
                    console.log(`[TCP Service] [${socket.deviceId}] Enviando comando THE.`);
                    socket.write("THE\r\n");
                    socket.state = 'WAITING_TEMP_RESPONSE';
                    break;
            }
        } catch (err) {
            console.error(`[TCP Service] [${socket.deviceId}] Erro ao enviar comando:`, err);
            socket.end();
        }
    };

    socket.on('data', async (data) => {
        socket.buffer += data.toString('latin1');
        processBuffer();
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
            const clientIp = socket.remoteAddress.includes('::') ? socket.remoteAddress.split(':').pop() : socket.remoteAddress;
            const [rows] = await promisePool.query("SELECT id, local_tag FROM dispositivos_reles WHERE ip_address = ? AND ativo = 1", [clientIp]);
            if (rows.length > 0) {
                socket.deviceId = rows[0].local_tag;
                socket.rele_id_db = rows[0].id;
                console.log(`[TCP Service] Dispositivo identificado como '${socket.deviceId}' (ID: ${socket.rele_id_db}).`);
                socket.state = 'AWAITING_LOGIN';
                sendNextCommand();
            } else {
                console.warn(`[TCP Service] Nenhum dispositivo ativo para o IP "${clientIp}".`);
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
    for (const [deviceId, socket] of releClients.entries()) {
        if (socket.state === 'IDLE' && socket.writable) {
            console.log(`[Polling Loop] [${deviceId}] Disparando novo ciclo de coleta.`);
            socket.state = 'SENDING_MET';
            sendNextCommand();
        }
    }
}, pollInterval);
