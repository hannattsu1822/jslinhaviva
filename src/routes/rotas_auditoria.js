// src/routes/rotas_auditoria.js
const express = require("express");
const path = require("path");
const { promisePool } = require("../init");


const { autenticar, verificarNivel } = require("../auth");

const router = express.Router();


router.get("/auditoria", autenticar, verificarNivel(4), (req, res) => {
  res.sendFile(path.join(__dirname, "../../public/pages/into/auditoria.html"));
});


router.get(
  "/api/auditoria",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    try {
      const query = `
        SELECT 
          id, 
          DATE_FORMAT(timestamp, '%d/%m/%Y %H:%i:%s') as timestamp_formatado, 
          matricula_usuario, 
          acao, 
          detalhes 
        FROM auditoria 
        WHERE 
          acao LIKE 'Excluir%' OR
          acao LIKE 'Editar%' OR
          acao LIKE 'Salvar%' OR
          acao LIKE 'Registro%' OR
          acao LIKE 'Registrar%'
        ORDER BY timestamp DESC
      `;
      const [rows] = await promisePool.query(query);
      res.status(200).json(rows);
    } catch (err) {
      console.error("Erro ao buscar logs de auditoria:", err);
      res.status(500).json({
        message: "Erro ao buscar logs de auditoria!",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  }
);

module.exports = router;

