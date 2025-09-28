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
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
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
    console.log(`[DEBUG PARSER] Resposta MET crua:\n`, metResponse);
    console.log(`[DEBUG PARSER] Resposta THE crua:\n`, tempResponse);

    try {
        const getValue = (regex, text) => {
            const match = text.match(regex);
            return match ? parseFloat(match[1]) : null;
        };

        data.tensao_rs = getValue(/VRS=(\d+\.\d+)/, metResponse);
        data.tensao_st = getValue(/VST=(\d+\.\d+)/, metResponse);
        data.tensao_tr = getValue(/VTR=(\d+\.\d+)/, metResponse);
        data.corrente_r = getValue(/AR=(\d+\.\d+)/, metResponse);
        data.corrente_s = getValue(/AS=(\d+\.\d+)/, metResponse);
        data.corrente_t = getValue(/AT=(\d+\.\d+)/, metResponse);
        data.frequencia = getValue(/HZ=(\d+\.\d+)/, metResponse);
        data.fator_potencia_r = getValue(/FPR=(\d+\.\d+)/, metResponse);
        data.fator_potencia_s = getValue(/FPS=(\d+\.\d+)/, metResponse);
        data.fator_potencia_t = getValue(/FPT=(\d+\.\d+)/, metResponse);
        data.potencia_ativa = getValue(/KWT=(\d+\.\d+)/, metResponse);
        data.potencia_aparente = getValue(/KVAT=(\d+\.\d+)/, metResponse);

        const tempMatch = tempResponse.match(/TE=(\d+\.\d+)/);
        if (tempMatch) {
            data.temperatura = parseFloat(tempMatch[1]);
        }

        console.log('[DEBUG PARSER] Dados extraídos:', data);

    } catch (error) {
        console.error('[ERROR PARSER] Erro ao processar os dados MET/THE:', error);
    }
    return data;
}

const server = net.createServer((socket) => {
    const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP Service] Nova conexão de ${remoteAddress}.`);

    socket.state = 'AWAITING_ID';
    socket.buffer = '';
    socket.deviceId = null;
    socket.releId = null;
    socket.pollTimer = null;
    socket.keepaliveTimer = null;

    const processAndPublish = async () => {
        const parsedData = parseData(socket.metData, socket.tempData);
        if (Object.keys(parsedData).length > 0) {
            const payload = {
                rele_id: socket.releId,
                device_id: socket.deviceId,
                timestamp: new Date().toISOString(),
                dados: parsedData
            };
            const topic = `sel/reles/${socket.deviceId}/status`;
            mqttClient.publish(topic, JSON.stringify(payload), (err) => {
                if (err) {
                    console.error(`[MQTT] [${socket.deviceId}] Erro ao publicar dados:`, err);
                } else {
                    console.log(`[MQTT] [${socket.deviceId}] Dados publicados com sucesso no tópico: ${topic}`);
                }
            });
        }
    };

    socket.on("data", async (data) => {
        socket.buffer += data.toString();

        let boundary = socket.buffer.indexOf('\r\n');
        if (boundary !== -1) {
            let completeMessage = socket.buffer.substring(0, boundary);
            socket.buffer = socket.buffer.substring(boundary + 2);

            switch (socket.state) {
                case 'AWAITING_ID':
                    const hexId = extractDeviceIdFromBinary(completeMessage);
                    let connection;
                    try {
                        connection = await promisePool.getConnection();
                        const [rows] = await connection.query(
                            "SELECT id, device_id FROM dispositivos_reles WHERE device_id_hex = ?", [hexId]
                        );
                        if (rows.length > 0) {
                            const device = rows[0];
                            socket.deviceId = device.device_id;
                            socket.releId = device.id;
                            socket.state = 'AWAITING_LOGIN';
                            console.log(`[TCP Service] Dispositivo identificado como '${socket.deviceId}' (ID: ${socket.releId}). Iniciando login.`);
                            socket.write("LOGIN\r\n");
                        } else {
                            console.log(`[TCP Service] Dispositivo com ID HEX '${hexId}' não encontrado. Fechando conexão.`);
                            socket.end();
                        }
                    } catch (err) {
                        console.error("[TCP Service] Erro ao consultar o banco de dados:", err);
                        socket.end();
                    } finally {
                        if (connection) connection.release();
                    }
                    break;
                case 'AWAITING_LOGIN':
                    if (completeMessage.trim() !== 'ACC') {
                        socket.end();
                        return;
                    }
                    
                    const startPollingCycle = () => {
                        if (socket.state !== 'IDLE') return;
                        console.log(`[Polling] [${socket.deviceId}] Iniciando ciclo de polling. Enviando MET.`);
                        socket.state = 'AWAITING_MET';
                        socket.write("MET\r\n");
                    };

                    const startKeepalive = () => {
                        socket.keepaliveTimer = setInterval(() => {
                            console.log(`[Keepalive] [${socket.deviceId}] Enviando pulso de keepalive.`);
                            socket.write("ALIVE\r\n");
                        }, keepaliveInterval);
                    };

                    console.log(`[TCP Service] [${socket.deviceId}] Login concluído com sucesso.`);
                    socket.state = 'IDLE';
                    startPollingCycle();
                    socket.pollTimer = setInterval(startPollingCycle, pollInterval);
                    startKeepalive();
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
                    processAndPublish();
                    socket.state = 'IDLE';
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
