import express from "express";
import { autenticar, verificarNivel } from "../../auth";
import dispositivosRoutes from "./dispositivos/dispositivos.routes";
import monitoramentoRoutes from "./monitoramento/monitoramento.routes";

const router = express.Router();

router.get("/monitoramento-hub", autenticar, verificarNivel(4), (req, res) => {
  res.render("pages/logbox/monitoramento-hub", {
    pageTitle: "Hub de Monitoramento",
    user: req.session.user,
  });
});

router.use(dispositivosRoutes);
router.use(monitoramentoRoutes);

export = router;
