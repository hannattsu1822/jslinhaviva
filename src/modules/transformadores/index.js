const express = require("express");
const router = express.Router();
const path = require("path");
const { autenticar, verificarNivel } = require("../../auth");
const { projectRootDir, publicDir, publicPage, viewsDir, viewsPage } = require("../../shared/path.helper");

const transformadoresRoutes = require("./transformadores/transformadores.routes");
const checklistRoutes = require("./checklist/checklist.routes");

// Rotas de Páginas HTML
router.get("/transformadores", autenticar, verificarNivel(3), (req, res) => {
  res.sendFile(
    publicPage("trafos/transformadores.html")
  );
});
router.get(
  "/upload_transformadores",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      publicPage("trafos/upload_transformadores.html")
    );
  }
);
router.get(
  "/formulario_transformadores",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      publicPage("trafos/formulario_transformadores.html")
    );
  }
);
router.get(
  "/filtrar_transformadores",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      publicPage("trafos/filtrar_transformadores.html")
    );
  }
);
router.get(
  "/avariados_pendentes",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(publicPage("trafos/avariados_pendentes.html"));
  }
);
// ESTA É A ROTA QUE FALTAVA
router.get("/relatorio_formulario", (req, res) => {
  res.sendFile(
    publicPage("trafos/relatorio_formulario.html")
  );
});

// Rotas da API
router.use(transformadoresRoutes);
router.use(checklistRoutes);

module.exports = router;
