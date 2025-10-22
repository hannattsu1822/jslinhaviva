const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../../auth");
const controller = require("./core.controller");
const { promisePool } = require("../../../../init");

async function verificarInspecaoExiste(req, res, next) {
  const idParaVerificar = req.params.inspecaoId || req.params.id;
  if (isNaN(parseInt(idParaVerificar, 10)))
    return res
      .status(400)
      .json({ message: `ID da inspeção inválido: ${idParaVerificar}` });
  try {
    const [inspecao] = await promisePool.query(
      "SELECT id, formulario_inspecao_num FROM inspecoes_subestacoes WHERE id = ?",
      [idParaVerificar]
    );
    if (inspecao.length === 0)
      return res
        .status(404)
        .json({
          message: `Inspeção com ID ${idParaVerificar} não encontrada.`,
        });
    req.inspecao = inspecao[0];
    req.inspecaoId = parseInt(idParaVerificar, 10);
    next();
  } catch (error) {
    res.status(500).json({ message: "Erro interno ao verificar inspeção." });
  }
}

router.get(
  "/api/checklist/modelo/padrao",
  autenticar,
  verificarNivel(3),
  controller.obterModeloPadrao
);
router.post(
  "/inspecoes-subestacoes",
  autenticar,
  verificarNivel(3),
  controller.criarInspecao
);
router.put(
  "/inspecoes-subestacoes/:id",
  autenticar,
  verificarNivel(3),
  verificarInspecaoExiste,
  controller.atualizarInspecao
);
router.get(
  "/inspecoes-subestacoes",
  autenticar,
  verificarNivel(3),
  controller.listarInspecoes
);
router.get(
  "/inspecoes-subestacoes/:id",
  autenticar,
  verificarNivel(3),
  controller.obterInspecaoCompleta
);
router.put(
  "/inspecoes-subestacoes/:inspecaoId/concluir",
  autenticar,
  verificarNivel(3),
  verificarInspecaoExiste,
  controller.concluirInspecao
);
router.put(
  "/inspecoes-subestacoes/:inspecaoId/reabrir",
  autenticar,
  verificarNivel(3),
  verificarInspecaoExiste,
  controller.reabrirInspecao
);
router.delete(
  "/inspecoes-subestacoes/:inspecaoId",
  autenticar,
  verificarNivel(3),
  verificarInspecaoExiste,
  controller.deletarInspecao
);

module.exports = router;
