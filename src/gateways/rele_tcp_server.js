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
const connectedClients = new Map(); // Rastreia clientes conectados pelo IP

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
        const currentMatch = cleanMet.match(/Current.*?\(A\).*?([\d.-]+).*?([\d.-]+).*?([\d.-]+)/s);
        if (currentMatch) {
            data.corrente_a = parseFloat(currentMatch[1]);
            data.corrente_b = parseFloat(currentMatch[2]);
            data.corrente_c = parseFloat(currentMatch[3]);
        }
        const voltageMatch = cleanMet.match(/Voltage.*?\(V\).*?([\d.-]+).*?([\d.-]+).*?([\d.-]+)/s);
        if (voltageMatch) {
            data.tensao_a = parseFloat(voltageMatch[1]);
            data.tensao_b = parseFloat(voltageMatch[2]);
            data.tensao_c = parseFloat(voltageMatch[3]);
        }
        const frequencyMatch = cleanMet.match(/Freque?ncy.*?\(Hz\)\s*=\s*([\d.-]+)/s);
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
        const requiredKeys = ['corrente_a', 'corrente_b', 'corrente_c', 'tensao_a', 'tensao_b', 'tensao_c', 'frequencia'];
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
    const remoteAddress = socket.remoteAddress.includes('::') ? socket.remoteAddress.split(':').pop() : socket.remoteAddress;
    const connectionId = `${remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP Service] Nova conexão de ${connectionId}.`);

    let deviceId = null;
    let rele_id_db = null;
    let buffer = '';
    let metData = '';
    let tempData = '';
    let pollTimer = null;

    const startPolling = () => {
        if (pollTimer) clearInterval(pollTimer);
        const poll = () => {
            if (!socket.writable) {
                console.warn(`[Polling] Socket para ${deviceId} não está gravável. Encerrando.`);
                socket.end();
                return;
            }
            console.log(`[Polling] [${deviceId}] Iniciando ciclo de coleta.`);
            buffer = '';
            metData = '';
            tempData = '';
            setTimeout(() => {
                console.log(`[Polling] [${deviceId}] Enviando MET.`);
                socket.write("MET\r\n");
            }, 500);
            setTimeout(() => {
                metData = buffer;
                buffer = '';
                console.log(`[Polling] [${deviceId}] Enviando THE.`);
                socket.write("THE\r\n");
            }, 2500);
            setTimeout(() => {
                tempData = buffer;
                buffer = '';
                const parsedData = parseData(metData, tempData);
                if (parsedData) {
                    const topic = `sel/reles/${rele_id_db}/status`;
                    const now = new Date();
                    const timestampMySQL = now.toISOString().slice(0, 19).replace('T', ' ');
                    const payload = JSON.stringify({
                        rele_id: rele_id_db,
                        local_tag: deviceId,
                        ...parsedData,
                        timestamp_leitura: timestampMySQL,
                        payload_completo: `MET:\n${metData}\nTEMP:\n${tempData}`
                    });
                    mqttClient.publish(topic, payload);
                    console.log(`[Polling] [${deviceId}] Dados VÁLIDOS publicados.`);
                } else {
                    console.warn(`[Polling] [${deviceId}] Parser falhou.`);
                }
            }, 4500);
        };
        poll();
        pollTimer = setInterval(poll, pollInterval);
    };

    socket.on('data', (data) => {
        buffer += data.toString('latin1');
    });

    socket.on("close", () => {
        if (pollTimer) clearInterval(pollTimer);
        if (deviceId) connectedClients.delete(deviceId); // Libera o dispositivo para reconectar
        console.log(`[TCP Service] Conexão com ${deviceId || connectionId} fechada.`);
    });

    socket.on("error", (err) => {
        console.error(`[TCP Service] Erro no socket de ${connectionId}:`, err.message);
    });

    (async () => {
        try {
            if (connectedClients.has(remoteAddress)) {
                console.warn(`[TCP Service] Conexão duplicada do IP ${remoteAddress} rejeitada.`);
                socket.end();
                return;
            }

            const [rows] = await promisePool.query("SELECT id, local_tag FROM dispositivos_reles WHERE ip_address = ? AND ativo = 1", [remoteAddress]);
            if (rows.length > 0) {
                deviceId = rows[0].local_tag;
                rele_id_db = rows[0].id;
                
                if (connectedClients.has(deviceId)) {
                    console.warn(`[TCP Service] Dispositivo '${deviceId}' já está conectado. Rejeitando nova conexão.`);
                    socket.end();
                    return;
                }
                
                connectedClients.set(deviceId, socket);
                console.log(`[TCP Service] Dispositivo identificado como '${deviceId}' (ID: ${rele_id_db}). Iniciando login.`);
                
                setTimeout(() => socket.write("ACC\r\n"), 500);
                setTimeout(() => socket.write("OTTER\r\n"), 1500);
                setTimeout(() => {
                    console.log(`[TCP Service] Login para ${deviceId} concluído. Iniciando polling.`);
                    buffer = '';
                    startPolling();
                }, 2500);

            } else {
                console.warn(`[TCP Service] Nenhum dispositivo ativo encontrado para o IP "${remoteAddress}".`);
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
