// CORREÇÃO AQUI: Adicionei a subpasta /dispositivos/ no caminho
const logboxService = require("../logbox/dispositivos/dispositivos.service");
const relesService = require("../reles/reles.service");

async function renderizarPainelNOC(req, res) {
  try {
    // Busca todos os dispositivos ativos em paralelo
    const [logboxes, reles] = await Promise.all([
      logboxService.listarDispositivosAtivos(),
      relesService.listarReles()
    ]);

    // Filtra apenas os relés ativos
    const relesAtivos = reles.filter(r => r.ativo);

    res.render("pages/noc/painel_operacoes.html", {
      pageTitle: "Centro de Operações - Monitoramento Unificado",
      user: req.user,
      logboxes: logboxes,
      reles: relesAtivos,
      layout: false // NOC não usa o layout padrão com menu lateral
    });
  } catch (err) {
    console.error("Erro ao carregar NOC:", err);
    res.status(500).send("Erro ao carregar painel de operações.");
  }
}

module.exports = {
  renderizarPainelNOC
};
