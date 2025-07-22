// src/routes/rotas_fibra_optica.js
const express = require("express");
const path = require("path");
const { autenticar, verificarNivel } = require("../auth");
const router = express.Router();

// Rota para servir a página principal de Fibra Óptica
router.get("/fibra-optica", autenticar, verificarNivel(3), (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../public/pages/fibra_optica/fibra_optica.html")
  );
});

module.exports = router;
