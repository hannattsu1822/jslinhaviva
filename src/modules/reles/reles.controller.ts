import type { Request, Response } from "express";
import { registrarAuditoria } from "../../auth";
import * as service from "./reles.service";
import type { SaveReleInput } from "./types";

export async function listarReles(_req: Request, res: Response): Promise<void> {
  try {
    const reles = await service.listarReles();
    res.json(reles);
  } catch (err) {
    console.error("Erro ao buscar relés:", err);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
}

export async function obterRelePorId(req: Request, res: Response): Promise<void> {
  try {
    const rele = await service.obterRelePorId(String(req.params.id));
    res.json(rele);
  } catch (err) {
    const error = err as Error;
    console.error("Erro ao buscar relé:", error);
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

export async function criarRele(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as SaveReleInput;
    const { id } = await service.criarRele(body);
    await registrarAuditoria(
      req.user!.matricula,
      "CRIACAO_RELE",
      `Relé ID ${id} (${body.nome_rele}) criado.`
    );
    res.status(201).json({ id, ...body });
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    console.error("Erro ao criar relé:", error);
    if (error.code === "ER_DUP_ENTRY") {
      const message = error.message.includes("listen_port")
        ? "Já existe um relé utilizando essa 'listen_port'."
        : "Já existe um relé com essa 'local_tag'.";
      res.status(409).json({ message });
      return;
    }
    const statusCode = error.message.includes("obrigatórios") ? 400 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

export async function atualizarRele(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as SaveReleInput;
    const id = String(req.params.id);
    await service.atualizarRele(id, body);
    await registrarAuditoria(
      req.user!.matricula,
      "ATUALIZACAO_RELE",
      `Relé ID ${id} (${body.nome_rele}) atualizado.`
    );
    res.json({ message: "Relé atualizado com sucesso" });
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    console.error("Erro ao atualizar relé:", error);
    if (error.code === "ER_DUP_ENTRY") {
      const message = error.message.includes("listen_port")
        ? "Já existe um relé utilizando essa 'listen_port'."
        : "Já existe um relé com essa 'local_tag'.";
      res.status(409).json({ message });
      return;
    }
    const statusCode = error.message.includes("obrigatórios")
      ? 400
      : error.message.includes("não encontrado")
        ? 404
        : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

export async function deletarRele(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const { nomeRele } = await service.deletarRele(id);
    await registrarAuditoria(
      req.user!.matricula,
      "DELECAO_RELE",
      `Relé ID ${id} (${nomeRele}) deletado.`
    );
    res.status(200).json({ message: "Relé deletado com sucesso" });
  } catch (err) {
    const error = err as Error;
    console.error("Erro ao deletar relé:", error);
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

export async function obterLeituras(req: Request, res: Response): Promise<void> {
  try {
    const limit = (req.query.limit as string | undefined) || "100";
    const leituras = await service.obterLeituras(String(req.params.id), limit);
    res.json(leituras);
  } catch (error) {
    console.error("Erro ao buscar leituras do relé:", error);
    res.status(500).json({ error: "Erro ao buscar dados" });
  }
}

export async function renderizarPaginaDetalhe(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const { rele, ultimaLeitura } = await service.obterDadosPaginaDetalhe(id);
    res.render("pages/rele/visualizar_rele_detalhe.html", {
      pageTitle: `Monitorando: ${rele.nome_rele || rele.local_tag}`,
      user: req.user,
      releId: id,
      releNome: rele.nome_rele || rele.local_tag,
      ultimaLeitura,
    });
  } catch (err) {
    const error = err as Error;
    console.error("Erro ao carregar página de detalhes do relé:", error);
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).send(error.message);
  }
}
