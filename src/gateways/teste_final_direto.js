const net = require("net");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const RELE_PORT = process.env.TCP_SERVER_PORT || 4000;
const RELE_DEVICE_PASSWORD = process.env.RELE_DEVICE_PASSWORD;

if (!RELE_DEVICE_PASSWORD) {
  console.error("RELE_DEVICE_PASSWORD não definido no .env");
  process.exit(1);
}

const LOGIN_USER = "ACC\r\n";
const LOGIN_PASS = `${RELE_DEVICE_PASSWORD}\r\n`;
const COMMAND_TO_POLL = "MET\r\n";

console.log(`Aguardando conexão do relé na porta ${RELE_PORT}...`);

const server = net.createServer((socket) => {
  console.log(">>> CONVERSOR CONECTADO! Iniciando sequência de teste...");
  let buffer = "";

  socket.on("data", (data) => {
    const response = data.toString();
    console.log(`<<< DADOS BRUTOS RECEBIDOS: ${JSON.stringify(response)}`);
    buffer += response;
  });

  socket.on("close", () => {
    console.log(">>> CONEXÃO FECHADA PELO CONVERSOR.");
    server.close();
  });

  socket.on("error", (err) => {
    console.error("!!! ERRO DE CONEXÃO:", err.message);
  });

  setTimeout(() => {
    console.log(">>> ENVIANDO USUÁRIO: ACC");
    socket.write(LOGIN_USER);
  }, 1000);

  setTimeout(() => {
    console.log(">>> ENVIANDO SENHA (via RELE_DEVICE_PASSWORD)");
    socket.write(LOGIN_PASS);
  }, 3000);

  setTimeout(() => {
    console.log(">>> ENVIANDO COMANDO: MET");
    socket.write(COMMAND_TO_POLL);
  }, 5000);

  setTimeout(() => {
    console.log("\n--- ANÁLISE FINAL DO BUFFER COMPLETO ---");
    console.log(buffer);
    console.log("----------------------------------------");
    console.log(">>> TESTE CONCLUÍDO. Encerrando conexão.");
    socket.end();
  }, 10000);
});

const bindHost = process.env.RELE_TCP_BIND_HOST || "127.0.0.1";
server.listen(RELE_PORT, bindHost);
