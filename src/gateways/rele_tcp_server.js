const path = require('path');
require("dotenv").config({ path: path.resolve(__dirname, '../../.env') });

const net = require("net");
const mysql = require("mysql2/promise");
const mqtt = require("mqtt");

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const port = process.env.TCP_SERVER_PORT || 4000;
const pollInterval = 300000;
const keepaliveInterval = 120000;

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

    try {
        const findNumbers = (str) => {
            if (!str) return [];
            const matches = str.match(/-?\d+\.\d+|-?\d+/g);
            return matches ? matches.map(Number) : [];
        };

        const metNumbers = findNumbers(cleanMet);
        const tempNumbers = findNumbers(cleanTemp);

        if (metNumbers.length >= 12) {
            data.tensao_rs = metNumbers[0];
            data.tensao_st = metNumbers[1];
            data.tensao_tr = metNumbers[2];
            data.tensao_rn = metNumbers[3];
            data.tensao_sn = metNumbers[4];
            data.tensao_tn = metNumbers[5];
            data.corrente_r = metNumbers[6];
            data.corrente_s = metNumbers[7];
            data.corrente_t = metNumbers[8];
            data.frequencia = metNumbers[11];
        }

        if (tempNumbers.length >= 1) {
            data.temperatura = tempNumbers[0];
        }

    } catch (error) {
        console.error("[Parser] Erro ao processar dados dos relés:", error);
    }

    return data;
}


const server = net.createServer((socket) => {
    const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP Service] Nova conexão de ${remoteAddress}.`);

    socket.state = 'AWAITING_IDENTITY';
    socket.buffer = '';
    socket.setEncoding('latin1');

    const startPollingCycle = () => {
        if (socket.state === 'IDLE' || socket.state === 'LOGGING_IN_OTTER') {
            console.log(`[Polling] [${socket.deviceId}] Iniciando ciclo de coleta.`);
            socket.state = 'AWAITING_MET';
            socket.write("MET\r\n");
            if (socket.keepaliveTimer) {
                clearInterval(socket.keepaliveTimer);
                socket.keepaliveTimer = null;
            }
        }
    };

    const processAndPublish = async () => {
        const parsedData = parseData(socket.metData, socket.tempData);

        if (Object.keys(parsedData).length > 0) {
            const topic = `sel/reles/${socket.deviceId}/status`;
            const payload = JSON.stringify({
                rele_id: socket.rele_id_db,
                device_id: socket.deviceId,
                timestamp: new Date().toISOString(),
                dados: parsedData,
            });

            mqttClient.publish(topic, payload, (err) => {
                if (err) {
                    console.error(`[MQTT] [${socket.deviceId}] Erro ao publicar dados:`, err);
                } else {
                    console.log(`[MQTT] [${socket.deviceId}] Dados publicados no tópico: ${topic}`);
                }
            });
            try {
                const conn = await promisePool.getConnection();
                await conn.query(
                    'INSERT INTO leituras_reles (rele_id, dados_json) VALUES (?, ?)',
                    [socket.rele_id_db, payload]
                );
                await conn.query(
                    'UPDATE dispositivos_reles SET ultima_leitura = NOW() WHERE id = ?',
                    [socket.rele_id_db]
                );
                conn.release();
            } catch (dbError) {
                console.error(`[Database] [${socket.deviceId}] Erro ao salvar leitura no banco de dados:`, dbError);
            }
        } else {
            console.log(`[Parser] [${socket.deviceId}] Nenhum dado válido para processar.`);
        }
    };
    
    const startKeepalive = () => {
        if (socket.keepaliveTimer) {
            clearInterval(socket.keepaliveTimer);
        }
        socket.keepaliveTimer = setInterval(() => {
            console.log(`[Keepalive] [${socket.deviceId}] Enviando pacote de keepalive.`);
            socket.write(Buffer.from([0x00, 0x00, 0x00, 0x02, 0x01]));
        }, keepaliveInterval);
    };

    socket.on('data', async (data) => {
        const hexData = Buffer.from(data, 'latin1').toString('hex');
        if (hexData === '0000000201') {
            console.log(`[TCP Service] Pacote de heartbeat ignorado.`);
            return;
        }

        if (socket.state === 'AWAITING_IDENTITY') {
            const deviceIdHex = extractDeviceIdFromBinary(data);
            let conn;
            try {
                conn = await promisePool.getConnection();
                const [rows] = await conn.query('SELECT id, nome_rele AS device_id FROM dispositivos_reles WHERE custom_id = ?', [deviceIdHex]);
                conn.release();

                if (rows.length > 0) {
                    socket.rele_id_db = rows[0].id;
                    socket.deviceId = rows[0].device_id;
                    console.log(`[TCP Service] Dispositivo identificado como '${socket.deviceId}' (ID: ${socket.rele_id_db}). Iniciando login.`);
                    
                    socket.state = 'LOGGING_IN_OTTER';
                    socket.write("ACC\r\n");
                    
                    console.log(`[TCP Service] Login para ${socket.deviceId} parte 1/2 enviada (ACC). Enviando parte 2/2 (OTTER).`);
                    socket.write("OTTER\r\n");
                    
                    console.log(`[TCP Service] Login para ${socket.deviceId} concluído.`);
                    startPollingCycle();
                    socket.pollTimer = setInterval(startPollingCycle, pollInterval);
                    startKeepalive();
                } else {
                    console.log(`[TCP Service] Dispositivo com ID HEX '${deviceIdHex}' não encontrado no banco de dados.`);
                    socket.end();
                }
            } catch (error) {
                console.error("[Database] Erro ao consultar o banco de dados:", error);
                if (conn) conn.release();
                socket.end();
            }
            return;
        }
        
        socket.buffer += data.toString('latin1');
        
        if (socket.buffer.includes('=>')) {
            const completeMessage = socket.buffer.substring(0, socket.buffer.indexOf('=>') + 2);
            socket.buffer = socket.buffer.substring(socket.buffer.indexOf('=>') + 2);
            
            switch (socket.state) {
                case 'AWAITING_MET':
                    socket.metData = completeMessage;
                    console.log(`[Polling] [${socket.deviceId}] Resposta MET recebida. Enviando THE.`);
                    socket.state = 'AWAITING_THE';
                    socket.write("THE\r\n");
                    break;
                case 'AWAITING_THE':
                    socket.tempData = completeMessage;
                    console.log(`[Polling] [${socket.deviceId}] Resposta THE recebida. Processando dados.`);
                    processAndPublish();
                    socket.state = 'IDLE';
                    startKeepalive();
                    break;
            }
        }
    });

    socket.on("close", () => {
        if (socket.pollTimer) clearTimeout(socket.pollTimer);
        if (socket.keepaliveTimer) clearInterval(socket.keepaliveTimer);
        console.log(`[TCP Service] Conexão com ${socket.deviceId || remoteAddress} fechada.`);
    });

    socket.on("error", (err) => {
        console.error(`[TCP Service] Erro no socket de ${remoteAddress}:`, err.message);
    });
});

server.listen(port, () => {
    console.log(`[TCP Service] Servidor TCP ouvindo na porta ${port}`);
});
