const path = require('path');
require("dotenv").config({ path: path.resolve(__dirname, '../../.env') });

const net = require("net");
const mysql = require("mysql2/promise");
const mqtt = require("mqtt");

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const TCP_SERVER_PORT = process.env.TCP_SERVER_PORT || 4000;
const POLL_INTERVAL_MS = 60000;
const CONNECTION_TIMEOUT_MS = 120000;

const dbConfig = {
  host: '127.0.0.1',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 5,
};

let promisePool;
try {
  promisePool = mysql.createPool(dbConfig);
} catch (err) {
  console.error("[DB] Falha ao criar o pool de conexões com o banco de dados:", err);
  process.exit(1);
}

const mqttClient = mqtt.connect(MQTT_BROKER_URL);

mqttClient.on('connect', () => {
  console.log(`[MQTT] Conectado ao broker em ${MQTT_BROKER_URL}`);
});

mqttClient.on('error', (err) => {
  console.error("[MQTT] Erro de conexão com o broker:", err);
});

function extractDeviceIdFromBinary(data) {
    const buffer = Buffer.from(data);
    return buffer.toString('hex');
}

function parseData(metResponse, tempResponse) {
    const data = {};
    const cleanMet = metResponse.replace(/[^\x20-\x7E\r\n]/g, '');
    const cleanTemp = tempResponse.replace(/[^\x20-\x7E\r\n]/g, '');

    try {
        const findNumbers = (str) => {
            if (!str) return [];
            const matches = str.match(/-?\d[\d.,]*/g);
            return matches ? matches.map(s => parseFloat(s.replace(',', '.'))) : [];
        };

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
                console.warn(`[Parser] Falha ao extrair o valor obrigatório de '${key}'. Leitura descartada.`);
                return null;
            }
        }

        if (data.tensao_vab !== undefined) {
            const avgPhaseVoltage = (data.tensao_va + data.tensao_vb + data.tensao_vc) / 3;
            const expectedLineVoltage = avgPhaseVoltage * Math.sqrt(3);
            const tolerance = 0.20;
            const lowerBound = expectedLineVoltage * (1 - tolerance);
            const upperBound = expectedLineVoltage * (1 + tolerance);
            
            if (data.tensao_vab < lowerBound || data.tensao_vab > upperBound ||
                data.tensao_vbc < lowerBound || data.tensao_vbc > upperBound ||
                data.tensao_vca < lowerBound || data.tensao_vca > upperBound) {
                console.warn(`[Parser] Verificação de sanidade falhou. Tensão de linha inconsistente com a tensão de fase. Leitura descartada.`);
                return null;
            }
        }
        
        return data;
    } catch (error) {
        console.error("[Parser] Erro crítico ao fazer parse dos dados:", error);
        return null;
    }
}

const server = net.createServer((socket) => {
    const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP Server] Nova conexão de ${remoteAddress}.`);

    socket.state = 'AWAITING_IDENTITY';
    socket.buffer = '';
    socket.metData = '';
    socket.tempData = '';
    socket.pollTimer = null;
    socket.setTimeout(CONNECTION_TIMEOUT_MS);

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
            console.log(`[Socket ${socket.deviceId}] Dados válidos publicados via MQTT.`);
        } else {
            console.warn(`[Socket ${socket.deviceId}] Parser falhou ou dados inválidos. Nenhuma leitura foi publicada.`);
        }
    };

    const startPollingCycle = () => {
        if (!socket.writable) {
            socket.end();
            return;
        }
        console.log(`[Socket ${socket.deviceId}] Iniciando ciclo de coleta de dados.`);
        socket.state = 'AWAITING_MET';
        socket.buffer = '';
        socket.write("MET\r\n");
    };

    const scheduleNextPoll = () => {
        if (socket.pollTimer) clearTimeout(socket.pollTimer);
        socket.pollTimer = setTimeout(startPollingCycle, POLL_INTERVAL_MS);
    };

    socket.on('data', async (data) => {
        socket.buffer += data.toString('latin1');

        if (socket.state === 'AWAITING_IDENTITY') {
            const customId = extractDeviceIdFromBinary(socket.buffer);
            socket.buffer = '';
            if (!customId || customId.length < 1 || customId === '0000000201') {
                if (customId === '0000000201') console.log(`[Socket ${remoteAddress}] Pacote de heartbeat ignorado.`);
                return;
            }
            try {
                const [rows] = await promisePool.query("SELECT id, local_tag FROM dispositivos_reles WHERE custom_id = ? AND ativo = 1", [customId]);
                if (rows.length > 0) {
                    socket.deviceId = rows[0].local_tag;
                    socket.rele_id_db = rows[0].id;
                    console.log(`[Socket ${remoteAddress}] Dispositivo identificado como '${socket.deviceId}' (ID: ${socket.rele_id_db}). Iniciando login.`);
                    socket.state = 'LOGGING_IN_ACC';
                    socket.write("ACC\r\n");
                } else {
                    console.warn(`[Socket ${remoteAddress}] Nenhum dispositivo ativo encontrado para o ID Customizado "${customId}". Encerrando conexão.`);
                    socket.end();
                }
            } catch (err) {
                console.error(`[Socket ${remoteAddress}] Erro de DB ao identificar dispositivo:`, err);
                socket.end();
            }
            return;
        }
        
        while (socket.buffer.includes('=>')) {
            const completeMessage = socket.buffer.substring(0, socket.buffer.indexOf('=>') + 2);
            socket.buffer = socket.buffer.substring(socket.buffer.indexOf('=>') + 2);
            
            switch (socket.state) {
                case 'LOGGING_IN_ACC':
                    console.log(`[Socket ${socket.deviceId}] Login (ACC) bem-sucedido. Enviando OTTER.`);
                    socket.state = 'LOGGING_IN_OTTER';
                    socket.write("OTTER\r\n");
                    break;

                case 'LOGGING_IN_OTTER':
                    console.log(`[Socket ${socket.deviceId}] Login (OTTER) bem-sucedido. Autenticação completa.`);
                    startPollingCycle();
                    break;

                case 'AWAITING_MET':
                    socket.metData = completeMessage;
                    console.log(`[Socket ${socket.deviceId}] Resposta MET recebida. Solicitando THE.`);
                    socket.state = 'AWAITING_THE';
                    socket.write("THE\r\n");
                    break;

                case 'AWAITING_THE':
                    socket.tempData = completeMessage;
                    console.log(`[Socket ${socket.deviceId}] Resposta THE recebida. Processando dados.`);
                    processAndPublish();
                    socket.state = 'IDLE';
                    scheduleNextPoll();
                    break;
            }
        }
    });

    socket.on("close", () => {
        if (socket.pollTimer) clearTimeout(socket.pollTimer);
        console.log(`[TCP Server] Conexão com ${socket.deviceId || remoteAddress} fechada.`);
    });

    socket.on("error", (err) => {
        console.error(`[TCP Server] Erro no socket de ${socket.deviceId || remoteAddress}:`, err.message);
    });

    socket.on('timeout', () => {
        console.warn(`[TCP Server] Conexão com ${socket.deviceId || remoteAddress} atingiu o timeout. Encerrando.`);
        socket.end();
    });
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[TCP Server] Erro fatal: A porta ${TCP_SERVER_PORT} já está em uso.`);
    } else {
        console.error('[TCP Server] Ocorreu um erro no servidor:', err);
    }
    process.exit(1);
});

server.listen(TCP_SERVER_PORT, () => {
    console.log(`[TCP Server] Servidor TCP ouvindo na porta ${TCP_SERVER_PORT}`);
});
