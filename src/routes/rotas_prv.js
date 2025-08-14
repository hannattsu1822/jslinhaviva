const express = require("express");
const path = require("path");
const { promisePool } = require("../init");
const { autenticar, registrarAuditoria } = require("../auth");

const router = express.Router();

router.get("/prv", autenticar, (req, res) => {
  res.render("pages/prv/prv.html", {
    user: req.session.user,
  });
});

router.get("/api/prv/veiculos", autenticar, async (req, res) => {
  try {
    const [veiculos] = await promisePool.query(
      "SELECT id, placa, modelo FROM veiculos_frota WHERE status = 'ATIVO' ORDER BY modelo, placa"
    );
    res.json(veiculos);
  } catch (error) {
    console.error("Erro ao buscar veículos da frota:", error);
    res.status(500).json({ message: "Erro interno ao buscar veículos." });
  }
});

router.get("/api/prv/registros", autenticar, async (req, res) => {
  const { veiculoId, mesAno } = req.query;

  if (!veiculoId || !mesAno) {
    return res
      .status(400)
      .json({ message: "ID do veículo e Mês/Ano são obrigatórios." });
  }

  try {
    const [registros] = await promisePool.query(
      "SELECT * FROM prv_registros WHERE veiculo_id = ? AND mes_ano_referencia = ? ORDER BY dia, saida_horario",
      [veiculoId, mesAno]
    );
    res.json(registros);
  } catch (error) {
    console.error("Erro ao buscar registros da PRV:", error);
    res.status(500).json({ message: "Erro interno ao buscar registros." });
  }
});

router.post("/api/prv/registros", autenticar, async (req, res) => {
  try {
    const { matricula } = req.session.user;
    const {
      veiculo_id,
      mes_ano_referencia,
      dia,
      saida_horario,
      saida_local,
      saida_km,
      chegada_horario,
      chegada_local,
      chegada_km,
      processo,
      tipo_servico,
      ocorrencias,
    } = req.body;

    if (!veiculo_id || !mes_ano_referencia || !dia) {
      return res
        .status(400)
        .json({ message: "Veículo, Mês/Ano e Dia são obrigatórios." });
    }

    const sql = `
      INSERT INTO prv_registros 
      (veiculo_id, mes_ano_referencia, dia, saida_horario, saida_local, saida_km, 
       chegada_horario, chegada_local, chegada_km, motorista_matricula, processo, tipo_servico, ocorrencias)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await promisePool.query(sql, [
      veiculo_id,
      mes_ano_referencia,
      dia,
      saida_horario,
      saida_local,
      saida_km,
      chegada_horario,
      chegada_local,
      chegada_km,
      matricula,
      processo,
      tipo_servico,
      ocorrencias,
    ]);

    await registrarAuditoria(
      matricula,
      "INSERIR_REGISTRO_PRV",
      `ID do Registro: ${result.insertId}`
    );

    res.status(201).json({
      message: "Registro adicionado com sucesso!",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Erro ao adicionar registro na PRV:", error);
    res.status(500).json({ message: "Erro interno ao salvar registro." });
  }
});

router.put("/api/prv/registros/:id", autenticar, async (req, res) => {
  try {
    const { id } = req.params;
    const { matricula } = req.session.user;
    const campos = req.body;

    const [result] = await promisePool.query(
      "UPDATE prv_registros SET ? WHERE id = ?",
      [campos, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Registro não encontrado." });
    }

    await registrarAuditoria(
      matricula,
      "ATUALIZAR_REGISTRO_PRV",
      `ID do Registro: ${id}`
    );

    res.json({ message: "Registro atualizado com sucesso!" });
  } catch (error) {
    console.error("Erro ao atualizar registro na PRV:", error);
    res.status(500).json({ message: "Erro interno ao atualizar registro." });
  }
});

router.delete("/api/prv/registros/:id", autenticar, async (req, res) => {
  try {
    const { id } = req.params;
    const { matricula } = req.session.user;

    const [result] = await promisePool.query(
      "DELETE FROM prv_registros WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Registro não encontrado." });
    }

    await registrarAuditoria(
      matricula,
      "EXCLUIR_REGISTRO_PRV",
      `ID do Registro: ${id}`
    );

    res.json({ message: "Registro excluído com sucesso!" });
  } catch (error) {
    console.error("Erro ao excluir registro da PRV:", error);
    res.status(500).json({ message: "Erro interno ao excluir registro." });
  }
});

module.exports = router;
