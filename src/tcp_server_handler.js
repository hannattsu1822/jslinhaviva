const net = require('net');
const { promisePool } = require('./init');

const clients = new Map();

function parseSelData(rawString) {
    const data = {};
    try {
        const pairs = rawString.split(',');
        pairs.forEach(pair => {
            const [key, value] = pair.split('=');
            if (key && value) {
                data[key.trim().toLowerCase()] = parseFloat(value);
            }
        });
        if (Object.keys(data).length === 0) return null;
        return data;
    } catch (error) {
        console.error('[TCP Server] Erro ao fazer parse dos dados:', error);
        return null;
    }
}

async function salvarLeituraSel(deviceId, parsedData, rawPayload, wss) {
    try {
        const timestampLeitura = new Date();
        const sql = `INSERT INTO leituras_sel2414 (device_id, timestamp_leitura, tensao_a, tensao_b, tensao_c, corrente_a, payload_bruto) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        await promisePool.query(sql, [deviceId, timestampLeitura, parsedData.va || null, parsedData.vb || null, parsedData.vc || null, parsedData.ia || null, rawPayload]);
        console.log(`[TCP Server] Leitura do dispositivo ${deviceId} salva no banco.`);

        if (wss) {
            const payloadWebSocket = { type: 'nova_leitura_sel', dados: { device_id: deviceId, ...parsedData, timestamp_leitura: timestampLeitura.toLocaleString('pt-BR') } };
            wss.clients.forEach(client => {
                if (client.readyState === client.OPEN) {
                    client.send(JSON.stringify(payloadWebSocket));
                }
            });
        }
    } catch (error) {
        console.error(`[TCP Server] Erro ao salvar leitura do dispositivo ${deviceId}:`, error);
    }
}

function iniciarServidorTCP(app) {
    const port = process.env.TCP_SERVER_PORT;
    const pollInterval = parseInt(process.env.TELNET_POLL_INTERVAL_SECONDS, 10) * 1000;
    const command = process.env.TELNET_COMMAND + '\n';
    const loginUser = 'ACC\n';
    const loginPass = 'OTTER\n';

    const server = net.createServer((socket) => {
        const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;
        console.log(`[TCP Server] Nova conexão recebida de ${remoteAddress}`);
        
        socket.isRegistered = false;
        socket.loginState = 'AWAITING_REGISTRATION';

        socket.on('data', (data) => {
            const rawDataText = data.toString().trim();
            const rawDataHex = data.toString('hex');
            console.log(`[TCP Server DEBUG] Dados recebidos de ${socket.deviceId || remoteAddress}: TEXTO="${rawDataText}" | HEX="${rawDataHex}"`);

            if (!socket.isRegistered) {
                if (rawDataText.startsWith('reg:')) {
                    const deviceId = rawDataText.substring(4);
                    socket.deviceId = deviceId;
                    socket.isRegistered = true;
                    clients.set(deviceId, socket);
                    console.log(`[TCP Server] Dispositivo ${deviceId} (${remoteAddress}) registrado com sucesso via Pacote de Registro. Iniciando login...`);
                    socket.loginState = 'AWAITING_ACC';
                    socket.write(loginUser);
                } else {
                    console.log(`[TCP Server] Dado ignorado (aguardando pacote de registro): "${rawDataText}"`);
                }
                return;
            }

            if (socket.loginState === 'AWAITING_ACC') {
                console.log(`[TCP Server] Resposta ao usuário recebida. Enviando senha...`);
                socket.loginState = 'AWAITING_OTTER';
                socket.write(loginPass);
                return;
            }

            if (socket.loginState === 'AWAITING_OTTER') {
                console.log(`[TCP Server] Login para ${socket.deviceId} concluído. Monitoramento iniciado.`);
                socket.loginState = 'LOGGED_IN';
                return;
            }

            if (socket.loginState === 'LOGGED_IN') {
                const parsedData = parseSelData(rawDataText);
                if (parsedData) {
                    const wss = app.get('wss');
                    salvarLeituraSel(socket.deviceId, parsedData, rawDataText, wss);
                }
            }
        });

        socket.on('close', () => {
            if (socket.deviceId) {
                clients.delete(socket.deviceId);
                console.log(`[TCP Server] Conexão com ${socket.deviceId} (${remoteAddress}) fechada.`);
            } else {
                console.log(`[TCP Server] Conexão com ${remoteAddress} (não registrado) fechada.`);
            }
        });

        socket.on('error', (err) => {
            console.error(`[TCP Server] Erro no socket de ${remoteAddress}:`, err.message);
        });
    });

    server.listen(port, () => {
        console.log(`[TCP Server] Servidor TCP ouvindo na porta ${port}`);
    });

    setInterval(() => {
        if (clients.size > 0) {
            for (const [deviceId, socket] of clients.entries()) {
                if (socket.loginState === 'LOGGED_IN' && socket.writable) {
                    socket.write(command);
                }
            }
        }
    }, pollInterval);
}

module.exports = { iniciarServidorTCP };
