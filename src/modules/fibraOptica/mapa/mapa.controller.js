const service = require("./mapa.service");
const { registrarAuditoria } = require("../../../auth");

async function carregarPaginaMapa(req, res) {
  try {
    const ultimosPontos = await service.obterUltimosPontos();
    res.render("pages/fibra_optica/mapa_fibra.html", {
      user: req.session.user,
      ultimosPontos: ultimosPontos,
    });
  } catch (error) {
    console.error("Erro ao carregar a página do mapa de fibra:", error);
    res.status(500).send("Erro ao carregar a página do mapa.");
  }
}

async function obterTodosOsPontos(req, res) {
  try {
    const pontos = await service.obterTodosOsPontos();
    res.json(pontos);
  } catch (error) {
    console.error("Erro ao buscar todos os pontos de fibra:", error);
    res.status(500).json({ message: "Erro interno ao buscar os pontos." });
  }
}

async function salvarPontos(req, res) {
  try {
    const { connection } = await service.salvarPontos(
      req.body.pontos,
      req.session.user.matricula
    );
    await registrarAuditoria(
      req.session.user.matricula,
      "COLETA_PONTOS_MAPA_FIBRA",
      `${req.body.pontos.length} ponto(s) de mapa de fibra foram registrados.`,
      connection
    );
    res.status(201).json({ message: "Pontos salvos com sucesso!" });
  } catch (error) {
    const statusCode = error.message.includes("Nenhum ponto") ? 400 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function carregarPaginaEdicao(req, res) {
  try {
    const ponto = await service.obterPontoPorId(req.params.id);
    res.render("pages/fibra_optica/editar_ponto_fibra.html", {
      user: req.session.user,
      ponto: ponto,
    });
  } catch (error) {
    console.error("Erro ao carregar página de edição de ponto:", error);
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).send(error.message);
  }
}

async function editarPonto(req, res) {
  try {
    await service.editarPonto(req.params.id, req.body);
    await registrarAuditoria(
      req.session.user.matricula,
      "EDICAO_PONTO_MAPA_FIBRA",
      `Ponto de mapa ID ${req.params.id} foi atualizado.`
    );
    res.status(200).json({ message: "Ponto atualizado com sucesso!" });
  } catch (error) {
    console.error("Erro ao atualizar o ponto de mapa:", error);
    const statusCode =
      error.message.includes("obrigatórios") || error.message.includes("UTM")
        ? 400
        : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function excluirPonto(req, res) {
  try {
    await service.excluirPonto(req.params.id);
    await registrarAuditoria(
      req.session.user.matricula,
      "EXCLUSAO_PONTO_MAPA_FIBRA",
      `Ponto de mapa ID ${req.params.id} foi excluído.`
    );
    res.status(200).json({ message: "Ponto excluído com sucesso!" });
  } catch (error) {
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

module.exports = {
  carregarPaginaMapa,
  obterTodosOsPontos,
  salvarPontos,
  carregarPaginaEdicao,
  editarPonto,
  excluirPonto,
};
