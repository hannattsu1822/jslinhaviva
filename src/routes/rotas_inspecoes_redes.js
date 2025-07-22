// src/routes/rotas_inspecoes_redes.js
const express = require("express");
const path = require("path");
const { autenticar, verificarNivel } = require("../auth");
const router = express.Router();

// Rota para servir a página principal de Inspeções de Redes
router.get("/inspecoes-redes", autenticar, verificarNivel(3), (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "../../public/pages/inspecoes_redes/inspecoes_redes_principal.html"
    )
  );
});

module.exports = router;
