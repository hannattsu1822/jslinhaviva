import { promisePool } from "../../../infrastructure/database";
import {
  validarTemperatura,
  validarStatusDispositivo,
  extrairTemperaturaPayload,
} from "../../../telemetry/rules/validation";
import type {
  LogboxDeviceListItem,
  LogboxDeviceManagementView,
  LogboxDeviceRow,
  SaveDeviceInput,
} from "../types";
import type { LogboxPayload } from "../../../telemetry/types";

export async function listarDispositivosParaGerenciamento(): Promise<LogboxDeviceManagementView[]> {
  const [devices] = (await promisePool.query(
    "SELECT id, local_tag, serial_number, descricao, ativo, ultima_leitura, status_json FROM dispositivos_logbox ORDER BY local_tag"
  )) as [LogboxDeviceRow[], unknown];

  return devices.map((device) => {
    let status: LogboxPayload = {};

    try {
      status =
        device.status_json && typeof device.status_json === "string"
          ? JSON.parse(device.status_json)
          : (device.status_json as LogboxPayload) || {};
    } catch {
      console.error(
        `Erro ao parsear status_json para SN ${device.serial_number}:`,
        device.status_json
      );
      status = {};
    }

    const statusValidado = validarStatusDispositivo(status, device.ultima_leitura);
    const temperaturaExterna = extrairTemperaturaPayload(status);
    const validacaoTemp = validarTemperatura(temperaturaExterna);

    return {
      ...device,
      temperatura_externa: validacaoTemp.valid ? (validacaoTemp.value ?? null) : null,
      temperatura_invalida: !validacaoTemp.valid,
      connection_status: statusValidado.connection_status,
      minutes_since_last_reading: statusValidado.minutes_since_last_reading,
      connection_warning: statusValidado.connection_warning ?? null,
    };
  });
}

export async function listarDispositivosAtivos(): Promise<LogboxDeviceListItem[]> {
  const [devices] = (await promisePool.query(
    "SELECT id, local_tag, serial_number, ativo FROM dispositivos_logbox WHERE ativo = 1 ORDER BY local_tag"
  )) as [LogboxDeviceListItem[], unknown];

  return devices;
}

export async function obterDispositivoPorId(id: number | string): Promise<LogboxDeviceRow> {
  const [rows] = (await promisePool.query(
    "SELECT * FROM dispositivos_logbox WHERE id = ?",
    [id]
  )) as [LogboxDeviceRow[], unknown];

  if (rows.length === 0) {
    throw new Error("Dispositivo não encontrado");
  }

  return rows[0];
}

export async function salvarDispositivo(dadosDispositivo: SaveDeviceInput): Promise<void> {
  const { id, local_tag, serial_number, descricao } = dadosDispositivo;

  if (!local_tag || local_tag.trim() === "") {
    throw new Error("Local/Tag é obrigatório");
  }

  if (!serial_number || serial_number.trim() === "") {
    throw new Error("Número de série é obrigatório");
  }

  if (id) {
    await promisePool.query(
      "UPDATE dispositivos_logbox SET local_tag = ?, serial_number = ?, descricao = ? WHERE id = ?",
      [local_tag, serial_number, descricao, id]
    );
    return;
  }

  await promisePool.query(
    "INSERT INTO dispositivos_logbox (local_tag, serial_number, descricao) VALUES (?, ?, ?)",
    [local_tag, serial_number, descricao]
  );
}

export async function excluirDispositivo(id: number | string): Promise<void> {
  await promisePool.query("DELETE FROM dispositivos_logbox WHERE id = ?", [id]);
}
