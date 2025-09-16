const path = require('path');
require("dotenv").config({ path: path.resolve(__dirname, '../../.env') });

const net = require("net");
const mysql = require("mysql2/promise");

const RELE_SERVER_PORT = 4000;
const POLLING_INTERVAL_MS = 10000;

const dbConfig = {
  host: '127.0.0.1',
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const promisePool = mysql.createPool(dbConfig);
const connectedClients = new Map();

function parseSelResponse(response) {
  try {
    const data = {};
    const cleanedResponse = response.replace("=>", "").trim();
    const parts = cleanedResponse.split(/\s+/);
    parts.forEach(part => {
      const [key, value] = part.split('=');
      if (key && value) {
        const numValue = parseFloat(value);
        switch (key.toUpperCase()) {
          case 'VA': data.tensao_a = numValue; break;
          case 'VB': data.tensao_b = numValue; break;
          case 'VC': data.tensao_c = numValue; break;
          case 'IA': data.corrente_a = numValue; break;
          case 'IB': data.corrente_b = numValue; break;
          case 'IC': data.corrente_c = numValue; break;
          case 'FREQ': data.frequencia = numValue; break;
        }
      }
    });
    data.payload_completo = response;
    data.timestamp_leitura = new Date().toISOString();
    return Object.keys(data).length > 2 ? data : null;
  } catch (error) {
    console.error("[Servidor Rele] Erro ao analisar resposta:", error);
    return null;
  }
}

async function salvarLeituraRele(parsedData, releId) {
  try {
    const { timestamp_leitura, tensao_a, tensao_b, tensao_c, corrente_a, corrente_b, corrente_c, frequencia, payload_completo } = parsedData;
    const sqlInsert = `INSERT INTO leituras_reles (rele_id, timestamp_leitura, tensao_a, tensao_b, tensao_c, corrente_a, corrente_b, corrente_c, frequencia, payload_completo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await promisePool.query(sqlInsert, [releId, timestamp_leitura, tensao_a, tensao_b, tensao_c, corrente_a, corrente_b, corrente_c, frequencia, payload_completo]);
    const sqlUpdate = "UPDATE dispositivos_reles SET ultima_leitura = NOW(), status_json = ? WHERE id = ?";
    await promisePool.query(sqlUpdate, [JSON.stringify({ connection_status: "online", ...parsedData }), releId]);
    console.log(`[Servidor Rele] Leitura do relé ID: ${releId} salva no banco de dados.`);
  } catch (err) {
    console.error(`[Servidor Rele] Erro ao salvar leitura do relé ID ${releId} no banco de dados:`, err);
  }
}

const server = net.createServer((socket) => {
  const remoteIdentifier = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[Servidor Rele] Nova conexão recebida de: ${remoteIdentifier}. Aguardando identificação...`);
  
  let releId = null;
  let registrationId = null;

  const dataHandler = async (data) => {
    if (!releId) {
      let receivedId = '';
      if (Buffer.isBuffer(data)) {
        receivedId = data.toString('hex').toUpperCase();
      } else {
        receivedId = data.toString().trim();
      }
      
      console.log(`[Servidor Rele] Pacote de registro recebido e convertido para: "${receivedId}"`);
      registrationId = receivedId;

      try {
        const [rows] = await promisePool.query("SELECT id FROM dispositivos_reles WHERE local_tag = ? AND ativo = 1", [registrationId]);
        
        if (rows.length > 0) {
          releId = rows[0].id;
          connectedClients.set(releId, { socket: socket, tag: registrationId });
          console.log(`[Servidor Rele] Cliente "${registrationId}" (ID: ${releId}) identificado e registrado com sucesso.`);
        } else {
          console.warn(`[Servidor Rele] ID de registro "${registrationId}" não encontrado ou inativo no banco de dados. Fechando conexão.`);
          socket.end();
        }
      } catch (err) {
        console.error("[Servidor Rele] Erro de banco de dados durante o registro:", err);
        socket.end();
      }
    } else {
      const responseStr = data.toString();
      const isRegistrationPacketAgain = data.toString('hex').toUpperCase() === registrationId;
      
      if (isRegistrationPacketAgain) {
        return;
      }

      const parsedData = parseSelResponse(responseStr);
      if (parsedData) {
        salvarLeituraRele(parsedData, releId);
      }
    }
  };

  socket.on('data', dataHandler);

  socket.on('close', () => {
    if (releId) {
      const clientInfo = connectedClients.get(releId);
      console.log(`[Servidor Rele] Cliente "${clientInfo.tag}" (ID: ${releId}) desconectado.`);
      connectedClients.delete(releId);
    } else {
      console.log(`[Servidor Rele] Conexão de ${remoteIdentifier} fechada antes da identificação.`);
    }
  });

  socket.on('error', (err) => {
    if (releId) {
      const clientInfo = connectedClients.get(releId);
      console.error(`[Servidor Rele] Erro no socket do cliente "${clientInfo.tag}":`, err.message);
      connectedClients.delete(releId);
    }
  });
});

server.listen(RELE_SERVER_PORT, '0.0.0.0', () => {
  console.log(`[Servidor Rele] Servidor TCP aguardando conexões na porta ${RELE_SERVER_PORT}`);
});

setInterval(() => {
  if (connectedClients.size > 0) {
    console.log(`[Servidor Rele] Enviando comando de leitura para ${connectedClients.size} cliente(s) conectado(s)...`);
    for (const client of connectedClients.values()) {
      client.socket.write('ME\r\n');
    }
  }
}, POLLING_INTERVAL_MS);
