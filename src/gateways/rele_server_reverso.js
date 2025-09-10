const path = require('path');
require("dotenv").config({ path: path.resolve(__dirname, '../../.env') });

const net = require("net");
const mysql = require("mysql2/promise");

const RELE_SERVER_PORT = 4000;
const POLLING_INTERVAL_MS = 10000;

const dbConfig = {
  host: process.env.DB_HOST,
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

async function salvarLeituraRele(parsedData, remoteIp) {
  try {
    const [rows] = await promisePool.query("SELECT id, local_tag FROM dispositivos_reles WHERE ip_address = ? AND ativo = 1", [remoteIp]);
    if (rows.length === 0) {
      console.warn(`[Servidor Rele] Recebida resposta de um IP não cadastrado ou inativo: ${remoteIp}`);
      return;
    }
    const rele = rows[0];
    const { timestamp_leitura, tensao_a, tensao_b, tensao_c, corrente_a, corrente_b, corrente_c, frequencia, payload_completo } = parsedData;
    const sqlInsert = `INSERT INTO leituras_reles (rele_id, timestamp_leitura, tensao_a, tensao_b, tensao_c, corrente_a, corrente_b, corrente_c, frequencia, payload_completo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await promisePool.query(sqlInsert, [rele.id, timestamp_leitura, tensao_a, tensao_b, tensao_c, corrente_a, corrente_b, corrente_c, frequencia, payload_completo]);
    const sqlUpdate = "UPDATE dispositivos_reles SET ultima_leitura = NOW(), status_json = ? WHERE id = ?";
    await promisePool.query(sqlUpdate, [JSON.stringify({ connection_status: "online", ...parsedData }), rele.id]);
    console.log(`[Servidor Rele] Leitura do relé '${rele.local_tag}' (IP: ${remoteIp}) salva no banco de dados.`);
  } catch (err) {
    console.error(`[Servidor Rele] Erro ao salvar leitura do IP ${remoteIp} no banco de dados:`, err);
  }
}

const server = net.createServer((socket) => {
  const remoteIdentifier = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[Servidor Rele] Novo cliente (conversor) conectado: ${remoteIdentifier}`);
  connectedClients.set(remoteIdentifier, socket);

  socket.on('data', (data) => {
    const response = data.toString();
    const parsedData = parseSelResponse(response);
    if (parsedData) {
      salvarLeituraRele(parsedData, socket.remoteAddress);
    }
  });

  socket.on('close', () => {
    console.log(`[Servidor Rele] Cliente desconectado: ${remoteIdentifier}`);
    connectedClients.delete(remoteIdentifier);
  });

  socket.on('error', (err) => {
    console.error(`[Servidor Rele] Erro no socket do cliente ${remoteIdentifier}:`, err.message);
    connectedClients.delete(remoteIdentifier);
  });
});

server.listen(RELE_SERVER_PORT, '0.0.0.0', () => {
  console.log(`[Servidor Rele] Servidor TCP aguardando conexões na porta ${RELE_SERVER_PORT}`);
});

setInterval(() => {
  if (connectedClients.size > 0) {
    console.log(`[Servidor Rele] Enviando comando de leitura para ${connectedClients.size} cliente(s) conectado(s)...`);
    for (const clientSocket of connectedClients.values()) {
      clientSocket.write('ME\r\n');
    }
  }
}, POLLING_INTERVAL_MS);
