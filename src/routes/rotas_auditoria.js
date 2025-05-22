// src/routes/rotas_auditoria.js
const express = require("express");
const path = require("path");
const { promisePool } = require("../init"); // Ajuste o caminho se init.js estiver em src/
const { autenticar, verificarPermissao } = require("../auth"); // Ajuste o caminho

const router = express.Router();

// HTML Page for Auditoria Module
router.get("/auditoria", autenticar, verificarPermissao, (req, res) => {
  res.sendFile(path.join(__dirname, "../../public/pages/into/auditoria.html"));
});

// API Route for Auditoria Module
router.get(
  "/api/auditoria",
  autenticar,
  verificarPermissao,
  async (req, res) => {
    try {
      // Query SQL MODIFICADA para filtrar as ações
      const query = `
        SELECT 
          id, 
          DATE_FORMAT(timestamp, '%d/%m/%Y %H:%i:%s') as timestamp_formatado, 
          matricula_usuario, 
          acao, 
          detalhes 
        FROM auditoria 
        WHERE 
          acao LIKE 'Excluir%' OR    -- Captura "Excluir Inspeção", "Excluir Registro Troca Óleo", etc.
          acao LIKE 'Editar%' OR     -- Captura "Editar Inspeção", etc.
          acao LIKE 'Salvar%' OR     -- Captura "Salvar Inspeção" (considerado uma adição)
          acao LIKE 'Registro%' OR   -- Captura "Registro de Troca de Óleo" (considerado uma adição)
          acao LIKE 'Registrar%'     -- Caso tenha variações como "Registrar ..."
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
