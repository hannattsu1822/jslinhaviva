const net = require('net');

// --- CONFIGURE OS DADOS DO SEU RELÉ AQUI ---
const RELE_IP = 'SEU_IP_PUBLICO_DA_VPS'; 
const RELE_PORT = 4000;                  

// --- DADOS DE LOGIN E COMANDO ---
const LOGIN_USER = "ACC\r\n";
const LOGIN_PASS = "OTTER\r\n";
const COMMAND_TO_POLL = "MET\r\n";

console.log(`Aguardando conexão do relé na porta ${RELE_PORT}...`);

const server = net.createServer((socket) => {
    console.log('>>> CONVERSOR CONECTADO! Iniciando sequência de teste...');
    let buffer = '';

    socket.on('data', (data) => {
        const response = data.toString();
        console.log(`<<< DADOS BRUTOS RECEBIDOS: ${JSON.stringify(response)}`);
        buffer += response;
    });

    socket.on('close', () => {
        console.log('>>> CONEXÃO FECHADA PELO CONVERSOR.');
        server.close(); // Encerra o servidor de teste após a primeira tentativa
    });

    socket.on('error', (err) => {
        console.error('!!! ERRO DE CONEXÃO:', err.message);
    });

    // --- A SEQUÊNCIA DE COMANDOS "HUMANA" ---

 
    setTimeout(() => {
        console.log(`>>> ENVIANDO USUÁRIO: ACC`);
        socket.write(LOGIN_USER);
    }, 1000);

 
    setTimeout(() => {
        console.log(`>>> ENVIANDO SENHA: OTTER`);
        socket.write(LOGIN_PASS);
    }, 3000);


    setTimeout(() => {
        console.log(`>>> ENVIANDO COMANDO: MET`);
        socket.write(COMMAND_TO_POLL);
    }, 5000);

 
    setTimeout(() => {
        console.log('\n--- ANÁLISE FINAL DO BUFFER COMPLETO ---');
        console.log(buffer);
        console.log('----------------------------------------');
        console.log('>>> TESTE CONCLUÍDO. Encerrando conexão.');
        socket.end();
    }, 10000);
});

server.listen(RELE_PORT, '0.0.0.0');
