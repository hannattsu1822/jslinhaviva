const express = require("express");
const { promisePool } = require("../init");
const { autenticar, verificarNivel, registrarAuditoria } = require("../auth");

const router = express.Router();

router.get("/api/reles", autenticar, verificarNivel(1), async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      "SELECT id, nome_rele, local_tag, ip_address, port, ativo, ultima_leitura, status_json FROM dispositivos_reles ORDER BY nome_rele"
    );
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar relés:", err);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
});

router.get("/api/reles/:id", autenticar, verificarNivel(1), async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await promisePool.query(
      "SELECT * FROM dispositivos_reles WHERE id = ?",
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Relé não encontrado" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("Erro ao buscar relé:", err);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
});

router.post("/api/reles", autenticar, verificarNivel(2), async (req, res) => {
  const { nome_rele, local_tag, ip_address, port, ativo } = req.body;
  if (!nome_rele || !ip_address || !port) {
    return res.status(400).json({ message: "Campos obrigatórios: nome_rele, ip_address, port" });
  }
  try {
    const [result] = await promisePool.query(
      "INSERT INTO dispositivos_reles (nome_rele, local_tag, ip_address, port, ativo) VALUES (?, ?, ?, ?, ?)",
      [nome_rele, local_tag, ip_address, port, ativo !== undefined ? ativo : 1]
    );
    const novoId = result.insertId;
    await registrarAuditoria(req.user.matricula, 'CRIACAO_RELE', `Relé ID ${novoId} (${nome_rele}) criado.`);
    res.status(201).json({ id: novoId, ...req.body });
  } catch (err) {
    console.error("Erro ao criar relé:", err);
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: "Já existe um relé com essa 'local_tag'." });
    }
    res.status(500).json({ message: "Erro interno no servidor" });
  }
});

router.put("/api/reles/:id", autenticar, verificarNivel(2), async (req, res) => {
  const { id } = req.params;
  const { nome_rele, local_tag, ip_address, port, ativo } = req.body;
  if (!nome_rele || !ip_address || !port) {
    return res.status(400).json({ message: "Campos obrigatórios: nome_rele, ip_address, port" });
  }
  try {
    const [result] = await promisePool.query(
      "UPDATE dispositivos_reles SET nome_rele = ?, local_tag = ?, ip_address = ?, port = ?, ativo = ? WHERE id = ?",
      [nome_rele, local_tag, ip_address, port, ativo, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Relé não encontrado" });
    }
    await registrarAuditoria(req.user.matricula, 'ATUALIZACAO_RELE', `Relé ID ${id} (${nome_rele}) atualizado.`);
    res.json({ message: "Relé atualizado com sucesso" });
  } catch (err) {
    console.error("Erro ao atualizar relé:", err);
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: "Já existe um relé com essa 'local_tag'." });
    }
    res.status(500).json({ message: "Erro interno no servidor" });
  }
});

router.delete("/api/reles/:id", autenticar, verificarNivel(2), async (req, res) => {
  const { id } = req.params;
  try {
    const [rele] = await promisePool.query("SELECT nome_rele FROM dispositivos_reles WHERE id = ?", [id]);
    if (rele.length === 0) {
        return res.status(404).json({ message: "Relé não encontrado para deletar." });
    }
    const nomeRele = rele[0].nome_rele;
    const [result] = await promisePool.query("DELETE FROM dispositivos_reles WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Relé não encontrado" });
    }
    await registrarAuditoria(req.user.matricula, 'DELECAO_RELE', `Relé ID ${id} (${nomeRele}) deletado.`);
    res.status(200).json({ message: "Relé deletado com sucesso" });
  } catch (err) {
    console.error("Erro ao deletar relé:", err);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
});

router.get("/api/reles/:id/leituras", autenticar, verificarNivel(1), async (req, res) => {
    const releId = req.params.id;
    const limit = req.query.limit || 100;

    try {
        const [leituras] = await promisePool.query(
            `SELECT * FROM leituras_reles 
             WHERE rele_id = ? 
             ORDER BY timestamp_leitura DESC 
             LIMIT ?`,
            [releId, parseInt(limit)]
        );
        res.json(leituras.reverse()); 
    } catch (error) {
        console.error("Erro ao buscar leituras do relé:", error);
        res.status(500).json({ error: "Erro ao buscar dados" });
    }
});

router.get("/gerenciar-reles", autenticar, verificarNivel(2), (req, res) => {
  const pageData = {
    pageTitle: "Gerenciamento de Relés",
    user: req.user,
  };
  res.render("pages/rele/gerenciar_reles.html", pageData);
});

router.get("/visualizar-reles", autenticar, verificarNivel(1), (req, res) => {
  const pageData = {
    pageTitle: "Selecionar Relé para Monitoramento",
    user: req.user,
  };
  res.render("pages/rele/listar_reles.html", pageData);
});

router.get("/visualizar-reles/:id", autenticar, verificarNivel(1), async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rele] = await promisePool.query("SELECT nome_rele, local_tag FROM dispositivos_reles WHERE id = ?", [id]);
    if (rele.length === 0) {
      return res.status(404).send("Relé não encontrado");
    }

    const [ultimaLeituraRows] = await promisePool.query(
      `SELECT * FROM leituras_reles 
       WHERE rele_id = ? 
       ORDER BY timestamp_leitura DESC 
       LIMIT 1`,
      [id]
    );
    const ultimaLeitura = ultimaLeituraRows.length > 0 ? ultimaLeituraRows[0] : null;
    
    const pageData = {
      pageTitle: `Monitorando: ${rele[0].nome_rele || rele[0].local_tag}`,
      user: req.user,
      releId: id,
      releNome: rele[0].nome_rele || rele[0].local_tag,
      ultimaLeitura: ultimaLeitura
    };
    res.render("pages/rele/visualizar_rele_detalhe.html", pageData);
  } catch (err) {
    console.error("Erro ao carregar página de detalhes do relé:", err);
    res.status(500).send("Erro interno no servidor");
  }
});

module.exports = router;
