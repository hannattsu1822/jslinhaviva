const service = require("./reles.service");
const { registrarAuditoria } = require("../../auth");

async function listarReles(req, res) {
  try {
    const reles = await service.listarReles();
    res.json(reles);
  } catch (err) {
    console.error("Erro ao buscar relés:", err);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
}

async function obterRelePorId(req, res) {
  try {
    const rele = await service.obterRelePorId(req.params.id);
    res.json(rele);
  } catch (err) {
    console.error("Erro ao buscar relé:", err);
    const statusCode = err.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function criarRele(req, res) {
  try {
    const { id } = await service.criarRele(req.body);
    await registrarAuditoria(
      req.user.matricula,
      "CRIACAO_RELE",
      `Relé ID ${id} (${req.body.nome_rele}) criado.`
    );
    res.status(201).json({ id, ...req.body });
  } catch (err) {
    console.error("Erro ao criar relé:", err);
    if (err.code === "ER_DUP_ENTRY") {
      const message = err.message.includes("listen_port")
        ? "Já existe um relé utilizando essa 'listen_port'."
        : "Já existe um relé com essa 'local_tag'.";
      return res.status(409).json({ message });
    }
    const statusCode = err.message.includes("obrigatórios") ? 400 : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function atualizarRele(req, res) {
  try {
    await service.atualizarRele(req.params.id, req.body);
    await registrarAuditoria(
      req.user.matricula,
      "ATUALIZACAO_RELE",
      `Relé ID ${req.params.id} (${req.body.nome_rele}) atualizado.`
    );
    res.json({ message: "Relé atualizado com sucesso" });
  } catch (err) {
    console.error("Erro ao atualizar relé:", err);
    if (err.code === "ER_DUP_ENTRY") {
      const message = err.message.includes("listen_port")
        ? "Já existe um relé utilizando essa 'listen_port'."
        : "Já existe um relé com essa 'local_tag'.";
      return res.status(409).json({ message });
    }
    const statusCode = err.message.includes("obrigatórios")
      ? 400
      : err.message.includes("não encontrado")
      ? 404
      : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function deletarRele(req, res) {
  try {
    const { nomeRele } = await service.deletarRele(req.params.id);
    await registrarAuditoria(
      req.user.matricula,
      "DELECAO_RELE",
      `Relé ID ${req.params.id} (${nomeRele}) deletado.`
    );
    res.status(200).json({ message: "Relé deletado com sucesso" });
  } catch (err) {
    console.error("Erro ao deletar relé:", err);
    const statusCode = err.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function obterLeituras(req, res) {
  try {
    const limit = req.query.limit || 100;
    const leituras = await service.obterLeituras(req.params.id, limit);
    res.json(leituras);
  } catch (error) {
    console.error("Erro ao buscar leituras do relé:", error);
    res.status(500).json({ error: "Erro ao buscar dados" });
  }
}

async function renderizarPaginaDetalhe(req, res) {
  try {
    const { id } = req.params;
    const { rele, ultimaLeitura } = await service.obterDadosPaginaDetalhe(id);
    const pageData = {
      pageTitle: `Monitorando: ${rele.nome_rele || rele.local_tag}`,
      user: req.user,
      releId: id,
      releNome: rele.nome_rele || rele.local_tag,
      ultimaLeitura: ultimaLeitura,
    };
    res.render("pages/rele/visualizar_rele_detalhe.html", pageData);
  } catch (err) {
    console.error("Erro ao carregar página de detalhes do relé:", err);
    const statusCode = err.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).send(err.message);
  }
}

module.exports = {
  listarReles,
  obterRelePorId,
  criarRele,
  atualizarRele,
  deletarRele,
  obterLeituras,
  renderizarPaginaDetalhe,
};
