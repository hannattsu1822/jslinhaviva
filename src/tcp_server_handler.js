const net = require("net");
const { promisePool } = require("./init");

const releClients = new Map();

function parseSelData(rawString) {
  const data = {};
  try {
    const cleanedString = rawString.replace(/[\x00-\x1F\x7F-\x9F]+/g, "").trim();
    const lines = cleanedString.split('\n');
    
    let currentSection = '';

    lines.forEach(line => {
      line = line.trim();

      if (line.includes('Current Magnitude (A)')) {
        currentSection = 'CURRENT';
      } else if (line.includes('Voltage Magnitude (V)')) {
        currentSection = 'VOLTAGE';
      } else if (line.includes('Frequency (Hz)')) {
        currentSection = 'FREQUENCY';
      }

      if (currentSection === 'CURRENT' && !isNaN(parseFloat(line.split(/\s+/)[0]))) {
          const values = line.split(/\s+/).map(parseFloat);
          if (values.length >= 3) {
              data.corrente_a = values[0];
              data.corrente_b = values[1];
              data.corrente_c = values[2];
              currentSection = '';
          }
      } else if (currentSection === 'VOLTAGE' && !isNaN(parseFloat(line.split(/\s+/)[0]))) {
          const values = line.split(/\s+/).map(parseFloat);
          if (values.length >= 3) {
              data.tensao_a = values[0];
              data.tensao_b = values[1];
              data.tensao_c = values[2];
              currentSection = '';
          }
      } else if (currentSection === 'FREQUENCY' && line.includes('=')) {
          const value = parseFloat(line.split('=')[1].trim());
          if (!isNaN(value)) {
              data.frequencia = value;
              currentSection = '';
          }
      }
    });

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
    console.log(`[TCP Server] Nova conexão de ${remoteAddress}. Aguardando registro.`);

    socket.state = 'AWAITING_REGISTRATION';
    socket.deviceId = null;
    let accumulatedData = '';

    socket.on('data', async (data) => {
      accumulatedData += data.toString();
      
      if (!accumulatedData.includes('=>') && !accumulatedData.includes('\n') && socket.state !== 'AWAITING_REGISTRATION') {
        return;
      }

      const responseStr = accumulatedData.trim();
      accumulatedData = '';
      
      console.log(`[TCP Server] [${socket.deviceId || 'N/A'}] DADOS RECEBIDOS: "${responseStr}" | ESTADO ATUAL: ${socket.state}`);

      switch (socket.state) {
        case 'AWAITING_REGISTRATION':
          const deviceId = data.toString('hex').toUpperCase();
          try {
            const [rows] = await promisePool.query("SELECT id FROM dispositivos_reles WHERE local_tag = ? AND ativo = 1", [deviceId]);
            if (rows.length > 0) {
              socket.deviceId = deviceId;
              releClients.set(deviceId, socket);
              console.log(`[TCP Server] [${deviceId}] Registrado. Enviando usuário 'ACC'.`);
              socket.state = 'AWAITING_USER_PROMPT';
              socket.write(LOGIN_USER);
            } else {
              console.warn(`[TCP Server] MAC "${deviceId}" não encontrado. Fechando.`);
              socket.end();
            }
          } catch (err) {
            console.error("[TCP Server] Erro de DB no registro:", err);
            socket.end();
          }
          break;

        case 'AWAITING_USER_PROMPT':
          console.log(`[TCP Server] [${socket.deviceId}] Resposta ao usuário recebida. Enviando senha 'OTTER'.`);
          socket.state = 'AWAITING_PASS_PROMPT';
          socket.write(LOGIN_PASS);
          break;
        
        case 'AWAITING_PASS_PROMPT':
          console.log(`[TCP Server] [${socket.deviceId}] Resposta à senha recebida. Login concluído.`);
          socket.state = 'LOGGED_IN_IDLE';
          break;

        case 'LOGGED_IN_WAITING_RESPONSE':
          // --- INÍCIO DOS LOGS DE DEPURAÇÃO ---
          console.log(`[TCP Server] [${socket.deviceId}] Tentando analisar a resposta do comando MET...`);
          const parsedData = parseSelData(responseStr);
          console.log(`[TCP Server] [${socket.deviceId}] Resultado do parser:`, parsedData);
          // --- FIM DOS LOGS DE DEPURAÇÃO ---

          if (parsedData) {
            const wss = app.get("wss");
            salvarLeituraRele(socket.deviceId, parsedData, responseStr, wss);
          } else {
            console.warn(`[TCP Server] [${socket.deviceId}] Parser não conseguiu extrair dados da resposta.`);
          }
          socket.state = 'LOGGED_IN_IDLE';
          break;
      }
    });

    socket.on("close", () => {
      if (socket.deviceId) {
        releClients.delete(socket.deviceId);
        console.log(`[TCP Server] Conexão com ${socket.deviceId} fechada.`);
      } else {
        console.log(`[TCP Server] Conexão com ${remoteAddress} fechada.`);
      }
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
        console.log(`[TCP Server] [${socket.deviceId}] Enviando comando de polling 'MET'.`);
        socket.state = 'LOGGED_IN_WAITING_RESPONSE';
        socket.write(COMMAND_TO_POLL);
      }
    }
  }, pollInterval);
}

module.exports = { iniciarServidorTCP };
