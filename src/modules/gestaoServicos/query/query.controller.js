const service = require("./query.service");

async function contarServicos(req, res) {
  try {
    const { status } = req.query;
    const total = await service.contarServicos(status);
    res.json(total);
  } catch (error) {
    console.error("Erro ao contar serviços:", error);
    res.status(500).json({ message: "Erro ao contar serviços" });
  }
}

async function listarEncarregados(req, res) {
  try {
    const encarregados = await service.listarEncarregados();
    res.status(200).json(encarregados);
  } catch (err) {
    console.error("Erro ao buscar encarregados:", err);
    res.status(500).json({ message: "Erro ao buscar encarregados!" });
  }
}

async function listarSubestacoes(req, res) {
  try {
    const subestacoes = await service.listarSubestacoes();
    res.status(200).json(subestacoes);
  } catch (err) {
    console.error("Erro ao buscar subestações:", err);
    res.status(500).json({ message: "Erro ao buscar subestações!" });
  }
}

async function listarServicosPorOrigem(req, res) {
  try {
    const { origem } = req.params;
    if (!origem) {
      return res
        .status(400)
        .json({ success: false, message: "Parâmetro 'origem' é obrigatório." });
    }

    // A verificação de permissão foi removida daqui e movida para o arquivo de rotas.
    const servicos = await service.listarServicosPorOrigem(origem);
    res.status(200).json(servicos);
  } catch (error) {
    console.error(
      `Erro ao buscar serviços pela origem '${req.params.origem}':`,
      error
    );
    res.status(500).json({
      success: false,
      message: "Erro ao buscar serviços por origem.",
    });
  }
}

module.exports = {
  contarServicos,
  listarEncarregados,
  listarSubestacoes,
  listarServicosPorOrigem,
};
