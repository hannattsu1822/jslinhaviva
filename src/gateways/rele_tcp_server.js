const path = require('path');
require("dotenv").config({ path: path.resolve(__dirname, '../../.env') });

const net = require("net");
const mysql = require("mysql2/promise");
const mqtt = require("mqtt");

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const port = process.env.TCP_SERVER_PORT || 4000;

// --- CONFIGURAÇÕES ---
const pollInterval = 300000; // 5 Minutos
const keepaliveInterval = 120000;
const INITIAL_CONNECTION_DELAY = 3000; 
const STARTUP_DELAY_5001 = 10000; // 10s de delay inicial para o 5001
const POST_LOGIN_DELAY = 4000;         
const SHUTDOWN_DELAY = 1000;

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
const activeSockets = new Set();

async function loadDeviceCaches() {
    try {
        console.log('[Cache] Carregando dispositivos...');
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
        console.log(`[Cache] ${deviceCache.size} Smart (ID) | ${portToDeviceMap.size} Legacy (Porta).`);
    } catch (error) {
        console.error('[Cache] Erro:', error);
    }
}

function extractDeviceIdFromBinary(data) {
    const buffer = Buffer.from(data);
    return buffer.toString('hex');
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
    } catch (error) { 
        // Silencioso, erro de parse não é critico no log limpo
    }
    return data;
}

async function processAndPublish(socket) {
    const parsedData = parseData(socket.metData, socket.tempData);
    
    if (Object.keys(parsedData).length > 0) {
        const topic = `sel/reles/${socket.deviceId}/status`;
        const payload = JSON.stringify({ rele_id: socket.rele_id_db, device_id: socket.deviceId, timestamp: new Date().toISOString(), dados: parsedData });
        
        mqttClient.publish(topic, payload, (err) => {
            if (err) console.error(`[MQTT] Erro pub ${socket.deviceId}:`, err);
        });

        try {
            const conn = await promisePool.getConnection();
            const sqlQuery = `INSERT INTO leituras_reles (rele_id, timestamp_leitura, tensao_vab, tensao_vbc, tensao_vca, tensao_va, tensao_vb, tensao_vc, corrente_a, corrente_b, corrente_c, frequencia, temperatura_dispositivo, temperatura_ambiente, temperatura_enrolamento, payload_completo) VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
            const values = [socket.rele_id_db, parsedData.tensao_rs || null, parsedData.tensao_st || null, parsedData.tensao_tr || null, parsedData.tensao_rn || null, parsedData.tensao_sn || null, parsedData.tensao_tn || null, parsedData.corrente_r || null, parsedData.corrente_s || null, parsedData.corrente_t || null, parsedData.frequencia || null, parsedData.temperatura_dispositivo || null, parsedData.temperatura_ambiente || null, parsedData.temperatura_enrolamento || null, payload];
            await conn.query(sqlQuery, values);
            await conn.query('UPDATE dispositivos_reles SET ultima_leitura = NOW() WHERE id = ?', [socket.rele_id_db]);
            conn.release();
        } catch (dbError) { console.error(`[DB] Erro ${socket.deviceId}:`, dbError.message); }
    }
}

async function handleSocketData(socket) {
    if (socket.processing) { return; }
    socket.processing = true;
    try {
        while (true) {
            // 1. Identificação (apenas Main Server)
            if (socket.state === 'AWAITING_IDENTITY') {
                if (socket.binaryBuffer.length === 0) break;
                const deviceIdHex = extractDeviceIdFromBinary(socket.binaryBuffer);
                socket.binaryBuffer = Buffer.alloc(0);
                const deviceInfo = deviceCache.get(deviceIdHex.toLowerCase());
                if (deviceInfo) {
                    socket.rele_id_db = deviceInfo.rele_id_db;
                    socket.deviceId = deviceInfo.deviceId;
                    
                    setTimeout(() => {
                        socket.state = 'AWAITING_PASSWORD_PROMPT';
                        socket.write("\r\n"); 
                        setTimeout(() => socket.write("ACC\r\n"), 500);
                    }, INITIAL_CONNECTION_DELAY);

                } else {
                    socket.end();
                    return;
                }
                break;
            }

            // 2. Login (Apenas para dispositivos normais, o 5001 pula isso)
            if (socket.state === 'AWAITING_PASSWORD_PROMPT') {
                const passIndex = socket.textBuffer.indexOf('Password:');
                const promptIndexCheck = socket.textBuffer.indexOf('=>');

                if (passIndex !== -1) {
                    socket.textBuffer = socket.textBuffer.substring(passIndex + 9);
                    socket.state = 'LOGGING_IN_OTTER';
                    socket.write("OTTER\r\n");
                } else if (promptIndexCheck !== -1) {
                    socket.state = 'LOGGING_IN_OTTER';
                } else {
                    break; 
                }
            }

            // 3. Processamento de Comandos
            const promptIndex = socket.textBuffer.indexOf('=>');
            if (promptIndex === -1) break;
            
            const completeMessage = socket.textBuffer.substring(0, promptIndex + 2);
            socket.textBuffer = socket.textBuffer.substring(promptIndex + 2);
            
            let loginSuccessful = false;
            switch (socket.state) {
                case 'LOGGING_IN_OTTER':
                    loginSuccessful = true;
                    break;
                case 'AWAITING_MET':
                    // Ignora erros de comando, tenta seguir
                    if (!completeMessage.includes("unknown") && !completeMessage.includes("Enter at least")) {
                        socket.metData = completeMessage;
                        socket.state = 'AWAITING_THE';
                        socket.write("THE\r\n");
                    } else {
                        socket.state = 'IDLE'; // Reseta se der erro
                    }
                    break;
                case 'AWAITING_THE':
                    socket.tempData = completeMessage;
                    await processAndPublish(socket);
                    socket.state = 'IDLE';
                    break;
            }

            if (loginSuccessful) {
                socket.state = 'IDLE';
                socket.write("\r\n"); // Limpeza
                setTimeout(() => {
                    socket.startPollingCycle();
                    if (socket.pollTimer) clearInterval(socket.pollTimer);
                    socket.pollTimer = setInterval(socket.startPollingCycle, pollInterval);
                    socket.startKeepalive();
                }, POST_LOGIN_DELAY);
            }
        }
    } catch (err) {
        console.error(`[Handler] Erro ${socket.deviceId}:`, err.message);
        socket.end();
    } finally {
        socket.processing = false;
    }
}

function setupSocketLogic(socket) {
    activeSockets.add(socket);
    socket.binaryBuffer = Buffer.alloc(0);
    socket.textBuffer = '';
    socket.processing = false;

    socket.startPollingCycle = () => {
        if (socket.state === 'IDLE') {
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
                socket.write(Buffer.from([0x00])); 
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
        activeSockets.delete(socket);
        if (socket.pollTimer) clearInterval(socket.pollTimer);
        if (socket.keepaliveTimer) clearInterval(socket.keepaliveTimer);
    });

    socket.on("error", (err) => {
        console.error(`[Socket] Erro:`, err.message);
    });
}

const mainServer = net.createServer((socket) => {
    socket.state = 'AWAITING_IDENTITY';
    setupSocketLogic(socket);
});

function createLegacyServer(listenPort) {
    const legacyServer = net.createServer((socket) => {
        const deviceInfo = portToDeviceMap.get(listenPort);

        if (!deviceInfo) {
            socket.end();
            return;
        }
        
        socket.rele_id_db = deviceInfo.rele_id_db;
        socket.deviceId = deviceInfo.deviceId;
        
        setupSocketLogic(socket);
        
        // --- LÓGICA ESPECIAL PARA PORTA 5001 ---
        if (listenPort === 5001) {
            // Modo Direto: Sem login, sem ACC, apenas MET após delay
            setTimeout(() => {
                socket.state = 'IDLE';
                socket.startPollingCycle(); // Manda MET direto
                
                if (socket.pollTimer) clearInterval(socket.pollTimer);
                socket.pollTimer = setInterval(socket.startPollingCycle, pollInterval);
                socket.startKeepalive();
            }, STARTUP_DELAY_5001); // 10 segundos
        } else {
            // Modo Padrão: Com Login
            setTimeout(() => {
                socket.state = 'AWAITING_PASSWORD_PROMPT';
                socket.write("\r\n");
                setTimeout(() => socket.write("ACC\r\n"), 500);
            }, INITIAL_CONNECTION_DELAY);
        }
    });

    legacyServer.listen(listenPort, '0.0.0.0', () => {
        console.log(`[TCP] Porta ${listenPort} aberta para ${portToDeviceMap.get(listenPort).deviceId}`);
    });

    legacyServers.push(legacyServer);
}

async function startServer() {
    await loadDeviceCaches();

    mainServer.listen(port, '0.0.0.0', () => {
        console.log(`[TCP] Main Server na porta ${port}`);
    });

    for (const listenPort of portToDeviceMap.keys()) {
        createLegacyServer(listenPort);
    }
}

process.on('SIGINT', async () => {
    console.log('[Shutdown] Encerrando...');
    for (const socket of activeSockets) {
        if (socket.writable) {
            socket.write("QUIT\r\n");
        }
    }
    setTimeout(async () => {
        for (const socket of activeSockets) { socket.destroy(); }
        mainServer.close();
        legacyServers.forEach(s => s.close());
        mqttClient.end();
        await promisePool.end();
        process.exit(0);
    }, SHUTDOWN_DELAY);
});

startServer();
