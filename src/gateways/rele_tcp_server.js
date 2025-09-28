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
    console.log(`[DEBUG PARSER] Resposta MET crua:\n`, metResponse);
    console.log(`[DEBUG PARSER] Resposta THE crua:\n`, tempResponse);

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
        if (currents.length === 3) {
            data.corrente_r = currents[0];
            data.corrente_s = currents[1];
            data.corrente_t = currents[2];
        }

        const voltagesPhaseBlock = metResponse.match(/VA\s+VB\s+VC\s+VG\s*\n\s*Voltage Magnitude \(V\)\s+([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)/);
        if (voltagesPhaseBlock) {
            data.tensao_rn = parseFloat(voltagesPhaseBlock[1]);
            data.tensao_sn = parseFloat(voltagesPhaseBlock[2]);
            data.tensao_tn = parseFloat(voltagesPhaseBlock[3]);
        }
        
        const voltagesLineBlock = metResponse.match(/VAB\s+VBC\s+VCA\s*\n\s*Voltage Magnitude \(V\)\s+([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)/);
        if (voltagesLineBlock) {
            data.tensao_rs = parseFloat(voltagesLineBlock[1]);
            data.tensao_st = parseFloat(voltagesLineBlock[2]);
            data.tensao_tr = parseFloat(voltagesLineBlock[3]);
        }

        data.frequencia = getValue(/Frequency \(Hz\)\s*=\s*([\d\.]+)/, metResponse);
        
        data.temperatura_dispositivo = getValue(/AMBT \(deg\. C\)\s*:\s*([\d\.]+)/, tempResponse);
        data.temperatura_ambiente = getValue(/AMBT \(deg\. C\)\s*:\s*([\d\.]+)/, tempResponse);
        data.temperatura_enrolamento = getValue(/TOILC \(deg\. C\)\s*:\s*([\d\.]+)/, tempResponse);

    } catch (error) {
        console.error("[Parser] Erro ao processar dados dos relés:", error);
    }

    return data;
}

async function processAndPublish(socket) {
    const parsedData = parseData(socket.metData, socket.tempData);
    console.log(`[DADOS FINAIS] [${socket.deviceId}] Dados processados: `, JSON.stringify(parsedData, null, 2));

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
            const sqlQuery = `
                INSERT INTO leituras_reles (
                    rele_id, timestamp_leitura, 
                    tensao_vab, tensao_vbc, tensao_vca,
                    tensao_va, tensao_vb, tensao_vc,
                    corrente_a, corrente_b, corrente_c,
                    frequencia, temperatura_dispositivo, temperatura_ambiente, temperatura_enrolamento, payload_completo
                ) VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `;
            const values = [
                socket.rele_id_db,
                parsedData.tensao_rs || null,
                parsedData.tensao_st || null,
                parsedData.tensao_tr || null,
                parsedData.tensao_rn || null,
                parsedData.tensao_sn || null,
                parsedData.tensao_tn || null,
                parsedData.corrente_r || null,
                parsedData.corrente_s || null,
                parsedData.corrente_t || null,
                parsedData.frequencia || null,
                parsedData.temperatura_dispositivo || null,
                parsedData.temperatura_ambiente || null,
                parsedData.temperatura_enrolamento || null,
                payload
            ];
            
            await conn.query(sqlQuery, values);
            
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
}

async function handleSocketLogic(socket) {
    if (socket.processing) return;
    socket.processing = true;

    try {
        if (socket.state === 'AWAITING_IDENTITY' && socket.binaryBuffer.length > 0) {
            const data = socket.binaryBuffer;
            socket.binaryBuffer = Buffer.alloc(0);

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
                    
                    socket.state = 'LOGGING_IN_ACC';
                    socket.write("ACC\r\n");
                } else {
                    console.log(`[TCP Service] Dispositivo com ID HEX '${deviceIdHex}' não encontrado no banco de dados.`);
                    socket.end();
                }
            } catch (error) {
                console.error("[Database] Erro ao consultar o banco de dados:", error);
                if (conn) conn.release();
                socket.end();
            }
        }

        while (socket.textBuffer.includes('=>')) {
            const completeMessage = socket.textBuffer.substring(0, socket.textBuffer.indexOf('=>') + 2);
            socket.textBuffer = socket.textBuffer.substring(socket.textBuffer.indexOf('=>') + 2);
            
            switch (socket.state) {
                case 'LOGGING_IN_ACC':
                    console.log(`[TCP Service] [${socket.deviceId}] Resposta do ACC recebida. Enviando OTTER.`);
                    socket.state = 'LOGGING_IN_OTTER';
                    socket.write("OTTER\r\n");
                    break;
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
    } finally {
        socket.processing = false;
    }
}

const server = net.createServer((socket) => {
    const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP Service] Nova conexão de ${remoteAddress}.`);

    socket.state = 'AWAITING_IDENTITY';
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
        if (socket.keepaliveTimer) {
            clearInterval(socket.keepaliveTimer);
        }
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
        handleSocketLogic(socket);
    });

    socket.on("close", () => {
        if (socket.pollTimer) clearInterval(socket.pollTimer);
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
