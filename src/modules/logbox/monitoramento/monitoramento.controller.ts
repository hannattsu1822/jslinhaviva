import type { Request, Response } from "express";
import { promisePool } from "../../../infrastructure/database";
import * as service from "./monitoramento.service";
import type { ReportFilters } from "../types";

export async function renderizarPaginaDetalhe(req: Request, res: Response): Promise<void> {
  try {
    const serialNumber = String(req.params.serialNumber);
    const [deviceRows] = (await promisePool.query(
      "SELECT * FROM dispositivos_logbox WHERE serial_number = ?",
      [serialNumber]
    )) as [Record<string, unknown>[], unknown];

    if (deviceRows.length === 0) {
      res.status(404).send("Dispositivo não encontrado");
      return;
    }

    res.render("pages/logbox/device-detail.html", {
      pageTitle: `Monitorando: ${deviceRows[0].local_tag}`,
      user: req.user,
      serialNumber: deviceRows[0].serial_number,
      device: deviceRows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao carregar a página do dispositivo");
  }
}

export async function renderizarPaginaRelatorios(req: Request, res: Response): Promise<void> {
  try {
    const [devices] = (await promisePool.query(
      "SELECT id, local_tag, serial_number FROM dispositivos_logbox WHERE ativo = 1 ORDER BY local_tag"
    )) as [Record<string, unknown>[], unknown];

    res.render("pages/logbox/relatorios.html", {
      pageTitle: "Relatórios LogBox",
      user: req.user,
      devices,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao carregar a página de relatórios");
  }
}

export async function obterLeituras(req: Request, res: Response): Promise<void> {
  try {
    const data = await service.obterLeituras(String(req.params.serialNumber));
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
}

export async function obterStatus(req: Request, res: Response): Promise<void> {
  try {
    const status = await service.obterStatus(String(req.params.serialNumber));
    res.json({ status });
  } catch (err) {
    const error = err as Error;
    console.error(err);
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

export async function obterUltimaLeitura(req: Request, res: Response): Promise<void> {
  try {
    const latest = await service.obterUltimaLeitura(String(req.params.serialNumber));
    res.json(latest);
  } catch (error) {
    const err = error as Error;
    console.error(error);
    const statusCode = err.message.includes("Nenhuma leitura encontrada") ? 404 : 500;
    res.status(statusCode).send(err.message);
  }
}

export async function obterEstatisticas(req: Request, res: Response): Promise<void> {
  try {
    const stats = await service.obterEstatisticas(String(req.params.serialNumber));
    res.json(stats);
  } catch (error) {
    console.error("Erro ao buscar estatísticas detalhadas:", error);
    res.status(500).json({ message: "Erro ao buscar estatísticas detalhadas" });
  }
}

export async function obterEstatisticasVentilacao(req: Request, res: Response): Promise<void> {
  try {
    const stats = await service.obterEstatisticasVentilacao(String(req.params.serialNumber));
    res.json(stats);
  } catch (error) {
    console.error("Erro ao buscar estatísticas de ventilação:", error);
    res.status(500).json({ message: "Erro ao buscar estatísticas de ventilação" });
  }
}

export async function obterHistoricoVentilacao(req: Request, res: Response): Promise<void> {
  try {
    const history = await service.obterHistoricoVentilacao(String(req.params.serialNumber));
    res.json(history);
  } catch (error) {
    console.error("ERRO DETALHADO ao buscar histórico de ventilação:", error);
    res.status(500).json({ message: "Erro interno ao buscar o histórico de ventilação." });
  }
}

export async function obterHistoricoConexao(req: Request, res: Response): Promise<void> {
  try {
    const data = await service.obterHistoricoConexao(String(req.params.serialNumber));
    res.json(data);
  } catch (error) {
    console.error("Erro ao carregar histórico de conexão:", error);
    res.status(500).send("Server error");
  }
}

export async function gerarRelatorioVisual(req: Request, res: Response): Promise<void> {
  try {
    const data = await service.getReportData(req.body as ReportFilters);
    res.json(data);
  } catch (err) {
    console.error("Erro ao gerar relatório visual:", err);
    res.status(500).json({ message: "Erro ao gerar dados do relatório" });
  }
}

export async function gerarPdfRelatorio(req: Request, res: Response): Promise<void> {
  try {
    const pdfBytes = await service.gerarPdfRelatorio(req.body as ReportFilters);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=relatorio.pdf");
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error("Erro ao gerar PDF com pdf-lib:", err);
    res.status(500).json({ message: "Erro ao gerar PDF" });
  }
}
