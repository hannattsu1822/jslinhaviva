import type { NextFunction, Request, Response } from "express";
import logger from "../config/logger";
import { isApiRequest } from "./request";

function attachSessionUser(req: Request, res: Response, next: NextFunction): boolean {
  if (req.session?.user) {
    req.user = req.session.user;
    return true;
  }
  return false;
}

export function autenticarApi(req: Request, res: Response, next: NextFunction): void {
  if (attachSessionUser(req, res, next)) {
    next();
    return;
  }

  res.status(401).json({
    success: false,
    message: "Não autenticado.",
  });
}

export function autenticarPagina(req: Request, res: Response, next: NextFunction): void {
  if (attachSessionUser(req, res, next)) {
    next();
    return;
  }

  res.redirect("/login");
}

export function autenticar(req: Request, res: Response, next: NextFunction): void {
  if (attachSessionUser(req, res, next)) {
    next();
    return;
  }

  if (isApiRequest(req)) {
    res.status(401).json({
      success: false,
      message: "Não autenticado.",
    });
    return;
  }

  res.redirect("/login");
}

export function verificarNivel(nivelRequerido: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const nivelUsuario = req.user?.nivel;

    if (nivelUsuario === undefined) {
      logger.warn("[Auth] Acesso negado: nível não definido na sessão");
      res.status(403).json({
        message: "Acesso negado! Nível de permissão não encontrado.",
      });
      return;
    }

    if (nivelUsuario >= nivelRequerido) {
      next();
      return;
    }

    logger.warn(`[Auth] Nível insuficiente: ${nivelUsuario} < ${nivelRequerido}`);
    res.status(403).json({
      message: "Acesso negado! Você não tem permissão para acessar este recurso.",
    });
  };
}

export function verificarCargo(cargosPermitidos: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const cargoUsuario = req.user?.cargo;

    if (!cargoUsuario) {
      logger.warn("[Auth] Acesso negado: cargo não definido na sessão");
      res.status(403).json({
        message: "Acesso negado! Cargo de permissão não encontrado.",
      });
      return;
    }

    if (cargosPermitidos.includes(cargoUsuario)) {
      next();
      return;
    }

    logger.warn(
      `[Auth] Cargo bloqueado: ${cargoUsuario} não está em [${cargosPermitidos.join(", ")}]`
    );
    res.status(403).json({
      message: "Acesso negado! Você não tem permissão para acessar este recurso.",
    });
  };
}
