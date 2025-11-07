const path = require('path');
require("dotenv").config({ path: path.resolve(__dirname, '../../.env') });

const net = require("net");
const mysql = require("mysql2/promise");
const mqtt = require("mqtt");

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const port = process.env.TCP_SERVER_PORT || 4000;
const pollInterval = 120000;
const keepaliveInterval = 120000;

const dbConfig = {
  host: '127.0.0.1',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const promisePool = mysql.createPool(dbConfig);
const mqttClient = mqtt.connect(MQTT_BROKER_URL);

const deviceCache = new Map();
const portToDeviceMap = new Map();
const legacyServers = [];

async function loadDeviceCaches() {
    try {
        console.log('[Cache] Carregando dispositivos do banco de dados...');
        const [rows] = await promisePool.query('SELECT id, nome_rele, custom_id, listen_port FROM dispositivos_reles WHERE ativo = 1');
        
        deviceCache.clear();
        portToDeviceMap.clear();

        for (const device of rows) {
            const deviceInfo = {
                rele_id_db: device.id,
                deviceId: device.nome_rele
            };

            if (device.custom_id) {
                deviceCache.set(device.custom_id.toLowerCase(), deviceInfo);
            }
            if (device.listen_port) {
                portToDeviceMap.set(device.listen_port, deviceInfo);
            }
        }
        console.log(`[Cache] ${deviceCache.size} dispositivos com custom_id (reg packet) carregados.`);
        console.log(`[Cache] ${portToDeviceMap.size} dispositivos com porta dedicada (legacy) carregados.`);
    } catch (error) {
        console.error('[Cache] Falha ao carregar dispositivos. O servidor pode não identificar os relés.', error);
    }
}

function extractDeviceIdFromBinary(data) {
    const buffer = Buffer.from(data);
    const hexId = buffer.toString('hex');
    console.log(`[BINARY DEBUG] Dados recebidos em hex: ${hexId}`);
    return hexId;
}

function parseData(metResponse, tempResponse) {
    const data = {};
    try {
        const getValue = (regex, text) => {
            const match = text.match(regex);
            return match ? parseFloat(match[1]) : null;
        };
        const getValues = (regex, text) => {
             const match = text.match(regex);
             return match ? match.slice(1).map(parseFloat) : [];
        };
        const currents = getValues(/Current Magnitude \(A\)\s+([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)/, metResponse);
        if (currents.length === 3) { data.corrente_r = currents[0]; data.corrente_s = currents[1]; data.corrente_t = currents[2]; }
        const voltagesPhaseBlock = metResponse.match(/VA\s+VB\s+VC\s+VG\s*\n\s*Voltage Magnitude \(V\)\s+([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)/);
        if (voltagesPhaseBlock) { data.tensao_rn = parseFloat(voltagesPhaseBlock[1]); data.tensao_sn = parseFloat(voltagesPhaseBlock[2]); data.tensao_tn = parseFloat(voltagesPhaseBlock[3]); }
        const voltagesLineBlock = metResponse.match(/VAB\s+VBC\s+VCA\s*\n\s*Voltage Magnitude \(V\)\s+([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)/);
        if (voltagesLineBlock) { data.tensao_rs = parseFloat(voltagesLineBlock[1]); data.tensao_st = parseFloat(voltagesLineBlock[2]); data.tensao_tr = parseFloat(voltagesLineBlock[3]); }
        data.frequencia = getValue(/Frequency \(Hz\)\s*=\s*([\d\.]+)/, metResponse);
        data.temperatura_dispositivo = getValue(/AMBT \(deg\. C\)\s*:\s*([\d\.]+)/, tempResponse);
        data.temperatura_ambiente = getValue(/AMBT \(deg\. C\)\s*:\s*([\d\.]+)/, tempResponse);
        data.temperatura_enrolamento = getValue(/TOILC \(deg\. C\)\s*:\s*([\d\.]+)/, tempResponse);
    } catch (error) { console.error("[Parser] Erro ao processar dados dos relés:", error); }
    return data;
}

async function processAndPublish(socket) {
    const parsedData = parseData(socket.metData, socket.tempData);
    if (Object.keys(parsedData).length > 0) {
        const topic = `sel/reles/${socket.deviceId}/status`;
        const payload = JSON.stringify({ rele_id: socket.rele_id_db, device_id: socket.deviceId, timestamp: new Date().toISOString(), dados: parsedData });
        mqttClient.publish(topic, payload, (err) => {
            if (err) { console.error(`[MQTT] [${socket.deviceId}] Erro ao publicar dados:`, err); }
            else { console.log(`[MQTT] [${socket.deviceId}] Dados publicados no tópico: ${topic}`); }
        });
        try {
            const conn = await promisePool.getConnection();
            const sqlQuery = `INSERT INTO leituras_reles (rele_id, timestamp_leitura, tensao_vab, tensao_vbc, tensao_vca, tensao_va, tensao_vb, tensao_vc, corrente_a, corrente_b, corrente_c, frequencia, temperatura_dispositivo, temperatura_ambiente, temperatura_enrolamento, payload_completo) VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
            const values = [socket.rele_id_db, parsedData.tensao_rs || null, parsedData.tensao_st || null, parsedData.tensao_tr || null, parsedData.tensao_rn || null, parsedData.tensao_sn || null, parsedData.tensao_tn || null, parsedData.corrente_r || null, parsedData.corrente_s || null, parsedData.corrente_t || null, parsedData.frequencia || null, parsedData.temperatura_dispositivo || null, parsedData.temperatura_ambiente || null, parsedData.temperatura_enrolamento || null, payload];
            await conn.query(sqlQuery, values);
            await conn.query('UPDATE dispositivos_reles SET ultima_leitura = NOW() WHERE id = ?', [socket.rele_id_db]);
            conn.release();
        } catch (dbError) { console.error(`[Database] [${socket.deviceId}] Erro ao salvar leitura no banco de dados:`, dbError); }
    } else { console.log(`[Parser] [${socket.deviceId}] Nenhum dado válido para processar.`); }
}

async function handleSocketData(socket) {
    if (socket.processing) { return; }
    socket.processing = true;
    try {
        while (true) {
            if (socket.state === 'AWAITING_IDENTITY') {
                if (socket.binaryBuffer.length === 0) break;
                const deviceIdHex = extractDeviceIdFromBinary(socket.binaryBuffer);
                socket.binaryBuffer = Buffer.alloc(0);
                const deviceInfo = deviceCache.get(deviceIdHex.toLowerCase());
                if (deviceInfo) {
                    socket.rele_id_db = deviceInfo.rele_id_db;
                    socket.deviceId = deviceInfo.deviceId;
                    console.log(`[TCP Service] Dispositivo identificado (via cache) como '${socket.deviceId}' (ID: ${socket.rele_id_db}). Iniciando login.`);
                    socket.state = 'AWAITING_PASSWORD_PROMPT';
                    socket.write("ACC\r\n");
                } else {
                    console.log(`[TCP Service] Dispositivo com ID HEX '${deviceIdHex}' não encontrado no cache.`);
                    socket.end();
                    return;
                }
                continue;
            }
            if (socket.state === 'AWAITING_PASSWORD_PROMPT') {
                if (socket.textBuffer.includes('Password:')) {
                    console.log(`[TCP Service] [${socket.deviceId}] Prompt de senha recebido. Enviando senha OTTER.`);
                    const passIndex = socket.textBuffer.indexOf('Password:');
                    socket.textBuffer = socket.textBuffer.substring(passIndex + 'Password:'.length);
                    socket.state = 'LOGGING_IN_OTTER';
                    socket.write("OTTER\r\n");
                } else if (socket.textBuffer.trim().length > 0) {
                    console.log(`[DEBUG] [${socket.deviceId}] Aguardando prompt de senha, mas recebi: ${socket.textBuffer}`);
                }
                 if (!socket.textBuffer.includes('=>')) { break; }
            }
            const promptIndex = socket.textBuffer.indexOf('=>');
            if (promptIndex === -1) break;
            const completeMessage = socket.textBuffer.substring(0, promptIndex + 2);
            socket.textBuffer = socket.textBuffer.substring(promptIndex + 2);
            switch (socket.state) {
                case 'LOGGING_IN_OTTER':
                    console.log(`[TCP Service] [${socket.deviceId}] Login concluído com sucesso.`);
                    socket.state = 'IDLE';
                    socket.startPollingCycle();
                    socket.pollTimer = setInterval(socket.startPollingCycle, pollInterval);
                    socket.startKeepalive();
                    break;
                case 'AWAITING_MET':
                    socket.metData = completeMessage;
                    console.log(`[Polling] [${socket.deviceId}] Resposta MET recebida. Enviando THE.`);
                    socket.state = 'AWAITING_THE';
                    socket.write("THE\r\n");
                    break;
                case 'AWAITING_THE':
                    socket.tempData = completeMessage;
                    console.log(`[Polling] [${socket.deviceId}] Resposta THE recebida. Processando dados.`);
                    await processAndPublish(socket);
                    socket.state = 'IDLE';
                    break;
            }
        }
    } catch (err) {
        console.error(`[Handler] Erro fatal no processamento do socket ${socket.deviceId || socket.remoteAddress}:`, err);
        socket.end();
    } finally {
        socket.processing = false;
    }
}

function setupSocketLogic(socket) {
    socket.binaryBuffer = Buffer.alloc(0);
    socket.textBuffer = '';
    socket.processing = false;

    socket.startPollingCycle = () => {
        if (socket.state === 'IDLE') {
            console.log(`[Polling] [${socket.deviceId}] Iniciando ciclo de coleta.`);
            socket.state = 'AWAITING_MET';
            socket.write("MET\r\n");
            if (socket.keepaliveTimer) {
                clearInterval(socket.keepaliveTimer);
                socket.keepaliveTimer = null;
            }
        }
    };

    socket.startKeepalive = () => {
        if (socket.keepaliveTimer) { clearInterval(socket.keepaliveTimer); }
        socket.keepaliveTimer = setInterval(() => {
            if (socket.state === 'IDLE') {
                console.log(`[Keepalive] [${socket.deviceId}] Enviando pacote de keepalive.`);
                socket.write(Buffer.from([0x00, 0x00, 0x00, 0x02, 0x01]));
            }
        }, keepaliveInterval);
    };

    socket.on('data', (data) => {
        if (socket.state === 'AWAITING_IDENTITY') {
            socket.binaryBuffer = Buffer.concat([socket.binaryBuffer, data]);
        } else {
            socket.textBuffer += data.toString('latin1');
        }
        handleSocketData(socket);
    });

    socket.on("close", () => {
        if (socket.pollTimer) clearInterval(socket.pollTimer);
        if (socket.keepaliveTimer) clearInterval(socket.keepaliveTimer);
        console.log(`[TCP Service] Conexão com ${socket.deviceId || socket.remoteAddress} fechada.`);
    });

    socket.on("error", (err) => {
        console.error(`[TCP Service] Erro no socket de ${socket.remoteAddress}:`, err.message);
    });
}

const mainServer = net.createServer((socket) => {
    const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP Service - Porta ${port}] Nova conexão de ${remoteAddress}. Aguardando pacote de registro.`);
    socket.state = 'AWAITING_IDENTITY';
    setupSocketLogic(socket);
});

function createLegacyServer(listenPort) {
    const legacyServer = net.createServer((socket) => {
        const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;
        const deviceInfo = portToDeviceMap.get(listenPort);

        if (!deviceInfo) {
            console.error(`[TCP Service - Porta ${listenPort}] Conexão recebida, mas nenhum dispositivo está mapeado para esta porta. Encerrando.`);
            socket.end();
            return;
        }

        console.log(`[TCP Service - Porta ${listenPort}] Nova conexão de ${remoteAddress}. Identificado como '${deviceInfo.deviceId}'.`);
        
        socket.rele_id_db = deviceInfo.rele_id_db;
        socket.deviceId = deviceInfo.deviceId;
        socket.state = 'AWAITING_PASSWORD_PROMPT';
        
        setupSocketLogic(socket);
        
        socket.write("ACC\r\n");
    });

    // CORREÇÃO APLICADA AQUI: Força o listener a usar IPv4
    legacyServer.listen(listenPort, '0.0.0.0', () => {
        const deviceInfo = portToDeviceMap.get(listenPort);
        console.log(`[TCP Service] Servidor dedicado para '${deviceInfo.deviceId}' ouvindo na porta ${listenPort}`);
    });

    legacyServer.on('error', (err) => {
        console.error(`[TCP Service - Porta ${listenPort}] Erro no servidor:`, err);
    });

    legacyServers.push(legacyServer);
}

async function startServer() {
    await loadDeviceCaches();

    mainServer.listen(port, () => {
        console.log(`[TCP Service] Servidor principal (reg packet) ouvindo na porta ${port}`);
    });

    for (const listenPort of portToDeviceMap.keys()) {
        createLegacyServer(listenPort);
    }
}

process.on('SIGINT', async () => {
    console.log('[Shutdown] Recebido sinal SIGINT. Encerrando conexões de forma organizada...');

    mainServer.close();
    legacyServers.forEach(server => server.close());

    mqttClient.end();

    await promisePool.end();

    console.log('[Shutdown] Todas as conexões foram encerradas. Saindo.');
    process.exit(0);
});

startServer();
