import type { ResultSetHeader } from "mysql2/promise";
import { promisePool } from "../../infrastructure/database";
import type { LeituraReleRow, ReleRow, SaveReleInput } from "./types";

export async function listarReles(): Promise<ReleRow[]> {
  const [rows] = (await promisePool.query(
    "SELECT id, nome_rele, local_tag, ip_address, port, ativo, ultima_leitura, status_json, listen_port, custom_id FROM dispositivos_reles ORDER BY nome_rele"
  )) as [ReleRow[], unknown];

  return rows;
}

export async function obterRelePorId(id: number | string): Promise<ReleRow> {
  const [rows] = (await promisePool.query("SELECT * FROM dispositivos_reles WHERE id = ?", [
    id,
  ])) as [ReleRow[], unknown];

  if (rows.length === 0) {
    throw new Error("Relé não encontrado");
  }

  return rows[0];
}

export async function criarRele(dadosRele: SaveReleInput): Promise<{ id: number }> {
  const { nome_rele, local_tag, ip_address, port, ativo, listen_port, custom_id } = dadosRele;

  if (!nome_rele || !ip_address || !port) {
    throw new Error("Campos obrigatórios: nome_rele, ip_address, port");
  }

  const [result] = (await promisePool.query(
    "INSERT INTO dispositivos_reles (nome_rele, local_tag, ip_address, port, ativo, listen_port, custom_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      nome_rele,
      local_tag,
      ip_address,
      port,
      ativo !== undefined ? ativo : 1,
      listen_port || null,
      custom_id || null,
    ]
  )) as unknown as [ResultSetHeader, unknown];

  return { id: result.insertId };
}

export async function atualizarRele(
  id: number | string,
  dadosRele: SaveReleInput
): Promise<void> {
  const { nome_rele, local_tag, ip_address, port, ativo, listen_port, custom_id } = dadosRele;

  if (!nome_rele || !ip_address || !port) {
    throw new Error("Campos obrigatórios: nome_rele, ip_address, port");
  }

  const [result] = (await promisePool.query(
    "UPDATE dispositivos_reles SET nome_rele = ?, local_tag = ?, ip_address = ?, port = ?, ativo = ?, listen_port = ?, custom_id = ? WHERE id = ?",
    [
      nome_rele,
      local_tag,
      ip_address,
      port,
      ativo,
      listen_port || null,
      custom_id || null,
      id,
    ]
  )) as unknown as [ResultSetHeader, unknown];

  if (result.affectedRows === 0) {
    throw new Error("Relé não encontrado");
  }
}

export async function deletarRele(id: number | string): Promise<{ nomeRele: string }> {
  const [rele] = (await promisePool.query(
    "SELECT nome_rele FROM dispositivos_reles WHERE id = ?",
    [id]
  )) as [{ nome_rele: string }[], unknown];

  if (rele.length === 0) {
    throw new Error("Relé não encontrado para deletar.");
  }

  const [result] = (await promisePool.query("DELETE FROM dispositivos_reles WHERE id = ?", [
    id,
  ])) as unknown as [ResultSetHeader, unknown];

  if (result.affectedRows === 0) {
    throw new Error("Relé não encontrado");
  }

  return { nomeRele: rele[0].nome_rele };
}

export async function obterLeituras(
  releId: number | string,
  limit: number | string
): Promise<LeituraReleRow[]> {
  const parsedLimit = parseInt(String(limit), 10) || 100;
  const [leituras] = (await promisePool.query(
    "SELECT * FROM leituras_reles WHERE rele_id = ? ORDER BY timestamp_leitura DESC LIMIT ?",
    [releId, parsedLimit]
  )) as [LeituraReleRow[], unknown];

  return leituras.reverse();
}

export async function obterDadosPaginaDetalhe(id: number | string) {
  const [rele] = (await promisePool.query(
    "SELECT nome_rele, local_tag FROM dispositivos_reles WHERE id = ?",
    [id]
  )) as [{ nome_rele: string; local_tag: string | null }[], unknown];

  if (rele.length === 0) {
    throw new Error("Relé não encontrado");
  }

  const [ultimaLeituraRows] = (await promisePool.query(
    "SELECT * FROM leituras_reles WHERE rele_id = ? ORDER BY timestamp_leitura DESC LIMIT 1",
    [id]
  )) as [LeituraReleRow[], unknown];

  return {
    rele: rele[0],
    ultimaLeitura: ultimaLeituraRows.length > 0 ? ultimaLeituraRows[0] : null,
  };
}
