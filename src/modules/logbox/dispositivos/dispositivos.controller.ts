import type { Request, Response } from "express";
import * as service from "./dispositivos.service";
import type { SaveDeviceInput } from "../types";

export async function renderizarPaginaGerenciamento(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const devices = await service.listarDispositivosParaGerenciamento();
    res.render("pages/logbox/gerenciar-dispositivos.html", {
      pageTitle: "Gerenciar Dispositivos LogBox",
      user: req.user,
      devices,
    });
  } catch (err) {
    console.error("Erro ao buscar dispositivos:", err);
    res.status(500).send("Erro interno ao buscar dispositivos.");
  }
}

export async function renderizarPaginaLista(req: Request, res: Response): Promise<void> {
  try {
    const devices = await service.listarDispositivosAtivos();
    res.render("pages/logbox/device-list.html", {
      pageTitle: "Equipamentos LogBox",
      user: req.user,
      devices,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao buscar dispositivos");
  }
}

export async function listarDispositivosApi(req: Request, res: Response): Promise<void> {
  try {
    const devices = await service.listarDispositivosAtivos();
    res.json(devices);
  } catch (err) {
    console.error("Erro ao buscar dispositivos:", err);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
}

export async function obterDispositivoPorId(req: Request, res: Response): Promise<void> {
  try {
    const device = await service.obterDispositivoPorId(String(req.params.id));
    res.json(device);
  } catch (err) {
    const error = err as Error;
    console.error("Erro ao buscar dispositivo:", error);
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

export async function salvarDispositivo(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as SaveDeviceInput;
    await service.salvarDispositivo(body);
    const message = body.id
      ? "Dispositivo atualizado com sucesso!"
      : "Dispositivo adicionado com sucesso!";
    res.json({ message });
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    console.error("Erro ao salvar dispositivo:", error);
    if (error.code === "ER_DUP_ENTRY") {
      res.status(400).json({ message: "Número de série ou tag já cadastrado." });
      return;
    }
    res.status(500).json({ message: "Erro interno no servidor" });
  }
}

export async function excluirDispositivo(req: Request, res: Response): Promise<void> {
  try {
    await service.excluirDispositivo(String(req.params.id));
    res.json({ message: "Dispositivo excluído com sucesso!" });
  } catch (err) {
    console.error("Erro ao excluir dispositivo:", err);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
}
