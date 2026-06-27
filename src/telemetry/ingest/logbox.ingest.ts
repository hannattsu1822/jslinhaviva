import { promisePool } from "../../infrastructure/database";
import {
  extrairTemperaturaPayload,
  analisarEstadoVentilacao,
  validarTemperatura,
} from "../rules/validation";
import { registrarLeituraRecebida } from "./connectionHistory";
import type { LogboxPayload } from "../types";

interface VentilationEventRow {
  id: number;
  timestamp_inicio: Date | string;
}

export async function processarNovaLeitura(
  serialNumber: string,
  payload: LogboxPayload | string
): Promise<{ success: true }> {
  try {
    const payloadString =
      typeof payload === "object" ? JSON.stringify(payload) : payload;
    const temperatura = extrairTemperaturaPayload(payload);

    await gerenciarLogicaVentilacao(serialNumber, temperatura);

    await promisePool.query(
      "INSERT INTO leituras_logbox (serial_number, payload_json, timestamp_leitura) VALUES (?, ?, NOW())",
      [serialNumber, payloadString]
    );

    await promisePool.query(
      "UPDATE dispositivos_logbox SET ultima_leitura = NOW(), status_json = ? WHERE serial_number = ?",
      [payloadString, serialNumber]
    );

    await registrarLeituraRecebida(serialNumber);

    return { success: true };
  } catch (error) {
    console.error(`Erro ao processar leitura para ${serialNumber}:`, error);
    throw error;
  }
}

async function gerenciarLogicaVentilacao(
  serialNumber: string,
  temperatura: number | null
): Promise<void> {
  const validacao = validarTemperatura(temperatura);
  if (!validacao.valid) return;

  const [rows] = (await promisePool.query(
    "SELECT id, timestamp_inicio FROM historico_ventilacao WHERE serial_number = ? AND timestamp_fim IS NULL ORDER BY id DESC LIMIT 1",
    [serialNumber]
  )) as [VentilationEventRow[], unknown];

  const eventoAberto = rows[0];
  const estadoAtual = !!eventoAberto;
  const analise = analisarEstadoVentilacao(temperatura, estadoAtual);

  if (!analise.mudou) return;

  if (analise.novoEstado === true) {
    await promisePool.query(
      "INSERT INTO historico_ventilacao (serial_number, timestamp_inicio) VALUES (?, NOW())",
      [serialNumber]
    );
    return;
  }

  if (eventoAberto) {
    const fim = new Date();
    const inicio = new Date(eventoAberto.timestamp_inicio);
    const duracao = (fim.getTime() - inicio.getTime()) / 1000;

    await promisePool.query(
      "UPDATE historico_ventilacao SET timestamp_fim = ?, duracao_segundos = ? WHERE id = ?",
      [fim, duracao, eventoAberto.id]
    );
  }
}
