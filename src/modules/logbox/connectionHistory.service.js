const { promisePool } = require("../../infrastructure/database");
const { verificarConexaoAtiva, CONNECTION_TIMEOUT_MS } = require("./helpers/validation.helper");

const CHECK_INTERVAL_MS = 60 * 1000;

async function obterEventoOfflineAberto(serialNumber) {
  const [rows] = await promisePool.query(
    "SELECT id, timestamp_offline FROM historico_conexao WHERE serial_number = ? AND duracao_segundos IS NULL ORDER BY id DESC LIMIT 1",
    [serialNumber]
  );
  return rows[0] || null;
}

async function registrarLeituraRecebida(serialNumber) {
  const eventoAberto = await obterEventoOfflineAberto(serialNumber);
  if (!eventoAberto) return;

  const inicio = new Date(eventoAberto.timestamp_offline);
  const duracao = Math.max(0, Math.floor((Date.now() - inicio.getTime()) / 1000));

  await promisePool.query(
    "UPDATE historico_conexao SET duracao_segundos = ? WHERE id = ?",
    [duracao, eventoAberto.id]
  );
}

async function registrarOffline(serialNumber, ultimaLeitura) {
  const eventoAberto = await obterEventoOfflineAberto(serialNumber);
  if (eventoAberto) return;

  const timestampOffline = ultimaLeitura ? new Date(ultimaLeitura) : new Date();

  await promisePool.query(
    "INSERT INTO historico_conexao (serial_number, timestamp_offline) VALUES (?, ?)",
    [serialNumber, timestampOffline]
  );
}

async function verificarDispositivosOffline() {
  const [devices] = await promisePool.query(
    "SELECT serial_number, ultima_leitura FROM dispositivos_logbox WHERE ativo = 1"
  );

  for (const device of devices) {
    const conexao = verificarConexaoAtiva(device.ultima_leitura);
    if (!conexao.online) {
      await registrarOffline(device.serial_number, device.ultima_leitura);
    }
  }
}

function iniciarMonitoramentoConexao(logger) {
  verificarDispositivosOffline().catch((err) => {
    logger.error(`[Conexão] Erro na verificação inicial: ${err.message}`);
  });

  const timer = setInterval(() => {
    verificarDispositivosOffline().catch((err) => {
      logger.error(`[Conexão] Erro ao verificar offline: ${err.message}`);
    });
  }, CHECK_INTERVAL_MS);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  logger.info(
    `[Conexão] Monitoramento de offline ativo (intervalo ${CHECK_INTERVAL_MS / 1000}s, timeout ${CONNECTION_TIMEOUT_MS / 60000} min).`
  );
}

module.exports = {
  registrarLeituraRecebida,
  registrarOffline,
  verificarDispositivosOffline,
  iniciarMonitoramentoConexao,
};
