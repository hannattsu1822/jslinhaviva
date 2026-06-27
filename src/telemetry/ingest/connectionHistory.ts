import { promisePool } from "../../infrastructure/database";
import { verificarConexaoAtiva } from "../rules/validation";
import {
  CONNECTION_TIMEOUT_MS,
  CONNECTION_CHECK_INTERVAL_MS,
} from "../constants";
import type { AppLogger } from "../types";

interface OfflineEventRow {
  id: number;
  timestamp_offline: Date | string;
}

interface DeviceRow {
  serial_number: string;
  ultima_leitura: Date | string | null;
}

async function obterEventoOfflineAberto(
  serialNumber: string
): Promise<OfflineEventRow | null> {
  const [rows] = (await promisePool.query(
    "SELECT id, timestamp_offline FROM historico_conexao WHERE serial_number = ? AND duracao_segundos IS NULL ORDER BY id DESC LIMIT 1",
    [serialNumber]
  )) as [OfflineEventRow[], unknown];
  return rows[0] ?? null;
}

export async function registrarLeituraRecebida(serialNumber: string): Promise<void> {
  const eventoAberto = await obterEventoOfflineAberto(serialNumber);
  if (!eventoAberto) return;

  const inicio = new Date(eventoAberto.timestamp_offline);
  const duracao = Math.max(0, Math.floor((Date.now() - inicio.getTime()) / 1000));

  await promisePool.query(
    "UPDATE historico_conexao SET duracao_segundos = ? WHERE id = ?",
    [duracao, eventoAberto.id]
  );
}

export async function registrarOffline(
  serialNumber: string,
  ultimaLeitura: Date | string | null | undefined
): Promise<void> {
  const eventoAberto = await obterEventoOfflineAberto(serialNumber);
  if (eventoAberto) return;

  const timestampOffline = ultimaLeitura ? new Date(ultimaLeitura) : new Date();

  await promisePool.query(
    "INSERT INTO historico_conexao (serial_number, timestamp_offline) VALUES (?, ?)",
    [serialNumber, timestampOffline]
  );
}

export async function verificarDispositivosOffline(): Promise<void> {
  const [devices] = (await promisePool.query(
    "SELECT serial_number, ultima_leitura FROM dispositivos_logbox WHERE ativo = 1"
  )) as [DeviceRow[], unknown];

  for (const device of devices) {
    const conexao = verificarConexaoAtiva(device.ultima_leitura);
    if (!conexao.online) {
      await registrarOffline(device.serial_number, device.ultima_leitura);
    }
  }
}

export function iniciarMonitoramentoConexao(logger: AppLogger): void {
  verificarDispositivosOffline().catch((err: Error) => {
    logger.error(`[Conexão] Erro na verificação inicial: ${err.message}`);
  });

  const timer = setInterval(() => {
    verificarDispositivosOffline().catch((err: Error) => {
      logger.error(`[Conexão] Erro ao verificar offline: ${err.message}`);
    });
  }, CONNECTION_CHECK_INTERVAL_MS);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  logger.info(
    `[Conexão] Monitoramento de offline ativo (intervalo ${CONNECTION_CHECK_INTERVAL_MS / 1000}s, timeout ${CONNECTION_TIMEOUT_MS / 60000} min).`
  );
}
