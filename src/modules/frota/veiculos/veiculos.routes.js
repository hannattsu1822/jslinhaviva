const express = require("express");
const path = require("path");
const router = express.Router();
const { autenticar, verificarNivel, verificarNivelOuCargo } = require("../../../auth");
const controller = require("./veiculos.controller");
const {
  NIVEL_ADMIN,
  ehCargoConstrucaoAcompanhamento,
} = require("../../../shared/moduloNivel.permissions");
const { projectRootDir, publicDir, publicPage, viewsDir, viewsPage } = require("../../../shared/path.helper");

function usuarioConstrucaoRestrito(user) {
  return (user?.nivel ?? 0) < NIVEL_ADMIN && ehCargoConstrucaoAcompanhamento(user);
}

function redirecionarConstrucaoRestrito(req, res, next) {
  if (usuarioConstrucaoRestrito(req.user)) {
    return res.redirect("/acompanhamento_construcao");
  }
  next();
}

function bloquearConstrucaoRestritoApi(req, res, next) {
  if (usuarioConstrucaoRestrito(req.user)) {
    return res.status(403).json({
      message: "Perfil de Construção: acesso permitido apenas ao acompanhamento de construção.",
    });
  }
  next();
}

router.get("/frota", autenticar, verificarNivel(2), redirecionarConstrucaoRestrito, (req, res) => {
  res.sendFile(publicPage("frota/frota.html"));
});

router.get("/checklist_veiculos", autenticar, verificarNivel(3), redirecionarConstrucaoRestrito, (req, res) => {
  res.sendFile(
    publicPage("frota/checklist_veiculos.html")
  );
});

router.get("/agendar_checklist", autenticar, verificarNivel(4), redirecionarConstrucaoRestrito, (req, res) => {
  res.sendFile(
    publicPage("frota/agendar_checklist.html")
  );
});

router.get("/frota_controle", autenticar, verificarNivelOuCargo(2, ["transporte", "direcao", "direção"]), redirecionarConstrucaoRestrito, (req, res) => {
  res.sendFile(
    publicPage("frota/frota_controle.html")
  );
});

router.get(
  "/frota_motoristas_cadastro",
  autenticar,
  verificarNivelOuCargo(2, ["transporte", "direcao", "direção"]),
  redirecionarConstrucaoRestrito,
  (req, res) => {
    res.sendFile(
      publicPage("frota/frota_motoristas_cadastro.html")
    );
  }
);

router.get(
  "/frota_estoque_cadastro",
  autenticar,
  verificarNivelOuCargo(2, ["transporte", "direcao", "direção"]),
  redirecionarConstrucaoRestrito,
  (req, res) => {
    res.sendFile(
      publicPage("frota/frota_estoque_cadastro.html")
    );
  }
);

router.get(
  "/frota_veiculos_cadastro",
  autenticar,
  verificarNivelOuCargo(2, ["transporte", "direcao", "direção"]),
  redirecionarConstrucaoRestrito,
  (req, res) => {
    res.sendFile(
      publicPage("frota/frota_veiculos_cadastro.html")
    );
  }
);

router.get("/filtrar_veiculos", autenticar, verificarNivel(4), redirecionarConstrucaoRestrito, (req, res) => {
  res.sendFile(
    publicPage("frota/filtrar_veiculos.html")
  );
});

router.get("/relatorio_publico_veiculos", (req, res) => {
  res.sendFile(
    publicPage("frota/relatorio_veiculos.html")
  );
});

router.get("/check_horimetro", autenticar, verificarNivel(3), redirecionarConstrucaoRestrito, (req, res) => {
  res.sendFile(
    publicPage("frota/check_horimetro.html")
  );
});

router.get("/editar_inspecao", autenticar, verificarNivel(4), redirecionarConstrucaoRestrito, (req, res) => {
  res.sendFile(
    publicPage("frota/editar_inspecao.html")
  );
});

router.get(
  "/api/motoristas",
  autenticar,
  verificarNivel(2),
  bloquearConstrucaoRestritoApi,
  controller.listarMotoristas
);
router.get(
  "/api/encarregados",
  autenticar,
  verificarNivel(2),
  bloquearConstrucaoRestritoApi,
  controller.listarEncarregados
);
router.get(
  "/api/placas",
  autenticar,
  verificarNivel(2),
  bloquearConstrucaoRestritoApi,
  controller.listarPlacas
);
router.get(
  "/api/veiculos_controle",
  autenticar,
  verificarNivelOuCargo(2, ["transporte", "direcao", "direção"]),
  bloquearConstrucaoRestritoApi,
  controller.listarVeiculosControle
);
router.get(
  "/api/frota_inventario",
  autenticar,
  verificarNivelOuCargo(2, ["transporte", "direcao", "direção"]),
  bloquearConstrucaoRestritoApi,
  controller.listarInventario
);
router.post(
  "/api/frota_inventario",
  autenticar,
  verificarNivel(2),
  bloquearConstrucaoRestritoApi,
  controller.criarItemInventario
);
router.delete(
  "/api/frota_inventario/:id",
  autenticar,
  verificarNivel(2),
  bloquearConstrucaoRestritoApi,
  controller.deletarItemInventario
);
router.get(
  "/api/frota/motoristas_crud",
  autenticar,
  verificarNivelOuCargo(2, ["transporte", "direcao", "direção"]),
  bloquearConstrucaoRestritoApi,
  controller.listarMotoristasCrud
);
router.post(
  "/api/frota/motoristas_crud",
  autenticar,
  verificarNivel(2),
  bloquearConstrucaoRestritoApi,
  controller.criarMotoristaCrud
);
router.delete(
  "/api/frota/motoristas_crud/:id",
  autenticar,
  verificarNivel(2),
  bloquearConstrucaoRestritoApi,
  controller.deletarMotoristaCrud
);
router.get(
  "/api/frota/estoque_crud",
  autenticar,
  verificarNivelOuCargo(2, ["transporte", "direcao", "direção"]),
  bloquearConstrucaoRestritoApi,
  controller.listarEstoqueCrud
);
router.post(
  "/api/frota/estoque_crud",
  autenticar,
  verificarNivel(2),
  bloquearConstrucaoRestritoApi,
  controller.criarItemEstoqueCrud
);
router.delete(
  "/api/frota/estoque_crud/:id",
  autenticar,
  verificarNivel(2),
  bloquearConstrucaoRestritoApi,
  controller.deletarItemEstoqueCrud
);

module.exports = router;
