const express = require("express");
const router = express.Router();
const path = require("path");
const { autenticar, verificarNivel } = require("../../auth");
const {
  NIVEL_ADMIN_FIBRA,
  NIVEL_ACESSO_MIN,
} = require("./fibra.permissions");
const { buildPermissoesFibra } = require("./fibra.view.helper");
const { projectRootDir } = require("../../shared/path.helper");
const { promisePool } = require("../../infrastructure/database");

const servicosRoutes = require("./servicos/servicos.routes");
const mapaRoutes = require("./mapa/mapa.routes");

router.get("/fibra-optica", autenticar, verificarNivel(NIVEL_ACESSO_MIN), (req, res) => {
  res.render("pages/fibra_optica/dashboard_fibra.html", {
    user: req.session.user,
    permissoes: buildPermissoesFibra(req.user),
  });
});

router.get(
  "/visualizacao_mapa_fibra",
  autenticar,
  verificarNivel(NIVEL_ADMIN_FIBRA),
  (req, res) => {
    res.render("pages/fibra_optica/visualizacao_mapa.html", {
      user: req.session.user,
      permissoes: buildPermissoesFibra(req.user),
    });
  }
);

router.get(
  "/gerenciar-pontos-fibra",
  autenticar,
  verificarNivel(NIVEL_ADMIN_FIBRA),
  async (req, res) => {
    try {
      const sql = `
        SELECT 
          fm.id,
          fm.tipo_ponto,
          fm.tag,
          fm.created_at,
          u.nome as nome_coletor
        FROM fibra_maps fm
        LEFT JOIN users u ON fm.coletado_por_matricula = u.matricula
        ORDER BY fm.id DESC
      `;
      const [pontos] = await promisePool.query(sql);
      res.render("pages/fibra_optica/gerenciar_pontos_fibra.html", {
        user: req.session.user,
        pontos: pontos,
        permissoes: buildPermissoesFibra(req.user),
      });
    } catch (error) {
      console.error(
        "Erro ao carregar a página de gerenciamento de pontos:",
        error
      );
      res
        .status(500)
        .send("Erro ao carregar a página de gerenciamento de pontos.");
    }
  }
);

router.use(servicosRoutes);
router.use(mapaRoutes);

module.exports = router;
