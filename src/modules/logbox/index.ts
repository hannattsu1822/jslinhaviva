import express from "express";
import { autenticar, verificarNivel, verificarNivelOuCargo } from "../../auth";
import dispositivosRoutes from "./dispositivos/dispositivos.routes";
import monitoramentoRoutes from "./monitoramento/monitoramento.routes";
import {
  redirecionarConstrucaoRestrito,
  redirecionarTransporteRestrito,
} from "../../shared/perfilCargo.helper";

const router = express.Router();

router.get(
  "/monitoramento-hub",
  autenticar,
  verificarNivelOuCargo(4, ["cod"]),
  redirecionarConstrucaoRestrito,
  redirecionarTransporteRestrito,
  (req, res) => {
  res.render("pages/logbox/monitoramento-hub", {
    pageTitle: "Hub de Monitoramento",
    user: req.session.user,
  });
});

router.use(dispositivosRoutes);
router.use(monitoramentoRoutes);

export = router;
