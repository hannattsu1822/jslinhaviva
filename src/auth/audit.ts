import { promisePool } from "../infrastructure/database";
import logger from "../config/logger";
import type { DbConnection } from "./types";

export async function registrarAuditoria(
  matricula: string,
  acao: string,
  detalhes: string | null = null,
  connection: DbConnection | null = null
): Promise<void> {
  if (!matricula) {
    logger.error("[Auth] Tentativa de auditoria sem matrícula");
    throw new Error("Matrícula é obrigatória para auditoria");
  }

  const query =
    "INSERT INTO auditoria (matricula_usuario, acao, detalhes) VALUES (?, ?, ?)";

  try {
    if (connection) {
      await connection.query(query, [matricula, acao, detalhes]);
    } else {
      await promisePool.query(query, [matricula, acao, detalhes]);
    }
  } catch (err) {
    const error = err as Error;
    logger.error(`[Auth] Erro ao registrar auditoria: ${error.message}`);
  }
}
