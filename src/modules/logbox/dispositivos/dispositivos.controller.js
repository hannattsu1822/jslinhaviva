const service = require("./dispositivos.service");

async function renderizarPaginaGerenciamento(req, res) {
  try {
    const devices = await service.listarDispositivosParaGerenciamento();
    res.render("pages/logbox/gerenciar-dispositivos.html", {
      pageTitle: "Gerenciar Dispositivos LogBox",
      user: req.user,
      devices: devices,
    });
  } catch (err) {
    console.error("Erro ao buscar dispositivos:", err);
    res.status(500).send("Erro interno ao buscar dispositivos.");
  }
}

async function renderizarPaginaLista(req, res) {
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

async function listarDispositivosApi(req, res) {
  try {
    const devices = await service.listarDispositivosAtivos();
    res.json(devices);
  } catch (err) {
    console.error("Erro ao buscar dispositivos:", err);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
}

async function obterDispositivoPorId(req, res) {
  try {
    const device = await service.obterDispositivoPorId(req.params.id);
    res.json(device);
  } catch (err) {
    console.error("Erro ao buscar dispositivo:", err);
    const statusCode = err.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function salvarDispositivo(req, res) {
  try {
    await service.salvarDispositivo(req.body);
    const message = req.body.id
      ? "Dispositivo atualizado com sucesso!"
      : "Dispositivo adicionado com sucesso!";
    res.json({ message });
  } catch (err) {
    console.error("Erro ao salvar dispositivo:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(400)
        .json({ message: "Número de série ou tag já cadastrado." });
    }
    res.status(500).json({ message: "Erro interno no servidor" });
  }
}

async function excluirDispositivo(req, res) {
  try {
    await service.excluirDispositivo(req.params.id);
    res.json({ message: "Dispositivo excluído com sucesso!" });
  } catch (err) {
    console.error("Erro ao excluir dispositivo:", err);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
}

module.exports = {
  renderizarPaginaGerenciamento,
  renderizarPaginaLista,
  listarDispositivosApi,
  obterDispositivoPorId,
  salvarDispositivo,
  excluirDispositivo,
};
