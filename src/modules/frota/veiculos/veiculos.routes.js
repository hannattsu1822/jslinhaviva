const express = require("express");
const path = require("path");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const controller = require("./veiculos.controller");
const { projectRootDir } = require("../../../shared/path.helper");

router.get("/frota", autenticar, verificarNivel(2), (req, res) => {
  res.sendFile(path.join(projectRootDir, "public/pages/frota/frota.html"));
});

router.get("/checklist_veiculos", autenticar, verificarNivel(3), (req, res) => {
  res.sendFile(
    path.join(projectRootDir, "public/pages/frota/checklist_veiculos.html")
  );
});

router.get("/agendar_checklist", autenticar, verificarNivel(4), (req, res) => {
  res.sendFile(
    path.join(projectRootDir, "public/pages/frota/agendar_checklist.html")
  );
});

router.get("/frota_controle", autenticar, verificarNivel(2), (req, res) => {
  res.sendFile(
    path.join(projectRootDir, "public/pages/frota/frota_controle.html")
  );
});

router.get(
  "/frota_motoristas_cadastro",
  autenticar,
  verificarNivel(2),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/frota/frota_motoristas_cadastro.html"
      )
    );
  }
);

router.get(
  "/frota_estoque_cadastro",
  autenticar,
  verificarNivel(2),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/frota/frota_estoque_cadastro.html"
      )
    );
  }
);

router.get(
  "/frota_veiculos_cadastro",
  autenticar,
  verificarNivel(2),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/frota/frota_veiculos_cadastro.html"
      )
    );
  }
);

router.get("/filtrar_veiculos", autenticar, verificarNivel(4), (req, res) => {
  res.sendFile(
    path.join(projectRootDir, "public/pages/frota/filtrar_veiculos.html")
  );
});

router.get("/relatorio_publico_veiculos", (req, res) => {
  res.sendFile(
    path.join(projectRootDir, "public/pages/frota/relatorio_veiculos.html")
  );
});

router.get("/check_horimetro", autenticar, verificarNivel(3), (req, res) => {
  res.sendFile(
    path.join(projectRootDir, "public/pages/frota/check_horimetro.html")
  );
});

router.get("/editar_inspecao", autenticar, verificarNivel(4), (req, res) => {
  res.sendFile(
    path.join(projectRootDir, "public/pages/frota/editar_inspecao.html")
  );
});

router.get(
  "/api/motoristas",
  autenticar,
  verificarNivel(2),
  controller.listarMotoristas
);
router.get(
  "/api/encarregados",
  autenticar,
  verificarNivel(2),
  controller.listarEncarregados
);
router.get(
  "/api/placas",
  autenticar,
  verificarNivel(2),
  controller.listarPlacas
);
router.get(
  "/api/veiculos_controle",
  autenticar,
  verificarNivel(2),
  controller.listarVeiculosControle
);
router.get(
  "/api/frota_inventario",
  autenticar,
  verificarNivel(2),
  controller.listarInventario
);
router.post(
  "/api/frota_inventario",
  autenticar,
  verificarNivel(2),
  controller.criarItemInventario
);
router.delete(
  "/api/frota_inventario/:id",
  autenticar,
  verificarNivel(2),
  controller.deletarItemInventario
);
router.get(
  "/api/frota/motoristas_crud",
  autenticar,
  verificarNivel(2),
  controller.listarMotoristasCrud
);
router.post(
  "/api/frota/motoristas_crud",
  autenticar,
  verificarNivel(2),
  controller.criarMotoristaCrud
);
router.delete(
  "/api/frota/motoristas_crud/:id",
  autenticar,
  verificarNivel(2),
  controller.deletarMotoristaCrud
);
router.get(
  "/api/frota/estoque_crud",
  autenticar,
  verificarNivel(2),
  controller.listarEstoqueCrud
);
router.post(
  "/api/frota/estoque_crud",
  autenticar,
  verificarNivel(2),
  controller.criarItemEstoqueCrud
);
router.delete(
  "/api/frota/estoque_crud/:id",
  autenticar,
  verificarNivel(2),
  controller.deletarItemEstoqueCrud
);

module.exports = router;
