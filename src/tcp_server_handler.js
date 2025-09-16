const net = require("net");
const { promisePool } = require("./init");

const releClients = new Map();

function parseSelData(rawString) {
  const data = {};
  try {
    const cleanedResponse = rawString.replace("=>", "").trim();
    const pairs = cleanedResponse.split(/\s+/);
    
    pairs.forEach((pair) => {
      const [key, value] = pair.split("=");
      if (key && value) {
        switch (key.toUpperCase()) {
          case 'VA': data.tensao_a = parseFloat(value); break;
          case 'VB': data.tensao_b = parseFloat(value); break;
          case 'VC': data.tensao_c = parseFloat(value); break;
          case 'IA': data.corrente_a = parseFloat(value); break;
          case 'IB': data.corrente_b = parseFloat(value); break;
          case 'IC': data.corrente_c = parseFloat(value); break;
          case 'FREQ': data.frequencia = parseFloat(value); break;
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
    
    console.log(`[TCP Server] Leitura do dispositivo ${deviceId} (ID: ${releId}) salva no banco.`);

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
  // --- MUDANÇA: Ajustes para o teste ---
  const port = process.env.TCP_SERVER_PORT || 4000;
  const pollInterval = 60000; // 60 segundos
  
  const LOGIN_USER = "ACC\r\n";
  const LOGIN_PASS = "OTTER\r\n";
  const COMMAND_TO_POLL = "MET1\r\n"; // Apenas um comando
  // --- FIM DA MUDANÇA ---

  const server = net.createServer((socket) => {
    const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP Server] Nova conexão recebida de ${remoteAddress}. Aguardando identificação...`);

    socket.state = 'AWAITING_REGISTRATION';
    socket.deviceId = null;

    socket.on('data', async (data) => {
      const responseStr = data.toString().trim();
      const isRegistrationPacket = socket.state === 'AWAITING_REGISTRATION';

      if (isRegistrationPacket) {
        const deviceId = data.toString('hex').toUpperCase();
        console.log(`[TCP Server] Pacote de registro recebido e convertido para: "${deviceId}"`);

        try {
          const [rows] = await promisePool.query("SELECT id FROM dispositivos_reles WHERE local_tag = ? AND ativo = 1", [deviceId]);
          if (rows.length > 0) {
            socket.deviceId = deviceId;
            releClients.set(deviceId, socket);
            console.log(`[TCP Server] Dispositivo ${deviceId} (${remoteAddress}) registrado.`);
            console.log(`[TCP Server] [${socket.deviceId}] ENVIANDO usuário: ACC`);
            socket.state = 'AWAITING_USER_PROMPT';
            socket.write(LOGIN_USER);
          } else {
            console.warn(`[TCP Server] Dispositivo com MAC "${deviceId}" não encontrado. Fechando conexão.`);
            socket.end();
          }
        } catch (err) {
          console.error("[TCP Server] Erro de DB durante registro:", err);
          socket.end();
        }
        return;
      }

      switch (socket.state) {
        case 'AWAITING_USER_PROMPT':
          // --- MUDANÇA: Log detalhado ---
          console.log(`[TCP Server] [${socket.deviceId}] RESPOSTA recebida do relé: "${responseStr}"`);
          console.log(`[TCP Server] [${socket.deviceId}] ENVIANDO senha: OTTER`);
          // --- FIM DA MUDANÇA ---
          socket.state = 'AWAITING_PASS_PROMPT';
          socket.write(LOGIN_PASS);
          break;
        
        case 'AWAITING_PASS_PROMPT':
          // --- MUDANÇA: Log detalhado ---
          console.log(`[TCP Server] [${socket.deviceId}] RESPOSTA recebida do relé: "${responseStr}"`);
          console.log(`[TCP Server] [${socket.deviceId}] Login concluído com sucesso. Monitoramento iniciado.`);
          // --- FIM DA MUDANÇA ---
          socket.state = 'LOGGED_IN';
          break;

        case 'LOGGED_IN':
          // --- MUDANÇA: Log detalhado ---
          console.log(`[TCP Server] [${socket.deviceId}] RESPOSTA recebida do relé: "${responseStr}"`);
          // --- FIM DA MUDANÇA ---
          const parsedData = parseSelData(responseStr);
          if (parsedData) {
            const wss = app.get("wss");
            salvarLeituraRele(socket.deviceId, parsedData, responseStr, wss);
          }
          break;
      }
    });

    socket.on("close", () => {
      if (socket.deviceId) {
        releClients.delete(socket.deviceId);
        console.log(`[TCP Server] Conexão com ${socket.deviceId} (${remoteAddress}) fechada.`);
      } else {
        console.log(`[TCP Server] Conexão com ${remoteAddress} (não registrado) fechada.`);
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
    if (releClients.size > 0) {
      const loggedInClients = Array.from(releClients.values()).filter(socket => socket.state === 'LOGGED_IN');
      
      if (loggedInClients.length > 0) {
        // --- MUDANÇA: Log detalhado ---
        console.log(`[TCP Server] ENVIANDO comando "${COMMAND_TO_POLL.trim()}" para ${loggedInClients.length} relé(s) logado(s)...`);
        // --- FIM DA MUDANÇA ---
        for (const socket of loggedInClients) {
          if (socket.writable) {
            socket.write(COMMAND_TO_POLL);
          }
        }
      }
    }
  }, pollInterval);
}

module.exports = { iniciarServidorTCP };
