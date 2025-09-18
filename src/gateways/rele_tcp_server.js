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

function extractDeviceIdFromBinary(data) {
  const buffer = Buffer.from(data);
  const hexId = buffer.toString('hex');
  console.log(`[BINARY DEBUG] Dados recebidos em hex: ${buffer.toString('hex')}`);
  console.log(`[BINARY DEBUG] ID extraído como string HEX: '${hexId}'`);
  return hexId;
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
        // ====================================================================
        // REGEX FINAL E ROBUSTA PARA CORRENTE
        // ====================================================================
        const currentMatch = cleanMet.match(/Current Magnitude \(A\)\s*?([\d.-]+)\s*?([\d.-]+)\s*?([\d.-]+)/);
        if (currentMatch) {
            data.corrente_a = parseFloat(currentMatch[1]);
            data.corrente_b = parseFloat(currentMatch[2]);
            data.corrente_c = parseFloat(currentMatch[3]);
        }

        const voltagePhaseMatch = cleanMet.match(/VA\s+VB\s+VC[\s\S]*?Voltage.*?\(V\)\s*?([\d.-]+)\s*?([\d.-]+)\s*?([\d.-]+)/);
        if (voltagePhaseMatch) {
            data.tensao_va = parseFloat(voltagePhaseMatch[1]);
            data.tensao_vb = parseFloat(voltagePhaseMatch[2]);
            data.tensao_vc = parseFloat(voltagePhaseMatch[3]);
        }

        const voltageLineMatch = cleanMet.match(/VAB\s+VBC\s+VCA[\s\S]*?Voltage.*?\(V\)\s*?([\d.-]+)\s*?([\d.-]+)\s*?([\d.-]+)/);
        if (voltageLineMatch) {
            data.tensao_vab = parseFloat(voltageLineMatch[1]);
            data.tensao_vbc = parseFloat(voltageLineMatch[2]);
            data.tensao_vca = parseFloat(voltageLineMatch[3]);
        }

        const frequencyMatch = cleanMet.match(/ncy.*?\(Hz\)\s*=\s*([\d.-]+)/);
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
        
        const requiredKeys = ['corrente_a', 'corrente_b', 'corrente_c', 'tensao_va', 'tensao_vb', 'tensao_vc', 'frequencia'];
        for (const key of requiredKeys) {
            if (data[key] === undefined || (typeof data[key] === 'number' && isNaN(data[key]))) {
                console.warn(`[TCP Parser] Falha ao extrair o valor obrigatório de '${key}'. A leitura será descartada.`);
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

                const cleanedMetData = socket.metData.replace(/[^\x20-\x7E\r\n]/g, '');
                const cleanedTempData = socket.tempData.replace(/[^\x20-\x7E\r\n]/g, '');

                const parsedData = parseData(cleanedMetData, cleanedTempData);
                
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
                    console.warn(`[Polling] [${socket.deviceId}] Parser falhou. Nenhuma leitura será publicada.`);
                }
            }, 4500);
        };
        poll();
        socket.pollTimer = setInterval(poll, pollInterval);
    };

    socket.on('data', async (data) => {
        if (socket.state === 'AWAITING_IDENTITY') {
            const customId = extractDeviceIdFromBinary(data);
            
            if (!customId || customId.length < 1) {
                console.warn(`[TCP Service] ID vazio ou inválido após extração binária`);
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
            socket.buffer += data.toString('latin1');
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
