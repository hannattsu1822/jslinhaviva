const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../auth");
const { promisePool } = require("../init");

router.get(
  "/pagina-gerenciamento-usuarios",
  autenticar,
  verificarNivel(4),
  (req, res) => {
    res.render("pages/gestor/gerenciamento-usuarios", {
      user: req.user,
    });
  }
);

router.get("/dashboard-gestor", autenticar, verificarNivel(4), (req, res) => {
  res.render("pages/gestor/dashboard-gestor", {
    user: req.user,
  });
});

router.get("/logbox-devices", autenticar, async (req, res) => {
  try {
    const [devices] = await promisePool.query(
      "SELECT serial_number, local_tag FROM dispositivos_logbox ORDER BY local_tag ASC"
    );

    res.render("pages/logbox/device-list", {
      pageTitle: "Equipamentos LogBox",
      user: req.session.user,
      devices: devices,
    });
  } catch (err) {
    console.error("Erro ao buscar lista de dispositivos LogBox:", err);
    res.status(500).send("Erro interno no servidor");
  }
});

router.get("/monitoramento-hub", autenticar, verificarNivel(4), (req, res) => {
  res.render("pages/logbox/monitoramento-hub", {
    pageTitle: "Hub de Monitoramento",
    user: req.session.user,
  });
});

module.exports = router;
