import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { promisePool } from "../infrastructure/database";
import logger from "../config/logger";
import { ensureCsrfToken } from "../middleware/csrf";
import { clearFailedLogin, isAccountLocked, recordFailedLogin } from "./lockout";
import { registrarAuditoria } from "./audit";
import type { DbUserRow, SafeUser } from "./types";

export async function loginSeguro(req: Request, res: Response): Promise<void> {
  const { matricula, senha } = req.body as { matricula?: unknown; senha?: unknown };

  if (
    !matricula ||
    !senha ||
    typeof matricula !== "string" ||
    typeof senha !== "string"
  ) {
    res.status(400).json({ message: "Matrícula e senha são obrigatórios." });
    return;
  }

  const matriculaLimpa = matricula.trim();
  const senhaLimpa = senha.trim();

  if (!matriculaLimpa || !senhaLimpa) {
    res.status(400).json({ message: "Matrícula e senha não podem ser vazios." });
    return;
  }

  if (isAccountLocked(matriculaLimpa)) {
    res.status(429).json({
      message:
        "Conta temporariamente bloqueada por tentativas inválidas. Tente novamente em 15 minutos.",
    });
    return;
  }

  try {
    const [rows] = (await promisePool.query(
      "SELECT *, nivel FROM users WHERE matricula = ?",
      [matriculaLimpa]
    )) as [DbUserRow[], unknown];

    if (rows.length === 0) {
      recordFailedLogin(matriculaLimpa);
      await registrarAuditoria(matriculaLimpa, "LOGIN_FALHA", "Tentativa com matrícula inexistente");
      res.status(401).json({ message: "Matrícula ou senha inválida." });
      return;
    }

    const usuario = rows[0];

    if (usuario.nivel === 0) {
      res.status(403).json({
        message: "Usuário desativado ou sem permissão de acesso.",
      });
      return;
    }

    if (!usuario.senha || !usuario.senha.startsWith("$2b$")) {
      logger.warn(
        `[Auth] Usuário ${matriculaLimpa} com senha não-bcrypt bloqueado. Execute a migração manual.`
      );
      res.status(401).json({ message: "Matrícula ou senha inválida." });
      return;
    }

    const senhaValida = await bcrypt.compare(senhaLimpa, usuario.senha);

    if (!senhaValida) {
      recordFailedLogin(matriculaLimpa);
      await registrarAuditoria(matriculaLimpa, "LOGIN_FALHA", "Senha incorreta");
      res.status(401).json({ message: "Matrícula ou senha inválida." });
      return;
    }

    clearFailedLogin(matriculaLimpa);

    const safeUser: SafeUser = {
      id: usuario.id,
      nome: usuario.nome,
      matricula: usuario.matricula,
      cargo: usuario.cargo,
      nivel: usuario.nivel,
      ultimoAcesso: usuario.ultimo_login || null,
    };

    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    req.session.user = {
      id: safeUser.id,
      nome: safeUser.nome,
      matricula: safeUser.matricula,
      cargo: safeUser.cargo,
      nivel: safeUser.nivel,
    };
    ensureCsrfToken(req);

    await promisePool.query("UPDATE users SET ultimo_login = NOW() WHERE matricula = ?", [
      matriculaLimpa,
    ]);

    await registrarAuditoria(matriculaLimpa, "LOGIN", "Login no sistema");

    res.status(200).json({
      message: "Login bem-sucedido!",
      user: safeUser,
    });
  } catch (err) {
    const error = err as Error;
    logger.error(`[Auth] Erro no login: ${error.message}`);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
}
