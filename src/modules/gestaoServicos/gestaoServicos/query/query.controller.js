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

module.exports = {
  contarServicos,
  listarEncarregados,
  listarSubestacoes,
};
