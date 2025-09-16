const net = require("net");
const { promisePool } = require("./init");

const releClients = new Map();

function parseSelData(rawString) {
  const data = {};
  try {
    // Limpeza agressiva para remover ecos e caracteres de controle
    let cleanedString = rawString.replace(/[\x00-\x1F\x7F-\x9F]+/g, " ").replace(/ACC|OTTER|MET|=>/g, "").trim();
    
    const currentMatch = cleanedString.match(/Current Magnitude \(A\)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)/);
    if (currentMatch) {
      data.corrente_a = parseFloat(currentMatch[1]);
      data.corrente_b = parseFloat(currentMatch[2]);
      data.corrente_c = parseFloat(currentMatch[3]);
    }

    const voltageMatch = cleanedString.match(/Voltage Magnitude \(V\)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)/);
    if (voltageMatch) {
      data.tensao_a = parseFloat(voltageMatch[1]);
      data.tensao_b = parseFloat(voltageMatch[2]);
      data.tensao_c = parseFloat(voltageMatch[3]);
    }

    const frequencyMatch = cleanedString.match(/Frequency \(Hz\)\s*=\s*([\d.-]+)/);
    if (frequencyMatch) {
      data.frequencia = parseFloat(frequencyMatch[1]);
    }

    if (Object.keys(data).length === 0) return null;
    return data;
  } catch (error) {
    console.error("[TCP Server] Erro ao fazer parse dos dados do relé:", error);
    return null;
  }
}

async function salvarLeituraRele(deviceId, parsedData, rawPayload, wss) {
  try {
    const timestampLeitura = new Date();
    const { tensao_a, tensao_b, tensao_c, corrente_a, corrente_b, corrente_c, frequencia } = parsedData;

    const [rows] = await promisePool.query("SELECT id FROM dispositivos_reles WHERE local_tag = ?", [deviceId]);
    if (rows.length === 0) return;
    const releId = rows[0].id;

    const sqlInsert = `INSERT INTO leituras_reles (rele_id, timestamp_leitura, tensao_a, tensao_b, tensao_c, corrente_a, corrente_b, corrente_c, frequencia, payload_completo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await promisePool.query(sqlInsert, [releId, timestampLeitura, tensao_a, tensao_b, tensao_c, corrente_a, corrente_b, corrente_c, frequencia, rawPayload]);
    
    console.log(`[TCP Server] SUCESSO: Leitura do dispositivo ${deviceId} (ID: ${releId}) salva no banco.`);

    const sqlUpdate = "UPDATE dispositivos_reles SET ultima_leitura = NOW(), status_json = ? WHERE id = ?";
    await promisePool.query(sqlUpdate, [JSON.stringify({ connection_status: "online", ...parsedData }), releId]);

    if (wss) {
      const payloadWebSocket = {
        type: "nova_leitura_rele",
        dados: { local_tag: deviceId, rele_id: releId, ...parsedData, timestamp_leitura: timestampLeitura.toISOString() },
      };
      wss.clients.forEach((client) => {
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
  const port = process.env.TCP_SERVER_PORT || 4000;
  const pollInterval = 15000;
  
  const LOGIN_USER = "ACC\r\n";
  const LOGIN_PASS = "OTTER\r\n";
  const COMMAND_TO_POLL = "MET\r\n";

  const server = net.createServer((socket) => {
    const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP Server] Nova conexão de ${remoteAddress}.`);

    socket.state = 'AWAITING_REGISTRATION';
    socket.deviceId = null;
    socket.buffer = '';

    socket.on('data', async (data) => {
      socket.buffer += data.toString();

      if (socket.state === 'AWAITING_REGISTRATION') {
        const deviceId = data.toString('hex').toUpperCase();
        socket.buffer = '';
        try {
          const [rows] = await promisePool.query("SELECT id FROM dispositivos_reles WHERE local_tag = ? AND ativo = 1", [deviceId]);
          if (rows.length > 0) {
            socket.deviceId = deviceId;
            releClients.set(deviceId, socket);
            console.log(`[TCP Server] [${deviceId}] Registrado. Enviando 'ACC'.`);
            socket.state = 'AWAITING_USER_PROMPT';
            socket.write(LOGIN_USER);
          } else {
            socket.end();
          }
        } catch (err) {
          socket.end();
        }
        return;
      }

      // Processa o buffer apenas quando a mensagem estiver completa (termina com '=>')
      if (socket.buffer.includes('=>')) {
        const responseStr = socket.buffer.trim();
        socket.buffer = ''; // Limpa o buffer para a próxima mensagem
        console.log(`[TCP Server] [${socket.deviceId}] Mensagem completa recebida.`);

        switch (socket.state) {
          case 'AWAITING_USER_PROMPT':
            console.log(`[TCP Server] [${socket.deviceId}] Resposta ao usuário recebida. Enviando 'OTTER'.`);
            socket.state = 'AWAITING_PASS_PROMPT';
            socket.write(LOGIN_PASS);
            break;
          
          case 'AWAITING_PASS_PROMPT':
            console.log(`[TCP Server] [${socket.deviceId}] Login concluído.`);
            socket.state = 'LOGGED_IN_IDLE';
            break;

          case 'LOGGED_IN_WAITING_RESPONSE':
            const parsedData = parseSelData(responseStr);
            if (parsedData) {
              const wss = app.get("wss");
              salvarLeituraRele(socket.deviceId, parsedData, responseStr, wss);
            } else {
              console.warn(`[TCP Server] [${socket.deviceId}] Parser falhou ao extrair dados da resposta completa.`);
            }
            socket.state = 'LOGGED_IN_IDLE';
            break;
        }
      }
    });

    socket.on("close", () => {
      if (socket.deviceId) releClients.delete(socket.deviceId);
      console.log(`[TCP Server] Conexão com ${socket.deviceId || remoteAddress} fechada.`);
    });

    socket.on("error", (err) => {
      console.error(`[TCP Server] Erro no socket de ${remoteAddress}:`, err.message);
    });
  });

  server.listen(port, () => {
    console.log(`[TCP Server] Servidor TCP ouvindo na porta ${port}`);
  });

  setInterval(() => {
    for (const socket of releClients.values()) {
      if (socket.state === 'LOGGED_IN_IDLE' && socket.writable) {
        console.log(`[TCP Server] [${socket.deviceId}] Enviando comando 'MET'.`);
        socket.state = 'LOGGED_IN_WAITING_RESPONSE';
        socket.write(COMMAND_TO_POLL);
      }
    }
  }, pollInterval);
}

module.exports = { iniciarServidorTCP };
