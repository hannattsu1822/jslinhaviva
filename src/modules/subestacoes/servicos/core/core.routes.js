const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../../auth");
const { promisePool } = require("../../../../infrastructure/database");
const { upload } = require("../../../../infrastructure/uploads");
const {
  NIVEL_ADMIN,
  NIVEL_ACESSO_MIN,
} = require("../../subestacoes.permissions");
const controller = require("./core.controller");

async function verificarServicoExiste(req, res, next) {
  const { servicoId } = req.params;
  if (isNaN(parseInt(servicoId, 10))) {
    return res
      .status(400)
      .json({ message: `ID do serviço inválido: ${servicoId}` });
  }
  try {
    const [servicoRows] = await promisePool.query(
      "SELECT id, status, data_conclusao, observacoes_conclusao, processo FROM servicos_subestacoes WHERE id = ?",
      [servicoId]
    );
    if (servicoRows.length === 0) {
      return res
        .status(404)
        .json({ message: `Serviço com ID ${servicoId} não encontrado.` });
    }
    req.servico = servicoRows[0];
    next();
  } catch (error) {
    res.status(500).json({ message: "Erro interno ao verificar serviço." });
  }
}

router.get(
  "/usuarios-responsaveis-para-servicos",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  controller.listarUsuariosResponsaveis
);
router.get(
  "/usuarios-encarregados-e-inspetores",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  controller.listarEncarregadosInspetores
);
router.get(
  "/api/catalogo-defeitos-servicos",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.listarCatalogoDefeitos
);
router.post(
  "/api/servicos-subestacoes",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  upload.any(),
  controller.criarServico
);
router.get(
  "/api/servicos-subestacoes",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.listarServicos
);
router.get(
  "/api/servicos-subestacoes/:servicoId",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.obterServicoPorId
);

router.put(
  "/api/servicos-subestacoes/:servicoId",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  verificarServicoExiste,
  upload.any(),
  controller.atualizarServico
);

router.put(
  "/api/servicos-subestacoes/:servicoId/reabrir",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  verificarServicoExiste,
  controller.reabrirServico
);
router.delete(
  "/api/servicos-subestacoes/:servicoId",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  controller.excluirServico
);

module.exports = router;
