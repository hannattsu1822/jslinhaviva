const express = require("express");
const path = require("path");
const router = express.Router();
const { autenticar, verificarNivel, verificarNivelOuCargo } = require("../../../auth");
const controller = require("./veiculos.controller");
const { publicPage } = require("../../../shared/path.helper");
const {
  redirecionarConstrucaoRestrito,
  redirecionarTransporteRestrito,
  redirecionarCodRestrito,
  bloquearConstrucaoRestritoApi,
  bloquearTransporteRestritoApi,
  bloquearCodRestritoApi,
} = require("../../../shared/perfilCargo.helper");

const bloquearOutrosPerfisApi = [
  bloquearConstrucaoRestritoApi,
  bloquearTransporteRestritoApi,
  bloquearCodRestritoApi,
];

router.get("/frota", autenticar, verificarNivel(2), redirecionarConstrucaoRestrito, redirecionarTransporteRestrito, redirecionarCodRestrito, (req, res) => {
  res.sendFile(publicPage("frota/frota.html"));
});

router.get("/checklist_veiculos", autenticar, verificarNivel(3), redirecionarConstrucaoRestrito, redirecionarTransporteRestrito, redirecionarCodRestrito, (req, res) => {
  res.sendFile(
    publicPage("frota/checklist_veiculos.html")
  );
});

router.get("/agendar_checklist", autenticar, verificarNivel(4), redirecionarConstrucaoRestrito, redirecionarTransporteRestrito, redirecionarCodRestrito, (req, res) => {
  res.sendFile(
    publicPage("frota/agendar_checklist.html")
  );
});

router.get("/frota_controle", autenticar, verificarNivelOuCargo(2, ["transporte", "direcao", "direção"]), redirecionarConstrucaoRestrito, redirecionarCodRestrito, (req, res) => {
  res.sendFile(
    publicPage("frota/frota_controle.html")
  );
});

router.get(
  "/frota_motoristas_cadastro",
  autenticar,
  verificarNivelOuCargo(2, ["transporte", "direcao", "direção"]),
  redirecionarConstrucaoRestrito,
  redirecionarCodRestrito,
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
  redirecionarCodRestrito,
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
  redirecionarCodRestrito,
  (req, res) => {
    res.sendFile(
      publicPage("frota/frota_veiculos_cadastro.html")
    );
  }
);

router.get("/filtrar_veiculos", autenticar, verificarNivel(4), redirecionarConstrucaoRestrito, redirecionarTransporteRestrito, redirecionarCodRestrito, (req, res) => {
  res.sendFile(
    publicPage("frota/filtrar_veiculos.html")
  );
});

router.get("/relatorio_publico_veiculos", (req, res) => {
  res.sendFile(
    publicPage("frota/relatorio_veiculos.html")
  );
});

router.get("/check_horimetro", autenticar, verificarNivel(3), redirecionarConstrucaoRestrito, redirecionarTransporteRestrito, redirecionarCodRestrito, (req, res) => {
  res.sendFile(
    publicPage("frota/check_horimetro.html")
  );
});

router.get("/editar_inspecao", autenticar, verificarNivel(4), redirecionarConstrucaoRestrito, redirecionarTransporteRestrito, redirecionarCodRestrito, (req, res) => {
  res.sendFile(
    publicPage("frota/editar_inspecao.html")
  );
});

router.get(
  "/api/motoristas",
  autenticar,
  verificarNivel(2),
  ...bloquearOutrosPerfisApi,
  controller.listarMotoristas
);
router.get(
  "/api/encarregados",
  autenticar,
  verificarNivel(2),
  ...bloquearOutrosPerfisApi,
  controller.listarEncarregados
);
router.get(
  "/api/placas",
  autenticar,
  verificarNivel(2),
  ...bloquearOutrosPerfisApi,
  controller.listarPlacas
);
router.get(
  "/api/veiculos_controle",
  autenticar,
  verificarNivelOuCargo(2, ["transporte", "direcao", "direção"]),
  bloquearConstrucaoRestritoApi,
  bloquearCodRestritoApi,
  controller.listarVeiculosControle
);
router.get(
  "/api/frota_inventario",
  autenticar,
  verificarNivelOuCargo(2, ["transporte", "direcao", "direção"]),
  bloquearConstrucaoRestritoApi,
  bloquearCodRestritoApi,
  controller.listarInventario
);
router.post(
  "/api/frota_inventario",
  autenticar,
  verificarNivel(2),
  bloquearConstrucaoRestritoApi,
  bloquearTransporteRestritoApi,
  bloquearCodRestritoApi,
  controller.criarItemInventario
);
router.delete(
  "/api/frota_inventario/:id",
  autenticar,
  verificarNivel(2),
  bloquearConstrucaoRestritoApi,
  bloquearTransporteRestritoApi,
  bloquearCodRestritoApi,
  controller.deletarItemInventario
);
router.get(
  "/api/frota/motoristas_crud",
  autenticar,
  verificarNivelOuCargo(2, ["transporte", "direcao", "direção"]),
  bloquearConstrucaoRestritoApi,
  bloquearCodRestritoApi,
  controller.listarMotoristasCrud
);
router.post(
  "/api/frota/motoristas_crud",
  autenticar,
  verificarNivel(2),
  bloquearConstrucaoRestritoApi,
  bloquearTransporteRestritoApi,
  bloquearCodRestritoApi,
  controller.criarMotoristaCrud
);
router.delete(
  "/api/frota/motoristas_crud/:id",
  autenticar,
  verificarNivel(2),
  bloquearConstrucaoRestritoApi,
  bloquearTransporteRestritoApi,
  bloquearCodRestritoApi,
  controller.deletarMotoristaCrud
);
router.get(
  "/api/frota/estoque_crud",
  autenticar,
  verificarNivelOuCargo(2, ["transporte", "direcao", "direção"]),
  bloquearConstrucaoRestritoApi,
  bloquearCodRestritoApi,
  controller.listarEstoqueCrud
);
router.post(
  "/api/frota/estoque_crud",
  autenticar,
  verificarNivel(2),
  bloquearConstrucaoRestritoApi,
  bloquearTransporteRestritoApi,
  bloquearCodRestritoApi,
  controller.criarItemEstoqueCrud
);
router.delete(
  "/api/frota/estoque_crud/:id",
  autenticar,
  verificarNivel(2),
  bloquearConstrucaoRestritoApi,
  bloquearTransporteRestritoApi,
  bloquearCodRestritoApi,
  controller.deletarItemEstoqueCrud
);

module.exports = router;
