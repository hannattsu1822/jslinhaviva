const net = require("net");
const { promisePool } = require("./init");

// MUDANÇA: Renomeei a 'clients' para ser mais específico.
const releClients = new Map();

// MUDANÇA: Adaptei a função de parse para o formato do SEL-2414 (com '=' e espaços)
function parseSelData(rawString) {
  const data = {};
  try {
    // Exemplo de resposta: "VA=220.1 VB=219.8 VC=220.5 IA=15.2 =>"
    const cleanedResponse = rawString.replace("=>", "").trim();
    const pairs = cleanedResponse.split(/\s+/); // Divide por espaços
    
    pairs.forEach((pair) => {
      const [key, value] = pair.split("=");
      if (key && value) {
        // MUDANÇA: Renomeei as chaves para corresponder ao banco de dados novo
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

// MUDANÇA: Adaptei a função de salvar para a nova tabela 'leituras_reles'
async function salvarLeituraRele(deviceId, parsedData, rawPayload, wss) {
  try {
    const timestampLeitura = new Date();
    const { tensao_a, tensao_b, tensao_c, corrente_a, corrente_b, corrente_c, frequencia } = parsedData;

    // Primeiro, precisamos do ID numérico do relé a partir do seu local_tag (MAC)
    const [rows] = await promisePool.query("SELECT id FROM dispositivos_reles WHERE local_tag = ?", [deviceId]);
    if (rows.length === 0) {
      console.warn(`[TCP Server] Tentativa de salvar leitura para dispositivo não cadastrado: ${deviceId}`);
      return;
    }
    const releId = rows[0].id;

    const sqlInsert = `INSERT INTO leituras_reles (rele_id, timestamp_leitura, tensao_a, tensao_b, tensao_c, corrente_a, corrente_b, corrente_c, frequencia, payload_completo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await promisePool.query(sqlInsert, [
      releId,
      timestampLeitura,
      tensao_a || null,
      tensao_b || null,
      tensao_c || null,
      corrente_a || null,
      corrente_b || null,
      corrente_c || null,
      frequencia || null,
      rawPayload,
    ]);
    console.log(`[TCP Server] Leitura do dispositivo ${deviceId} (ID: ${releId}) salva no banco.`);

    // Atualiza o status na tabela principal
    const sqlUpdate = "UPDATE dispositivos_reles SET ultima_leitura = NOW(), status_json = ? WHERE id = ?";
    await promisePool.query(sqlUpdate, [JSON.stringify({ connection_status: "online", ...parsedData }), releId]);

    if (wss) {
      const payloadWebSocket = {
        type: "nova_leitura_rele", // MUDANÇA: Novo tipo de evento para o frontend
        dados: {
          local_tag: deviceId,
          rele_id: releId,
          ...parsedData,
          timestamp_leitura: timestampLeitura.toISOString(),
        },
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
  const port = process.env.TCP_SERVER_PORT || 4000; // Garante que a porta é 4000
  const pollInterval = parseInt(process.env.TELNET_POLL_INTERVAL_SECONDS, 10) * 1000 || 10000;
  const command = (process.env.TELNET_COMMAND || "ME") + "\r\n"; // Usa \r\n para compatibilidade

  const server = net.createServer((socket) => {
    const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP Server] Nova conexão recebida de ${remoteAddress}. Aguardando identificação...`);

    socket.isRegistered = false;

    // MUDANÇA: Lógica de registro simplificada para o MAC Address
    socket.once('data', async (data) => {
      // Converte o pacote de registro binário/HEX para uma string de texto
      const deviceId = data.toString('hex').toUpperCase();
      console.log(`[TCP Server] Pacote de registro recebido e convertido para: "${deviceId}"`);

      try {
        // Verifica se o MAC Address está cadastrado no banco de dados
        const [rows] = await promisePool.query("SELECT id FROM dispositivos_reles WHERE local_tag = ? AND ativo = 1", [deviceId]);
        
        if (rows.length > 0) {
          socket.deviceId = deviceId;
          socket.isRegistered = true;
          releClients.set(deviceId, socket);
          console.log(`[TCP Server] Dispositivo ${deviceId} (${remoteAddress}) registrado com sucesso.`);

          // Agora que está registrado, escuta por respostas aos comandos de polling
          socket.on('data', (responseData) => {
            const responseStr = responseData.toString().trim();
            const isRegistrationPacketAgain = responseData.toString('hex').toUpperCase() === deviceId;
            if (isRegistrationPacketAgain) return; // Ignora se for o pacote de registro de novo

            const parsedData = parseSelData(responseStr);
            if (parsedData) {
              const wss = app.get("wss");
              salvarLeituraRele(socket.deviceId, parsedData, responseStr, wss);
            }
          });

        } else {
          console.warn(`[TCP Server] Dispositivo com MAC "${deviceId}" não encontrado ou inativo no banco. Fechando conexão.`);
          socket.end();
        }
      } catch (err) {
        console.error("[TCP Server] Erro de banco de dados durante o registro:", err);
        socket.end();
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

  // MUDANÇA: Lógica de polling adaptada
  setInterval(() => {
    if (releClients.size > 0) {
      console.log(`[TCP Server] Enviando comando de leitura para ${releClients.size} relé(s) conectado(s)...`);
      for (const socket of releClients.values()) {
        if (socket.writable) {
          socket.write(command);
        }
      }
    }
  }, pollInterval);
}

module.exports = { iniciarServidorTCP };
