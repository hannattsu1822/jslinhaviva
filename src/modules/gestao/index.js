const express = require("express");
const router = express.Router();

const usuariosRoutes = require("./usuarios/usuarios.routes");
const frotaRoutes = require("./frota/frota.routes");
const prvRoutes = require("./prv/prv.routes");

router.use(usuariosRoutes);
router.use(frotaRoutes);
router.use(prvRoutes);

module.exports = router;
