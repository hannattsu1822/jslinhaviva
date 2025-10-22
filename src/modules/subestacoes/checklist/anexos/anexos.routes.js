const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../../auth");
const { upload } = require("../../../../init");
const controller = require("./anexos.controller");
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

router.post(
  "/api/inspecoes/upload-temporario",
  autenticar,
  verificarNivel(3),
  upload.single("anexo"),
  controller.uploadTemporario
);
router.post(
  "/inspecoes-subestacoes/:inspecaoId/anexos-escritorio",
  autenticar,
  verificarNivel(3),
  verificarInspecaoExiste,
  controller.anexarEscritorio
);
router.post(
  "/inspecoes-subestacoes/:inspecaoId/item/:itemChecklistId/anexos-termografia",
  autenticar,
  verificarNivel(3),
  verificarInspecaoExiste,
  controller.anexarTermografia
);
router.post(
  "/inspecoes-subestacoes/:inspecaoId/anexar-apr",
  autenticar,
  verificarNivel(3),
  verificarInspecaoExiste,
  upload.array("anexosAPR", 5),
  controller.anexarAPR
);
router.delete(
  "/inspecoes-subestacoes/anexos/:anexoId",
  autenticar,
  verificarNivel(3),
  controller.excluirAnexo
);

module.exports = router;
