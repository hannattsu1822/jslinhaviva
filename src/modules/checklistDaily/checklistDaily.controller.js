const path = require("path");
const checklistService = require("./checklistDaily.service");

async function renderizarPagina(req, res) {
  // Página do motorista continua no public/pages/into
  res.sendFile(
    path.join(__dirname, "../../../public/pages/into/checklist_diario.html")
  );
}

async function renderizarPaginaGestao(req, res) {
  // ATUALIZADO: Agora aponta para views/pages/gestor/checklist_gestao.html
  res.sendFile(
    path.join(__dirname, "../../../views/pages/gestor/checklist_gestao.html")
  );
}

async function verificarStatus(req, res) {
  try {
    const matricula = req.user.matricula;
    const status = await checklistService.verificarStatusDiario(matricula);
    res.status(200).json(status);
  } catch (error) {
    console.error("Erro ao verificar status do checklist:", error);
    res.status(500).json({ message: "Erro interno ao verificar checklist." });
  }
}

async function salvarChecklist(req, res) {
  try {
    const matricula = req.user.matricula;
    const dados = req.body;
    const arquivos = req.files;

    if (!dados.placa || !dados.km) {
      return res.status(400).json({ message: "Dados obrigatórios faltando." });
    }

    const resultado = await checklistService.processarNovoChecklist(
      matricula,
      dados,
      arquivos
    );

    res.status(201).json({
      message: "Checklist salvo com sucesso!",
      data: resultado,
    });
  } catch (error) {
    console.error("Erro ao salvar checklist:", error);
    res.status(500).json({ message: "Erro ao salvar o checklist." });
  }
}

// --- GESTÃO ---

async function listarGestaoAPI(req, res) {
  try {
    const filtros = {
      dataInicio: req.query.dataInicio,
      dataFim: req.query.dataFim,
      placa: req.query.placa,
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
  verificarStatus,
  salvarChecklist,
  listarGestaoAPI,
  detalhesGestaoAPI,
  excluirChecklistAPI,
};
