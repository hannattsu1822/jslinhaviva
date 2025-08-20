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

router.get("/api/prv/status", autenticar, async (req, res) => {
  const { veiculoId } = req.query;
  if (!veiculoId) {
    return res.status(400).json({ message: "ID do veículo é obrigatório." });
  }

  try {
    const [rows] = await promisePool.query(
      "SELECT * FROM prv_registros WHERE veiculo_id = ? AND chegada_km IS NULL LIMIT 1",
      [veiculoId]
    );

    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error("Erro ao verificar status da PRV:", error);
    res.status(500).json({ message: "Erro interno ao verificar status." });
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
    const [ano, mes] = mesAno.split("-");
    const mesAnoFormatado = `${mes}/${ano}`;

    const [registros] = await promisePool.query(
      "SELECT * FROM prv_registros WHERE veiculo_id = ? AND mes_ano_referencia = ? AND chegada_km IS NOT NULL ORDER BY dia, saida_horario",
      [veiculoId, mesAnoFormatado]
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
      data_viagem,
      saida_horario,
      saida_local,
      saida_km,
    } = req.body;

    if (!veiculo_id || !data_viagem || !saida_km) {
      return res
        .status(400)
        .json({
          message: "Veículo, Data da Viagem e KM de Saída são obrigatórios.",
        });
    }

    const [viagemAberta] = await promisePool.query(
      "SELECT id FROM prv_registros WHERE veiculo_id = ? AND chegada_km IS NULL",
      [veiculo_id]
    );

    if (viagemAberta.length > 0) {
      return res.status(409).json({
        message:
          "Não é possível iniciar uma nova viagem. Já existe uma em andamento para este veículo.",
      });
    }

    const [ano, mes, dia] = data_viagem.split("-");
    const mesAnoFormatado = `${mes}/${ano}`;

    const sql = `
      INSERT INTO prv_registros 
      (veiculo_id, mes_ano_referencia, dia, saida_horario, saida_local, saida_km, motorista_matricula)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await promisePool.query(sql, [
      veiculo_id,
      mesAnoFormatado,
      dia,
      saida_horario,
      saida_local,
      saida_km,
      matricula,
    ]);

    await registrarAuditoria(
      matricula,
      "INICIAR_VIAGEM_PRV",
      `ID do Registro: ${result.insertId}`
    );

    res.status(201).json({
      message: "Saída registrada com sucesso!",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Erro ao registrar saída na PRV:", error);
    res.status(500).json({ message: "Erro interno ao salvar registro." });
  }
});

router.put("/api/prv/registros/:id", autenticar, async (req, res) => {
  try {
    const { id } = req.params;
    const { matricula } = req.session.user;
    const {
      chegada_horario,
      chegada_local,
      chegada_km,
      processo,
      tipo_servico,
      ocorrencias,
    } = req.body;

    if (!chegada_km) {
      return res.status(400).json({ message: "KM de Chegada é obrigatório." });
    }

    const camposParaAtualizar = {
      chegada_horario,
      chegada_local,
      chegada_km,
      processo,
      tipo_servico,
      ocorrencias,
    };

    const [result] = await promisePool.query(
      "UPDATE prv_registros SET ? WHERE id = ?",
      [camposParaAtualizar, id]
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Registro de saída não encontrado." });
    }

    await registrarAuditoria(
      matricula,
      "FINALIZAR_VIAGEM_PRV",
      `ID do Registro: ${id}`
    );

    res.json({ message: "Chegada registrada com sucesso!" });
  } catch (error) {
    console.error("Erro ao registrar chegada na PRV:", error);
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
