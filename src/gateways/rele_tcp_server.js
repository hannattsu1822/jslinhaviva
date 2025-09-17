const path = require('path');
require("dotenv").config({ path: path.resolve(__dirname, '../../.env') });

const net = require("net");
const mysql =require("mysql2/promise");
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
    // eslint-disable-next-line no-control-regex
    return rawString.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
}

function parseData(metResponse, staResponse, tempResponse) {
    const data = {};
    const cleanedMet = cleanString(metResponse);
    const cleanedSta = cleanString(staResponse);
    const cleanedTemp = cleanString(tempResponse);

    // --- LOGS DE DEPURAÇÃO ---
    console.log("--- INICIANDO PARSING ---");
    console.log("Resposta MET (limpa):");
    console.log(cleanedMet);
    console.log("-------------------------");
    // --- FIM DOS LOGS ---

    try {
        // --- Parsing do MET (Medições Elétricas) ---
        const currentMatch = cleanedMet.match(/Current[\s\S]*?\(A\)[\s\S]*?([\d.-]+)[\s\S]*?([\d.-]+)[\s\S]*?([\d.-]+)/);
        if (currentMatch) {
            data.corrente_a = parseFloat(currentMatch[1]);
            data.corrente_b = parseFloat(currentMatch[2]);
            data.corrente_c = parseFloat(currentMatch[3]);
        }

        const voltageMatch = cleanedMet.match(/Voltage[\s\S]*?\(V\)[\s\S]*?([\d.-]+)[\s\S]*?([\d.-]+)[\s\S]*?([\d.-]+)/);
        if (voltageMatch) {
            data.tensao_a = parseFloat(voltageMatch[1]);
            data.tensao_b = parseFloat(voltageMatch[2]);
            data.tensao_c = parseFloat(voltageMatch[3]);
        }

        const frequencyMatch = cleanedMet.match(/Frequency[\s\S]*?\(Hz\)[\s\S]*?=\s*([\d.-]+)/);
        if (frequencyMatch) data.frequencia = parseFloat(frequencyMatch[1]);

        // --- Parsing do STA (Status) ---
        const targetMatch = cleanedSta.match(/TARGET\s+=\s+([A-Z]+)/);
        if (targetMatch) data.target_status = targetMatch[1];

        const selfTestMatch = cleanedSta.match(/SELF-TEST\s+=\s+([A-Z]+)/);
        if (selfTestMatch) data.self_test_status = selfTestMatch[1];

        const alarmMatch = cleanedSta.match(/ALARM\s+=\s+([A-Z\s]+)/);
        if (alarmMatch) data.alarm_status = alarmMatch[1].trim();

        // --- Parsing da Temperatura (Comando THE) ---
        const temps = cleanedTemp.matchAll(/([\d.-]+)\s*C/g);
        const tempValues = Array.from(temps, m => parseFloat(m[1]));
        
        if (tempValues.length >= 3) {
            data.temperatura_dispositivo = tempValues[0];
            data.temperatura_ambiente = tempValues[1];
            data.temperatura_enrolamento = tempValues[2];
        } else if (tempValues.length > 0) {
            data.temperatura_dispositivo = tempValues[0];
        }

        // --- Validação Final e Completa ---
        const requiredKeys = [
            'corrente_a', 'corrente_b', 'corrente_c', 
            'tensao_a', 'tensao_b', 'tensao_c', 'frequencia',
            'target_status', 'self_test_status', 'alarm_status'
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
    socket.staData = '';
    socket.tempData = '';

    socket.on('data', async (data) => {
        const rawText = data.toString('latin1');
        if (!rawText) return;
        socket.buffer += rawText;

        try {
            switch (socket.state) {
                case 'AWAITING_LOGIN':
                    socket.write("ACC\r\n");
                    socket.state = 'AWAITING_PASS_PROMPT';
                    break;

                case 'AWAITING_PASS_PROMPT':
                    if (socket.buffer.includes('Password:')) {
                        socket.buffer = '';
                        socket.write("OTTER\r\n");
                        socket.state = 'AWAITING_LOGIN_CONFIRM';
                    } else if (socket.buffer.includes('=>')) {
                        socket.buffer = '';
                        releClients.set(socket.deviceId, socket);
                        socket.state = 'SENDING_MET';
                        socket.emit('data', '');
                    }
                    break;

                case 'AWAITING_LOGIN_CONFIRM':
                    if (socket.buffer.includes('=>')) {
                        socket.buffer = '';
                        releClients.set(socket.deviceId, socket);
                        socket.state = 'SENDING_MET';
                        socket.emit('data', '');
                    }
                    break;
                
                case 'SENDING_MET':
                    console.log(`[TCP Service] [${socket.deviceId}] Enviando comando MET.`);
                    socket.buffer = '';
                    socket.write("MET\r\n");
                    socket.state = 'WAITING_MET_RESPONSE';
                    break;

                case 'WAITING_MET_RESPONSE':
                    if (socket.buffer.includes('=>')) {
                        socket.metData = socket.buffer;
                        socket.buffer = '';
                        socket.state = 'SENDING_STA';
                        socket.emit('data', '');
                    }
                    break;

                case 'SENDING_STA':
                    console.log(`[TCP Service] [${socket.deviceId}] Enviando comando STA.`);
                    socket.buffer = '';
                    socket.write("STA\r\n");
                    socket.state = 'WAITING_STA_RESPONSE';
                    break;

                case 'WAITING_STA_RESPONSE':
                    if (socket.buffer.includes('=>')) {
                        socket.staData = socket.buffer;
                        socket.buffer = '';
                        socket.state = 'SENDING_TEMP';
                        socket.emit('data', '');
                    }
                    break;
                
                case 'SENDING_TEMP':
                    console.log(`[TCP Service] [${socket.deviceId}] Enviando comando THE.`);
                    socket.buffer = '';
                    socket.write("THE\r\n");
                    socket.state = 'WAITING_TEMP_RESPONSE';
                    break;

                case 'WAITING_TEMP_RESPONSE':
                    if (socket.buffer.includes('=>')) {
                        socket.tempData = socket.buffer;
                        socket.buffer = '';
                        
                        const parsedData = parseData(socket.metData, socket.staData, socket.tempData);
                        if (parsedData) {
                            const topic = `sel/reles/${socket.rele_id_db}/status`;
                            const now = new Date();
                            const timestampMySQL = now.toISOString().slice(0, 19).replace('T', ' ');

                            const payload = JSON.stringify({
                                rele_id: socket.rele_id_db,
                                local_tag: socket.deviceId,
                                ...parsedData,
                                timestamp_leitura: timestampMySQL,
                                payload_completo: `MET:\n${socket.metData}\nSTA:\n${socket.staData}\nTEMP:\n${socket.tempData}`
                            });
                            mqttClient.publish(topic, payload);
                            console.log(`[TCP Service] [${socket.deviceId}] Dados VÁLIDOS (MET+STA+THE) publicados.`);
                        } else {
                            console.warn(`[TCP Service] [${socket.deviceId}] Parser falhou. Descartando leitura.`);
                        }
                        
                        socket.state = 'IDLE';
                        c
