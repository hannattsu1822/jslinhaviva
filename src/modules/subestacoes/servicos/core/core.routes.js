const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../../auth");
const { upload } = require("../../../../init");
const controller = require("./core.controller");

async function verificarServicoExiste(req, res, next) {
  const { servicoId } = req.params;
  if (isNaN(parseInt(servicoId, 10))) {
    return res
      .status(400)
      .json({ message: `ID do serviço inválido: ${servicoId}` });
  }
  try {
    const { promisePool } = require("../../../../init");
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
  verificarNivel(3),
  controller.listarUsuariosResponsaveis
);
router.get(
  "/usuarios-encarregados-e-inspetores",
  autenticar,
  verificarNivel(3),
  controller.listarEncarregadosInspetores
);
router.get(
  "/api/catalogo-defeitos-servicos",
  autenticar,
  verificarNivel(3),
  controller.listarCatalogoDefeitos
);
router.post(
  "/api/servicos-subestacoes",
  autenticar,
  verificarNivel(3),
  upload.any(),
  controller.criarServico
);
router.get(
  "/api/servicos-subestacoes",
  autenticar,
  verificarNivel(3),
  controller.listarServicos
);
router.get(
  "/api/servicos-subestacoes/:servicoId",
  autenticar,
  verificarNivel(3),
  controller.obterServicoPorId
);
router.put(
  "/api/servicos-subestacoes/:servicoId/reabrir",
  autenticar,
  verificarNivel(3),
  verificarServicoExiste,
  controller.reabrirServico
);
router.put(
  "/api/servicos-subestacoes/:servicoId/atualizar-encarregados-itens",
  autenticar,
  verificarNivel(3),
  verificarServicoExiste,
  controller.atualizarEncarregadosItens
);
router.put(
  "/api/servicos-subestacoes/item/:itemEscopoId/concluir",
  autenticar,
  verificarNivel(3),
  upload.any(),
  controller.concluirItemServico
);
router.delete(
  "/api/servicos-subestacoes/:servicoId",
  autenticar,
  verificarNivel(3),
  controller.excluirServico
);

module.exports = router;
