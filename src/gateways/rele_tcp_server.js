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
    console.log(`[BINARY DEBUG] Dados recebidos em hex: ${hexId}`);
    return hexId;
}

function parseData(metResponse, tempResponse) {
    const data = {};
    const cleanMet = metResponse.replace(/[^\x20-\x7E\r\n]/g, '');
    const cleanTemp = tempResponse.replace(/[^\x20-\x7E\r\n]/g, '');

    const findNumbers = (str) => {
        if (!str) return [];
        const matches = str.match(/-?\d[\d.,]*/g);
        return matches ? matches.map(s => parseFloat(s.replace(',', '.'))) : [];
    };

    try {
        const currentBlockMatch = cleanMet.match(/Current Magnitude \(A\)([\s\S]*?)(?=Current Angle|3I2X)/);
        if (currentBlockMatch) {
            const numbers = findNumbers(currentBlockMatch[1]);
            if (numbers.length >= 3) {
                data.corrente_a = numbers[0];
                data.corrente_b = numbers[1];
                data.corrente_c = numbers[2];
            }
        }

        const phaseVoltageBlockMatch = cleanMet.match(/VA\s+VB\s+VC[\s\S]*?Voltage Magnitude \(V\)([\s\S]*?)(?=Voltage Angle)/);
        if (phaseVoltageBlockMatch) {
            const numbers = findNumbers(phaseVoltageBlockMatch[1]);
            if (numbers.length >= 3) {
                data.tensao_va = numbers[0];
                data.tensao_vb = numbers[1];
                data.tensao_vc = numbers[2];
            }
        }

        const lineVoltageBlockMatch = cleanMet.match(/VAB\s+VBC\s+VCA[\s\S]*?Voltage Magnitude \(V\)([\s\S]*?)(?=Voltage Angle)/);
        if (lineVoltageBlockMatch) {
            const numbers = findNumbers(lineVoltageBlockMatch[1]);
            if (numbers.length >= 3) {
                data.tensao_vab = numbers[0];
                data.tensao_vbc = numbers[1];
                data.tensao_vca = numbers[2];
            }
        }

        const frequencyMatch = cleanMet.match(/ncy \(Hz\)\s*=\s*([\d.-]+)/);
        if (frequencyMatch) {
            data.frequencia = parseFloat(frequencyMatch[1]);
        }

        const tempLines = cleanTemp.split('\n');
        for (const line of tempLines) {
            if (line.includes('AMBT (deg. C)')) {
                const numbers = findNumbers(line);
                if (numbers.length > 0) data.temperatura_ambiente = numbers[0];
            } else if (line.includes('HS (deg. C)')) {
                const numbers = findNumbers(line);
                if (numbers.length > 0) data.temperatura_enrolamento = numbers[0];
            } else if (line.includes('TOILC (deg. C)')) {
                const numbers = findNumbers(line);
                if (numbers.length > 0) data.temperatura_dispositivo = numbers[0];
            }
        }
        
        const requiredKeys = ['corrente_a', 'corrente_b', 'corrente_c', 'tensao_va', 'tensao_vb', 'tensao_vc', 'frequencia'];
        for (const key of requiredKeys) {
            if (data[key] === undefined || (typeof data[key] === 'number' && isNaN(data[key]))) {
                console.warn(`[TCP Parser] Falha ao extrair o valor obrigatório de '${key}'. A leitura será descartada.`);
                return null;
            }
        }
        
        console.log('[TCP Parser] Sucesso! Todos os valores extraídos.', data);
        return data;
    } catch (error) {
        console.error("[TCP Parser] Erro crítico ao fazer parse:", error);
        return null;
    }
}

const server = net.createServer((socket) => {
    const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP Service] Nova conexão de ${remoteAddress}.`);

    socket.state = 'AWAITING_IDENTITY';
    socket.buffer = '';
    socket.metData = '';
    socket.tempData = '';
    socket.pollTimer = null;

    const processAndPublish = () => {
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
            console.warn(`[Polling] [${socket.deviceId}] Parser falhou. Nenhuma leitura será publicada.`);
        }
    };

    const startPollingCycle = () => {
        if (!socket.writable) {
            socket.end();
            return;
        }
        console.log(`[Polling] [${socket.deviceId}] Iniciando ciclo de coleta.`);
        socket.state = 'AWAITING_MET';
        socket.buffer = '';
        socket.write("MET\r\n");
    };

    const scheduleNextPoll = () => {
        if (socket.pollTimer) clearTimeout(socket.pollTimer);
        socket.pollTimer = setTimeout(startPollingCycle, pollInterval);
    };

    socket.on('data', async (data) => {
        if (socket.state === 'AWAITING_IDENTITY') {
            const customId = extractDeviceIdFromBinary(data);
            if (!customId || customId.length < 1) {
                return;
            }
            try {
                const [rows] = await promisePool.query("SELECT id, local_tag FROM dispositivos_reles WHERE custom_id = ? AND ativo = 1", [customId]);
                if (rows.length > 0) {
                    socket.deviceId = rows[0].local_tag;
                    socket.rele_id_db = rows[0].id;
                    console.log(`[TCP Service] Dispositivo identificado como '${socket.deviceId}' (ID: ${socket.rele_id_db}). Iniciando login.`);
                    socket.state = 'LOGGING_IN';
                    socket.buffer = '';
                    setTimeout(() => socket.write("ACC\r\n"), 500);
                    setTimeout(() => socket.write("OTTER\r\n"), 1500);
                } else {
                    console.warn(`[TCP Service] Nenhum dispositivo ativo encontrado para o ID Customizado "${customId}".`);
                    socket.end();
                }
            } catch (err) {
                console.error("[TCP Service] Erro de DB ao identificar por ID Customizado:", err);
                socket.end();
            }
            return;
        }
        
        socket.buffer += data.toString('latin1');
        
        if (socket.buffer.includes('=>')) {
            const completeMessage = socket.buffer.substring(0, socket.buffer.indexOf('=>') + 2);
            socket.buffer = socket.buffer.substring(socket.buffer.indexOf('=>') + 2);
            
            switch (socket.state) {
                case 'LOGGING_IN':
                    console.log(`[TCP Service] Login para ${socket.deviceId} concluído.`);
                    startPollingCycle();
                    break;

                case 'AWAITING_MET':
                    socket.metData = completeMessage;
                    console.log(`[Polling] [${socket.deviceId}] Resposta MET recebida. Enviando THE.`);
                    socket.state = 'AWAITING_THE';
                    socket.buffer = '';
                    socket.write("THE\r\n");
                    break;

                case 'AWAITING_THE':
                    socket.tempData = completeMessage;
                    console.log(`[Polling] [${socket.deviceId}] Resposta THE recebida. Processando dados.`);
                    processAndPublish();
                    socket.state = 'IDLE';
                    scheduleNextPoll();
                    break;
            }
        }
    });

    socket.on("close", () => {
        if (socket.pollTimer) clearTimeout(socket.pollTimer);
        console.log(`[TCP Service] Conexão com ${socket.deviceId || remoteAddress} fechada.`);
    });

    socket.on("error", (err) => {
        console.error(`[TCP Service] Erro no socket de ${remoteAddress}:`, err.message);
    });
});

server.listen(port, () => {
    console.log(`[TCP Service] Servidor TCP ouvindo na porta ${port}`);
});
