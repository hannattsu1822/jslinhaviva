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

// ====================================================================
// PARSER ROBUSTO - VERSÃO FINAL
// ====================================================================
function parseData(metResponse, tempResponse) {
    const data = {};

    // 1. Limpa os caracteres inválidos e divide o texto em um array de linhas
    const cleanMet = metResponse.replace(/[^\x20-\x7E\r\n]/g, '');
    const cleanTemp = tempResponse.replace(/[^\x20-\x7E\r\n]/g, '');
    const metLines = cleanMet.split('\n');
    const tempLines = cleanTemp.split('\n');

    // 2. Função auxiliar para encontrar todos os números em uma string
    const findNumbers = (str) => {
        const matches = str.match(/-?\d[\d.,]*/g);
        return matches ? matches.map(s => parseFloat(s.replace(',', '.'))) : [];
    };

    try {
        // 3. Processa o relatório MET linha por linha
        for (let i = 0; i < metLines.length; i++) {
            const line = metLines[i];

            // Procura pela pista 'Current Magnitude (A)'
            if (line.includes('Current Magnitude (A)')) {
                const numbers = findNumbers(line);
                if (numbers.length >= 3) {
                    data.corrente_a = numbers[0];
                    data.corrente_b = numbers[1];
                    data.corrente_c = numbers[2];
                }
            }
            // Procura pela pista 'Voltage Magnitude (V)'
            else if (line.includes('Voltage Magnitude (V)')) {
                const prevLine = metLines[i - 1] || ''; // Pega a linha anterior para dar contexto
                const numbers = findNumbers(line);
                
                // Se a linha anterior tiver o contexto de FASE, salva como Tensão de Fase
                if (prevLine.includes('VA') && prevLine.includes('VB') && numbers.length >= 3) {
                    data.tensao_va = numbers[0];
                    data.tensao_vb = numbers[1];
                    data.tensao_vc = numbers[2];
                } 
                // Se a linha anterior tiver o contexto de LINHA, salva como Tensão de Linha
                else if (prevLine.includes('VAB') && prevLine.includes('VBC') && numbers.length >= 3) {
                    data.tensao_vab = numbers[0];
                    data.tensao_vbc = numbers[1];
                    data.tensao_vca = numbers[2];
                }
            }
            // Procura pela pista 'Frequency (Hz)'
            else if (line.includes('ncy (Hz)')) {
                const numbers = findNumbers(line);
                if (numbers.length > 0) {
                    data.frequencia = numbers[0];
                }
            }
        }
        
        // 4. Processa o relatório TEMP linha por linha
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
        
        // 5. Verifica se todos os dados obrigatórios foram encontrados
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
// ====================================================================
// FIM DO PARSER ROBUSTO
// ====================================================================

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
