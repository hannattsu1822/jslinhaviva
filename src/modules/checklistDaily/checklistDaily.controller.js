const path = require("path");

const checklistService = require("./checklistDaily.service");

function getMatriculaFromRequest(req) {
  if (req && req.user && req.user.matricula) return req.user.matricula;
  if (req && req.session && req.session.user && req.session.user.matricula) {
    return req.session.user.matricula;
  }
  return null;
}

function parsePositiveInt(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

async function renderizarPagina(req, res) {
  res.sendFile(
    path.join(__dirname, "../../../public/pages/into/checklist_diario.html")
  );
}

async function renderizarPaginaGestao(req, res) {
  res.sendFile(
    path.join(__dirname, "../../../views/pages/gestor/checklist_gestao.html")
  );
}

async function listarVeiculosAPI(req, res) {
  try {
    const veiculos = await checklistService.listarVeiculosAtivos();
    res.json(veiculos);
  } catch (error) {
    console.error("Erro ao listar veículos do checklist:", error);
    res.status(500).json({ message: "Erro interno ao buscar veículos." });
  }
}

async function verificarStatus(req, res) {
  try {
    const veiculoIdRaw =
      req.query.veiculoId || req.query.veiculo_id || req.query.veiculo;

    const placaRaw = (req.query.placa || "").toString().trim();

    if (!veiculoIdRaw && !placaRaw) {
      return res.status(400).json({
        message: "Veículo obrigatório para verificar o checklist diário.",
      });
    }

    if (veiculoIdRaw) {
      const veiculoId = parsePositiveInt(veiculoIdRaw);
      if (!veiculoId) {
        return res.status(400).json({ message: "ID do veículo inválido." });
      }

      const status = await checklistService.verificarStatusDiarioPorVeiculoId(
        veiculoId
      );
      return res.status(200).json(status);
    }

    const status = await checklistService.verificarStatusDiario(placaRaw);
    return res.status(200).json(status);
  } catch (error) {
    console.error("Erro ao verificar status do checklist:", error);
    res.status(500).json({ message: "Erro interno ao verificar checklist." });
  }
}

async function salvarChecklist(req, res) {
  try {
    const matricula = getMatriculaFromRequest(req);
    const dados = req.body || {};
    const arquivos = req.files;

    const veiculoIdRaw = dados.veiculo_id || dados.veiculoId || dados.veiculo;
    const placaRaw = dados.placa;

    if ((!veiculoIdRaw && !placaRaw) || !dados.km) {
      return res.status(400).json({ message: "Dados obrigatórios faltando." });
    }

    if (!matricula) {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }

    let resultado;

    if (veiculoIdRaw) {
      const veiculoId = parsePositiveInt(veiculoIdRaw);
      if (!veiculoId) {
        return res.status(400).json({ message: "ID do veículo inválido." });
      }

      resultado = await checklistService.processarNovoChecklistPorVeiculoId(
        matricula,
        veiculoId,
        dados,
        arquivos
      );
    } else {
      resultado = await checklistService.processarNovoChecklist(
        matricula,
        dados,
        arquivos
      );
    }

    res.status(201).json({
      message: "Checklist salvo com sucesso!",
      data: resultado,
    });
  } catch (error) {
    console.error("Erro ao salvar checklist:", error);

    const msg = (error && error.message) || "";
    const lower = msg.toLowerCase();
    const isDuplicidade =
      lower.includes("já existe checklist") ||
      lower.includes("ja existe checklist") ||
      lower.includes("duplic") ||
      lower.includes("já foi registrado") ||
      lower.includes("ja foi registrado");

    const statusCode = isDuplicidade ? 400 : 500;

    res.status(statusCode).json({
      message: msg || "Erro ao salvar o checklist.",
    });
  }
}

async function listarGestaoAPI(req, res) {
  try {
    const filtros = {
      dataInicio: req.query.dataInicio,
      dataFim: req.query.dataFim,
      placa: req.query.placa,
      veiculoId: req.query.veiculoId || req.query.veiculo_id,
    };

    const lista = await checklistService.obterListaGestao(filtros);
    res.json(lista);
  } catch (error) {
    console.error("Erro ao listar checklists:", error);
    res.status(500).json({ message: "Erro ao buscar dados." });
  }
}

async function detalhesGestaoAPI(req, res) {
  try {
    const { id } = req.params;
    const detalhes = await checklistService.obterDetalhesCompletos(id);
    res.json(detalhes);
  } catch (error) {
    console.error("Erro ao buscar detalhes:", error);
    res.status(500).json({ message: "Erro ao buscar detalhes." });
  }
}

async function excluirChecklistAPI(req, res) {
  try {
    const { id } = req.params;
    await checklistService.removerChecklist(id);
    res.json({ message: "Checklist excluído com sucesso." });
  } catch (error) {
    console.error("Erro ao excluir:", error);
    res.status(500).json({ message: "Erro ao excluir checklist." });
  }
}

module.exports = {
  renderizarPagina,
  renderizarPaginaGestao,
  listarVeiculosAPI,
  verificarStatus,
  salvarChecklist,
  listarGestaoAPI,
  detalhesGestaoAPI,
  excluirChecklistAPI,
};
