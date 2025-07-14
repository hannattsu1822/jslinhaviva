const express = require("express");
const path = require("path");
const { chromium } = require("playwright");
const { promisePool } = require("../init");
const {
  autenticar,
  verificarPermissaoPorCargo,
  registrarAuditoria,
} = require("../auth");

const router = express.Router();

router.get("/frota", autenticar, verificarPermissaoPorCargo, (req, res) => {
  res.sendFile(path.join(__dirname, "../../public/pages/frota/frota.html"));
});

router.get(
  "/checklist_veiculos",
  autenticar,
  verificarPermissaoPorCargo,
  (req, res) => {
    res.sendFile(
      path.join(__dirname, "../../public/pages/frota/checklist_veiculos.html")
    );
  }
);

router.get(
  "/agendar_checklist",
  autenticar,
  verificarPermissaoPorCargo,
  (req, res) => {
    res.sendFile(
      path.join(__dirname, "../../public/pages/frota/agendar_checklist.html")
    );
  }
);

router.get(
  "/frota_controle",
  autenticar,
  verificarPermissaoPorCargo,
  (req, res) => {
    res.sendFile(
      path.join(__dirname, "../../public/pages/frota/frota_controle.html")
    );
  }
);

router.get(
  "/frota_motoristas_cadastro",
  autenticar,
  verificarPermissaoPorCargo,
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "../../public/pages/frota/frota_motoristas_cadastro.html"
      )
    );
  }
);

router.get(
  "/frota_estoque_cadastro",
  autenticar,
  verificarPermissaoPorCargo,
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "../../public/pages/frota/frota_estoque_cadastro.html"
      )
    );
  }
);

router.get(
  "/frota_veiculos_cadastro",
  autenticar,
  verificarPermissaoPorCargo,
  (req, res) => {
    try {
      const filePath = path.join(
        __dirname,
        "../../public/pages/frota/frota_veiculos_cadastro.html"
      );
      res.sendFile(filePath);
    } catch (error) {
      console.error("Erro ao tentar servir o arquivo:", error);
      res.status(500).send("Erro ao carregar a página.");
    }
  }
);
router.get(
  "/filtrar_veiculos",
  autenticar,
  verificarPermissaoPorCargo,
  (req, res) => {
    res.sendFile(
      path.join(__dirname, "../../public/pages/frota/filtrar_veiculos.html")
    );
  }
);

router.get("/relatorio_publico_veiculos", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../public/pages/frota/relatorio_veiculos.html")
  );
});

router.get(
  "/check_horimetro",
  autenticar,
  verificarPermissaoPorCargo,
  (req, res) => {
    res.sendFile(
      path.join(__dirname, "../../public/pages/frota/check_horimetro.html")
    );
  }
);

router.get(
  "/registro_oleo",
  autenticar,
  verificarPermissaoPorCargo,
  (req, res) => {
    res.sendFile(
      path.join(__dirname, "../../public/pages/frota/registro_oleo.html")
    );
  }
);

router.get(
  "/proxima_troca_oleo",
  autenticar,
  verificarPermissaoPorCargo,
  (req, res) => {
    res.sendFile(
      path.join(__dirname, "../../public/pages/frota/proxima_troca_oleo.html")
    );
  }
);

router.get("/editar_inspecao", autenticar, (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../public/pages/frota/editar_inspecao.html")
  );
});

router.get("/api/motoristas", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      "SELECT matricula, nome FROM users WHERE cargo = 'Motorista'"
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao buscar motoristas:", err);
    res.status(500).json({ message: "Erro ao buscar motoristas!" });
  }
});

router.get("/api/encarregados", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      "SELECT matricula, nome FROM users WHERE cargo = 'Encarregado' ORDER BY nome ASC"
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao buscar encarregados:", err);
    res.status(500).json({ message: "Erro ao buscar encarregados!" });
  }
});

router.get("/api/placas", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      `SELECT
        v.id,
        v.placa,
        v.modelo,
        v.encarregado_matricula,
        v.ordem_checklist_semanal,
        u.nome AS encarregado_nome
      FROM
        veiculos v
      LEFT JOIN
        users u ON v.encarregado_matricula = u.matricula
      WHERE
        v.ordem_checklist_semanal IS NOT NULL
      ORDER BY
        v.ordem_checklist_semanal ASC`
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao buscar placas:", err);
    res.status(500).json({ message: "Erro ao buscar placas!" });
  }
});

router.post(
  "/api/agendar_checklist",
  autenticar,
  verificarPermissaoPorCargo,
  async (req, res) => {
    const { veiculo_id, data_agendamento, encarregado_matricula, observacoes } =
      req.body;
    const agendado_por_matricula = req.user.matricula;

    if (!veiculo_id || !data_agendamento || !encarregado_matricula) {
      return res.status(400).json({ message: "Campos obrigatórios faltando!" });
    }

    try {
      const query = `
      INSERT INTO agendamentos_checklist
      (veiculo_id, data_agendamento, encarregado_matricula, agendado_por_matricula, observacoes)
      VALUES (?, ?, ?, ?, ?)
    `;
      const [result] = await promisePool.query(query, [
        veiculo_id,
        data_agendamento,
        encarregado_matricula,
        agendado_por_matricula,
        observacoes || null,
      ]);

      await registrarAuditoria(
        agendado_por_matricula,
        "Agendamento de Checklist",
        `Agendamento criado para veículo ID: ${veiculo_id}, Data: ${data_agendamento}, Encarregado: ${encarregado_matricula}`
      );

      res.status(201).json({
        message: "Agendamento de checklist criado com sucesso!",
        id: result.insertId,
      });
    } catch (err) {
      console.error("Erro ao agendar checklist:", err);
      res.status(500).json({ message: "Erro ao agendar checklist!" });
    }
  }
);

router.get("/api/agendamentos_checklist/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT
          ac.id,
          ac.veiculo_id,
          ac.data_agendamento,
          ac.encarregado_matricula,
          ac.agendado_por_matricula,
          ac.status,
          ac.data_conclusao,
          ac.inspecao_id,
          ac.observacoes,
          v.placa,
          v.modelo,
          u_enc.nome AS encarregado_nome,
          u_agend.nome AS agendado_por_nome
      FROM
          agendamentos_checklist ac
      JOIN
          veiculos v ON ac.veiculo_id = v.id
      JOIN
          users u_enc ON ac.encarregado_matricula = u_enc.matricula
      JOIN
          users u_agend ON ac.agendado_por_matricula = u_agend.matricula
      WHERE
          ac.id = ?
    `;
    const [rows] = await promisePool.query(query, [id]);

    if (rows.length > 0) {
      const agendamento = rows[0];
      let statusDisplay = agendamento.status;
      if (
        agendamento.status === "Agendado" &&
        new Date(agendamento.data_agendamento) < new Date() &&
        !agendamento.data_conclusao
      ) {
        statusDisplay = "Atrasado";
      }
      res.status(200).json({ ...agendamento, status_display: statusDisplay });
    } else {
      res.status(404).json({ message: "Agendamento não encontrado!" });
    }
  } catch (err) {
    console.error("Erro ao buscar agendamento específico:", err);
    res.status(500).json({ message: "Erro ao buscar agendamento!" });
  }
});

// NOVA ROTA: Excluir Agendamento de Checklist
router.delete(
  "/api/agendamentos_checklist/:id",
  autenticar,
  verificarPermissaoPorCargo,
  async (req, res) => {
    const { id } = req.params;
    const matriculaUsuario = req.user.matricula; // Quem está excluindo

    if (!id) {
      return res
        .status(400)
        .json({ message: "ID do agendamento é obrigatório." });
    }

    let connection;
    try {
      connection = await promisePool.getConnection();
      await connection.beginTransaction();

      // Opcional: Buscar detalhes para auditoria antes de excluir
      const [agendamentoInfo] = await connection.query(
        `SELECT ac.id, v.placa, ac.data_agendamento, u_enc.nome AS encarregado_nome
       FROM agendamentos_checklist ac
       JOIN veiculos v ON ac.veiculo_id = v.id
       JOIN users u_enc ON ac.encarregado_matricula = u_enc.matricula
       WHERE ac.id = ?`,
        [id]
      );

      const [result] = await connection.query(
        "DELETE FROM agendamentos_checklist WHERE id = ?",
        [id]
      );

      if (result.affectedRows > 0) {
        const logMessage =
          agendamentoInfo.length > 0
            ? `Agendamento ID ${id} (Veículo: ${
                agendamentoInfo[0].placa
              }, Data: ${
                agendamentoInfo[0].data_agendamento.toISOString().split("T")[0]
              }, Encarregado: ${agendamentoInfo[0].encarregado_nome}) excluído.`
            : `Agendamento ID ${id} excluído (detalhes não recuperados para auditoria).`;

        await registrarAuditoria(
          matriculaUsuario,
          "Excluir Agendamento Checklist",
          logMessage,
          connection
        );
        await connection.commit();
        res.status(200).json({ message: "Agendamento excluído com sucesso!" });
      } else {
        await connection.rollback();
        res.status(404).json({ message: "Agendamento não encontrado." });
      }
    } catch (err) {
      if (connection) await connection.rollback();
      console.error("Erro ao excluir agendamento de checklist:", err);
      res
        .status(500)
        .json({ message: "Erro ao excluir agendamento de checklist!" });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.get("/api/agendamentos_checklist", autenticar, async (req, res) => {
  try {
    const { status, dataInicial, dataFinal, limit } = req.query;
    let query = `
      SELECT
          ac.id,
          ac.veiculo_id,
          ac.data_agendamento,
          ac.encarregado_matricula,
          ac.agendado_por_matricula,
          ac.status,
          ac.data_conclusao,
          ac.inspecao_id,
          ac.observacoes,
          v.placa,
          v.modelo,
          u_enc.nome AS encarregado_nome,
          u_agend.nome AS agendado_por_nome
      FROM
          agendamentos_checklist ac
      JOIN
          veiculos v ON ac.veiculo_id = v.id
      JOIN
          users u_enc ON ac.encarregado_matricula = u_enc.matricula
      JOIN
          users u_agend ON ac.agendado_por_matricula = u_agend.matricula
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      if (status === "Concluído") {
        query += ` AND ac.status = ?`;
        params.push("Concluído");
      } else if (status === "NaoConcluido") {
        query += ` AND ac.status = ?`;
        params.push("Agendado");
      } else if (status === "Atrasado") {
        query += ` AND ac.status = 'Agendado' AND ac.data_agendamento < CURDATE()`;
      }
    }

    if (dataInicial) {
      query += ` AND ac.data_agendamento >= ?`;
      params.push(dataInicial);
    }
    if (dataFinal) {
      query += ` AND ac.data_agendamento <= ?`;
      params.push(dataFinal);
    }

    query += ` ORDER BY ac.data_agendamento DESC, ac.id DESC`;

    if (limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(limit));
    }

    const [rows] = await promisePool.query(query, params);

    const agendamentosFormatados = rows.map((agendamento) => {
      let statusDisplay = agendamento.status;
      if (
        agendamento.status === "Agendado" &&
        new Date(agendamento.data_agendamento) < new Date() &&
        !agendamento.data_conclusao
      ) {
        statusDisplay = "Atrasado";
      }
      return { ...agendamento, status_display: statusDisplay };
    });

    res.status(200).json(agendamentosFormatados);
  } catch (err) {
    console.error("Erro ao buscar agendamentos de checklist:", err);
    res
      .status(500)
      .json({ message: "Erro ao buscar agendamentos de checklist!" });
  }
});

router.get("/api/veiculos_controle", autenticar, async (req, res) => {
  try {
    const { placa } = req.query;
    let query =
      "SELECT id, placa, modelo AS nome, situacao, tipo_veiculo, ano_fabricacao, DATE_FORMAT(data_aquisicao, '%Y-%m-%d') as data_aquisicao, cor FROM veiculos WHERE 1=1";
    const values = [];

    if (placa) {
      query += ` AND placa LIKE ?`;
      values.push(`%${placa}%`);
    }
    query += " ORDER BY modelo ASC";
    const [rows] = await promisePool.query(query, values);
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao buscar veículos:", err);
    res.status(500).json({ message: "Erro ao buscar veículos!" });
  }
});

router.get("/api/inspecoes", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      "SELECT * FROM inspecoes ORDER BY data_inspecao DESC"
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao buscar inspeções:", err);
    res.status(500).json({ message: "Erro ao buscar inspeções!" });
  }
});

router.get("/api/inspecoes/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await promisePool.query(
      "SELECT * FROM inspecoes WHERE id = ?",
      [id]
    );
    if (rows.length > 0) {
      res.status(200).json(rows[0]);
    } else {
      res.status(404).json({ message: "Inspeção não encontrada!" });
    }
  } catch (err) {
    console.error("Erro ao buscar inspeção:", err);
    res.status(500).json({ message: "Erro ao buscar inspeção!" });
  }
});

router.post("/api/salvar_inspecao", autenticar, async (req, res) => {
  const {
    agendamento_id,
    matricula,
    placa,
    data_inspecao,
    km_atual,
    horimetro,
    observacoes,
    ...outrosCampos
  } = req.body;

  if (!matricula || !placa || !data_inspecao || !km_atual || !horimetro) {
    return res.status(400).json({ message: "Dados obrigatórios faltando!" });
  }
  if (parseFloat(km_atual) < 0 || parseFloat(horimetro) < 0) {
    return res
      .status(400)
      .json({ message: "KM atual e horímetro devem ser valores positivos!" });
  }

  let connection;
  try {
    connection = await promisePool.getConnection();
    await connection.beginTransaction();

    const campos = [
      "matricula",
      "placa",
      "data_inspecao",
      "km_atual",
      "horimetro",
      "observacoes",
      "buzina",
      "cinto_seguranca",
      "quebra_sol",
      "retrovisor_inteiro",
      "retrovisor_direito_esquerdo",
      "limpador_para_brisa",
      "farol_baixa",
      "farol_alto",
      "meia_luz",
      "luz_freio",
      "luz_re",
      "bateria",
      "luzes_painel",
      "seta_direita_esquerdo",
      "pisca_alerta",
      "luz_interna",
      "velocimetro_tacografo",
      "freios",
      "macaco",
      "chave_roda",
      "triangulo_sinalizacao",
      "extintor_incendio",
      "portas_travas",
      "sirene",
      "fechamento_janelas",
      "para_brisa",
      "oleo_motor",
      "oleo_freio",
      "nivel_agua_radiador",
      "pneus_estado_calibragem",
      "pneu_reserva_estepe",
      "bancos_encosto_assentos",
      "para_choque_dianteiro",
      "para_choque_traseiro",
      "lataria",
      "estado_fisico_sky",
      "funcionamento_sky",
      "sapatas",
      "cestos",
      "comandos",
      "lubrificacao",
      "ensaio_eletrico",
      "cilindros",
      "gavetas",
      "capas",
      "nivel_oleo_sky",
    ];
    const placeholders = campos.map(() => "?").join(", ");
    const values = campos.map((campo) =>
      req.body[campo] !== undefined ? req.body[campo] : null
    );
    const query = `INSERT INTO inspecoes (${campos.join(
      ", "
    )}) VALUES (${placeholders})`;
    const [inspecaoResult] = await connection.query(query, values);
    const novaInspecaoId = inspecaoResult.insertId;

    if (agendamento_id) {
      const updateAgendamentoQuery = `
        UPDATE agendamentos_checklist
        SET status = 'Concluído', data_conclusao = NOW(), inspecao_id = ?
        WHERE id = ? AND status = 'Agendado'
      `;
      const [updateResult] = await connection.query(updateAgendamentoQuery, [
        novaInspecaoId,
        agendamento_id,
      ]);

      if (updateResult.affectedRows === 0) {
        await connection.rollback();
        return res.status(400).json({
          message:
            "Agendamento não encontrado ou já foi concluído/cancelado. Inspeção não salva.",
        });
      }
    }

    await registrarAuditoria(
      matricula,
      "Salvar Inspeção",
      `Inspeção salva para placa: ${placa}` +
        (agendamento_id ? ` (Agendamento ID: ${agendamento_id})` : "")
    );

    await connection.commit();

    res.status(201).json({ message: "Inspeção salva com sucesso!" });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Erro ao salvar inspeção:", err);
    res.status(500).json({ message: "Erro ao salvar inspeção!" });
  } finally {
    if (connection) connection.release();
  }
});

router.post("/api/filtrar_inspecoes", autenticar, async (req, res) => {
  const { placa, matricula, dataInicial, dataFinal } = req.body;
  try {
    let query = "SELECT * FROM inspecoes WHERE 1=1";
    const values = [];
    if (placa) {
      query += ` AND placa = ?`;
      values.push(placa);
    }
    if (matricula) {
      query += ` AND matricula = ?`;
      values.push(matricula);
    }
    if (dataInicial && dataFinal) {
      query += ` AND data_inspecao BETWEEN ? AND ?`;
      values.push(dataInicial, dataFinal);
    } else if (dataInicial) {
      query += ` AND data_inspecao >= ?`;
      values.push(dataInicial);
    } else if (dataFinal) {
      query += ` AND data_inspecao <= ?`;
      values.push(dataFinal);
    }
    query += " ORDER BY data_inspecao DESC";
    const [rows] = await promisePool.query(query, values);
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao filtrar inspeções:", err);
    res.status(500).json({ message: "Erro ao filtrar inspeções!" });
  }
});

router.delete("/api/excluir_inspecao/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await promisePool.query(
      "DELETE FROM inspecoes WHERE id = ?",
      [id]
    );
    if (result.affectedRows > 0) {
      await registrarAuditoria(
        req.user.matricula,
        "Excluir Inspeção",
        `Inspeção excluída com ID: ${id}`
      );
      res.status(200).json({ message: "Inspeção excluída com sucesso!" });
    } else {
      res.status(404).json({ message: "Inspeção não encontrada!" });
    }
  } catch (err) {
    console.error("Erro ao excluir inspeção:", err);
    res.status(500).json({ message: "Erro ao excluir inspeção!" });
  }
});

router.get("/api/editar_inspecao/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await promisePool.query(
      "SELECT * FROM inspecoes WHERE id = ?",
      [id]
    );
    if (rows.length > 0) {
      res.status(200).json(rows[0]);
    } else {
      res.status(404).json({ message: "Inspeção não encontrada!" });
    }
  } catch (err) {
    console.error("Erro ao buscar dados da inspeção para edição:", err);
    res.status(500).json({ message: "Erro ao buscar dados da inspeção!" });
  }
});

router.post("/api/editar_inspecao/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  const {
    placa,
    matricula,
    data_inspecao,
    km_atual,
    horimetro,
    observacoes,
    ...checklistFields
  } = req.body;

  if (!matricula || !placa || !data_inspecao || !km_atual || !horimetro) {
    return res
      .status(400)
      .json({ message: "Dados básicos da inspeção faltando!" });
  }
  if (parseFloat(km_atual) < 0 || parseFloat(horimetro) < 0) {
    return res
      .status(400)
      .json({ message: "KM atual e horímetro devem ser valores positivos!" });
  }
  try {
    const camposParaAtualizar = {
      placa,
      matricula,
      data_inspecao,
      km_atual,
      horimetro,
      observacoes: observacoes || null,
      ...checklistFields,
    };
    for (const key in camposParaAtualizar) {
      if (camposParaAtualizar[key] === undefined) {
        delete camposParaAtualizar[key];
      }
    }
    const camposNomes = Object.keys(camposParaAtualizar);
    const setClauses = camposNomes.map((campo) => `${campo} = ?`).join(", ");
    const values = camposNomes.map((campo) => camposParaAtualizar[campo]);

    if (camposNomes.length === 0) {
      return res.status(400).json({ message: "Nenhum dado para atualizar!" });
    }
    const query = `UPDATE inspecoes SET ${setClauses} WHERE id = ?`;
    values.push(id);
    const [result] = await promisePool.query(query, values);

    if (result.affectedRows > 0) {
      await registrarAuditoria(
        req.user.matricula,
        "Editar Inspeção",
        `Inspeção editada com ID: ${id}`
      );
      res.status(200).json({ message: "Inspeção atualizada com sucesso!" });
    } else {
      res
        .status(404)
        .json({ message: "Inspeção não encontrada para atualização!" });
    }
  } catch (err) {
    console.error("Erro ao atualizar inspeção:", err);
    res.status(500).json({ message: "Erro ao atualizar inspeção!" });
  }
});

router.get("/api/veiculos_oleo", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      "SELECT id, placa, modelo FROM veiculos ORDER BY placa"
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao buscar veículos para troca de óleo:", err);
    res.status(500).json({ message: "Erro ao buscar veículos!" });
  }
});

router.get("/api/tecnicos_oleo", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      "SELECT id, matricula, nome FROM users WHERE cargo IN ('Técnico', 'Engenheiro') ORDER BY nome"
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao buscar técnicos para troca de óleo:", err);
    res.status(500).json({ message: "Erro ao buscar técnicos!" });
  }
});

router.post("/api/registrar_oleo", autenticar, async (req, res) => {
  const { veiculo_id, responsavel_id, data_troca, horimetro, observacoes } =
    req.body;
  if (!veiculo_id || !responsavel_id || !data_troca || !horimetro) {
    return res
      .status(400)
      .json({ message: "Preencha todos os campos obrigatórios!" });
  }
  if (parseFloat(horimetro) < 0) {
    return res
      .status(400)
      .json({ message: "Horímetro deve ser um valor positivo!" });
  }
  try {
    const [veiculo] = await promisePool.query(
      "SELECT id, placa FROM veiculos WHERE id = ?",
      [veiculo_id]
    );
    if (veiculo.length === 0)
      return res.status(404).json({ message: "Veículo não encontrado!" });
    const placa = veiculo[0].placa;

    const [responsavel] = await promisePool.query(
      'SELECT id, matricula FROM users WHERE id = ? AND cargo IN ("Técnico", "Engenheiro")',
      [responsavel_id]
    );
    if (responsavel.length === 0)
      return res.status(404).json({
        message: "Responsável técnico não encontrado ou não autorizado!",
      });

    const [ultimaInspecao] = await promisePool.query(
      "SELECT horimetro FROM inspecoes WHERE placa = ? ORDER BY data_inspecao DESC LIMIT 1",
      [placa]
    );
    const [ultimaTrocaOleo] = await promisePool.query(
      "SELECT horimetro FROM trocas_oleo WHERE veiculo_id = ? ORDER BY data_troca DESC LIMIT 1",
      [veiculo_id]
    );
    const horimetroInspecao = ultimaInspecao[0]?.horimetro || 0;
    const horimetroUltimaTroca = ultimaTrocaOleo[0]?.horimetro || 0;

    if (parseFloat(horimetro) < parseFloat(horimetroUltimaTroca)) {
      return res.status(400).json({
        message: `O horímetro informado (${horimetro}) deve ser maior ou igual ao último registrado para troca de óleo (${horimetroUltimaTroca})`,
      });
    }
    const horimetroProximaTroca = Math.floor(parseFloat(horimetro) + 300);
    const query = `INSERT INTO trocas_oleo (veiculo_id, responsavel_id, data_troca, horimetro, observacoes) VALUES (?, ?, ?, ?, ?)`;
    const values = [
      veiculo_id,
      responsavel_id,
      data_troca,
      horimetro,
      observacoes || null,
    ];
    const [result] = await promisePool.query(query, values);

    await registrarAuditoria(
      req.user.matricula,
      "Registro de Troca de Óleo",
      `Troca de óleo registrada para veículo ID: ${veiculo_id} - Placa: ${placa}`
    );
    res.status(201).json({
      message: "Troca de óleo registrada com sucesso!",
      id: result.insertId,
      horimetros: {
        atual: parseFloat(horimetro),
        ultima_inspecao: parseFloat(horimetroInspecao),
        ultima_troca: parseFloat(horimetroUltimaTroca),
        proxima_troca: horimetroProximaTroca,
      },
      placa: placa,
      data_troca: data_troca,
    });
  } catch (err) {
    console.error("Erro ao registrar troca de óleo:", err);
    res.status(500).json({
      message: "Erro ao registrar troca de óleo!",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

router.get("/api/historico_oleo/:veiculo_id?", autenticar, async (req, res) => {
  const { veiculo_id } = req.params;
  try {
    let query = `
            SELECT t.id, DATE_FORMAT(t.data_troca, '%d/%m/%Y') as data_troca_formatada, t.horimetro, t.observacoes, 
                   DATE_FORMAT(t.created_at, '%d/%m/%Y %H:%i:%s') as data_registro, 
                   v.placa, v.modelo, u.nome as responsavel_nome, u.matricula as responsavel_matricula
            FROM trocas_oleo t
            JOIN users u ON t.responsavel_id = u.id
            LEFT JOIN veiculos v ON t.veiculo_id = v.id
        `;
    const params = [];
    if (veiculo_id && veiculo_id !== "undefined" && veiculo_id !== "null") {
      query += " WHERE t.veiculo_id = ?";
      params.push(veiculo_id);
    }
    query += " ORDER BY t.data_troca DESC, t.id DESC";
    const [rows] = await promisePool.query(query, params);
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao buscar histórico de trocas:", err);
    res.status(500).json({ message: "Erro ao buscar histórico de trocas!" });
  }
});

router.get("/api/ultimo_horimetro", autenticar, async (req, res) => {
  const { placa } = req.query;
  if (!placa) return res.status(400).json({ message: "Placa é obrigatória!" });
  try {
    const [rows] = await promisePool.query(
      "SELECT horimetro FROM inspecoes WHERE placa = ? ORDER BY data_inspecao DESC LIMIT 1",
      [placa]
    );
    if (rows.length > 0) {
      res.status(200).json({ horimetro: rows[0].horimetro });
    } else {
      res
        .status(404)
        .json({ message: "Nenhuma inspeção encontrada para esta placa." });
    }
  } catch (error) {
    console.error("Erro ao buscar horímetro:", error);
    res.status(500).json({ message: "Erro ao buscar horímetro." });
  }
});

router.get("/api/proxima_troca_oleo", autenticar, async (req, res) => {
  try {
    const [veiculos] = await promisePool.query(
      `SELECT id, placa, modelo FROM veiculos ORDER BY placa`
    );
    const cards = await Promise.all(
      veiculos.map(async (veiculo) => {
        const { id, placa, modelo } = veiculo;
        const [inspecao] = await promisePool.query(
          `SELECT FLOOR(horimetro) as horimetro FROM inspecoes WHERE placa = ? ORDER BY data_inspecao DESC, id DESC LIMIT 1`,
          [placa]
        );
        const [troca] = await promisePool.query(
          `SELECT FLOOR(horimetro) as horimetro FROM trocas_oleo WHERE veiculo_id = ? ORDER BY data_troca DESC, id DESC LIMIT 1`,
          [id]
        );
        const horimetroInspecao = inspecao[0]?.horimetro || 0;
        const ultimaTroca = troca[0]?.horimetro || 0;
        const horimetroAtual = horimetroInspecao;
        const proximaTroca = ultimaTroca + 300;
        return {
          id,
          placa,
          modelo,
          horimetroInspecao,
          ultimaTroca,
          horimetroAtual,
          proximaTroca,
          horasRestantes: Math.max(0, proximaTroca - horimetroAtual),
        };
      })
    );
    res.status(200).json(cards);
  } catch (error) {
    console.error("Erro ao gerar dados para próxima troca de óleo:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao carregar dados",
      error: error.message,
    });
  }
});

router.get("/api/gerar_pdf_veiculos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await promisePool.query(
      "SELECT placa FROM inspecoes WHERE id = ?",
      [id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: "Inspeção não encontrada!" });
    const { placa } = rows[0];
    const placaFormatada = String(placa || "SEM_PLACA").replace(
      /[^a-zA-Z0-9]/g,
      "_"
    );
    const nomeArquivo = `inspecao_${id}_${placaFormatada}.pdf`;
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    const url = `${req.protocol}://${req.get(
      "host"
    )}/relatorio_publico_veiculos?id=${id}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    const headerFooterStyle = `font-family: 'Poppins', Arial, sans-serif; font-size: 9px; color: #333; width: 100%;`;
    const primaryColorForHeader = "#004494";
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "40mm", right: "10mm", bottom: "25mm", left: "10mm" },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="${headerFooterStyle} padding: 0 10mm; height: 30mm; display: flex; flex-direction: column; justify-content: center; align-items: center; border-bottom: 1px solid #ddd;">
          <div style="font-size: 14px; color: ${primaryColorForHeader}; font-weight: 600;">Relatório de Inspeção Veicular</div>
          <div style="font-size: 10px; color: #555;">SULGIPE - LINHA VIVA SYSTEM</div>
        </div>
      `,
      footerTemplate: `
        <div style="${headerFooterStyle} padding: 0 10mm; height: 15mm; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #ddd;">
          <span>Gerado em: <span class="date"></span></span>
          <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
        </div>
      `,
    });
    await browser.close();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nomeArquivo}"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Erro ao gerar PDF de inspeção de veículo:", err);
    if (!res.headersSent) {
      res.status(500).json({
        message: "Erro ao gerar PDF!",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  }
});

router.get("/api/inspecoes_publico/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await promisePool.query(
      "SELECT * FROM inspecoes WHERE id = ?",
      [id]
    );
    if (rows.length > 0) {
      res.status(200).json(rows[0]);
    } else {
      res.status(404).json({ message: "Inspeção não encontrada!" });
    }
  } catch (err) {
    console.error("Erro ao buscar inspeção pública:", err);
    res.status(500).json({ message: "Erro ao buscar inspeção!" });
  }
});

router.delete("/api/trocas_oleo/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  const matriculaUsuario = req.user ? req.user.matricula : "SYSTEM_UNKNOWN";
  if (!id || isNaN(parseInt(id))) {
    return res
      .status(400)
      .json({ message: "ID do registro inválido ou não fornecido!" });
  }
  try {
    const [recordInfo] = await promisePool.query(
      "SELECT v.placa FROM trocas_oleo t LEFT JOIN veiculos v ON t.veiculo_id = v.id WHERE t.id = ?",
      [id]
    );
    const placa =
      recordInfo.length > 0 && recordInfo[0] ? recordInfo[0].placa : "N/A";
    const [result] = await promisePool.query(
      "DELETE FROM trocas_oleo WHERE id = ?",
      [id]
    );
    if (result.affectedRows > 0) {
      await registrarAuditoria(
        matriculaUsuario,
        "Excluir Registro Troca Óleo",
        `Registro de troca de óleo ID: ${id} (Placa: ${placa}) excluído.`
      );
      res
        .status(200)
        .json({ message: "Registro de troca de óleo excluído com sucesso!" });
    } else {
      res.status(404).json({
        message: `Registro de troca de óleo com ID ${id} não encontrado para exclusão!`,
      });
    }
  } catch (err) {
    console.error(`Erro ao excluir registro de troca de óleo ID ${id}:`, err);
    res.status(500).json({
      message:
        "Erro interno do servidor ao tentar excluir registro de troca de óleo.",
    });
  }
});

router.get("/api/frota_inventario", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      "SELECT id, codigo, placa, nome, situacao, tipo_veiculo, ano_fabricacao, DATE_FORMAT(data_aquisicao, '%d/%m/%Y') as data_aquisicao, cor, descricao FROM frota_inventario ORDER BY nome ASC"
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao buscar veículos do inventário:", err);
    res.status(500).json({ message: "Erro ao buscar veículos do inventário!" });
  }
});

router.post("/api/frota_inventario", autenticar, async (req, res) => {
  const {
    codigo,
    placa,
    nome,
    situacao,
    tipo_veiculo,
    descricao,
    ano_fabricacao,
    data_aquisicao,
    cor,
  } = req.body;
  const matriculaUsuario = req.user.matricula;

  if (!placa || !nome || !situacao || !tipo_veiculo || !data_aquisicao) {
    return res
      .status(400)
      .json({ message: "Campos obrigatórios estão faltando!" });
  }
  try {
    const query = `
      INSERT INTO frota_inventario 
      (codigo, placa, nome, situacao, tipo_veiculo, descricao, ano_fabricacao, data_aquisicao, cor) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await promisePool.query(query, [
      codigo || null,
      placa,
      nome,
      situacao,
      tipo_veiculo,
      descricao || null,
      ano_fabricacao || null,
      data_aquisicao,
      cor || null,
    ]);
    await registrarAuditoria(
      matriculaUsuario,
      "Cadastro de Veículo",
      `Veículo placa: ${placa}, nome: ${nome} cadastrado.`
    );
    res.status(201).json({
      message: "Veículo cadastrado com sucesso!",
      id: result.insertId,
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ message: "Placa ou código já cadastrado." });
    }
    console.error("Erro ao cadastrar veículo:", err);
    res.status(500).json({ message: "Erro interno ao cadastrar o veículo." });
  }
});

router.delete("/api/frota_inventario/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  const matriculaUsuario = req.user.matricula;
  try {
    const [veiculo] = await promisePool.query(
      "SELECT placa FROM frota_inventario WHERE id = ?",
      [id]
    );
    if (veiculo.length === 0) {
      return res.status(404).json({ message: "Veículo não encontrado." });
    }
    const placa = veiculo[0].placa;
    const [result] = await promisePool.query(
      "DELETE FROM frota_inventario WHERE id = ?",
      [id]
    );
    if (result.affectedRows > 0) {
      await registrarAuditoria(
        matriculaUsuario,
        "Exclusão de Veículo",
        `Veículo com ID: ${id} e Placa: ${placa} foi excluído.`
      );
      res.status(200).json({ message: "Veículo excluído com sucesso!" });
    } else {
      res.status(404).json({ message: "Veículo não encontrado." });
    }
  } catch (err) {
    console.error("Erro ao excluir veículo:", err);
    res.status(500).json({ message: "Erro ao excluir veículo." });
  }
});

router.get("/api/frota/motoristas_crud", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      "SELECT id, matricula, nome FROM frota_motorista ORDER BY nome ASC"
    );
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar motoristas (CRUD):", err);
    res.status(500).json({ message: "Erro interno ao buscar motoristas." });
  }
});

router.post("/api/frota/motoristas_crud", autenticar, async (req, res) => {
  const { matricula, nome } = req.body;
  const usuarioLogadoMatricula = req.user.matricula;
  if (!matricula || !nome) {
    return res
      .status(400)
      .json({ message: "Matrícula e nome são obrigatórios." });
  }
  try {
    const [existing] = await promisePool.query(
      "SELECT id FROM frota_motorista WHERE matricula = ?",
      [matricula]
    );
    if (existing.length > 0) {
      return res
        .status(409)
        .json({ message: "Matrícula já cadastrada para outro motorista." });
    }
    const sql = "INSERT INTO frota_motorista (matricula, nome) VALUES (?, ?)";
    const [result] = await promisePool.query(sql, [matricula, nome]);
    if (result.affectedRows === 1) {
      const novoMotoristaId = result.insertId;
      await registrarAuditoria(
        usuarioLogadoMatricula,
        "CADASTRO_MOTORISTA_CRUD",
        `Motorista ID ${novoMotoristaId} (Matrícula: ${matricula}, Nome: ${nome}) cadastrado via CRUD.`
      );
      res.status(201).json({
        message: "Motorista cadastrado com sucesso!",
        id: novoMotoristaId,
      });
    } else {
      throw new Error("Nenhuma linha afetada, falha ao inserir motorista.");
    }
  } catch (err) {
    console.error("Erro ao cadastrar motorista (CRUD):", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Matrícula já cadastrada." });
    }
    res.status(500).json({ message: "Erro interno ao cadastrar motorista." });
  }
});

router.delete(
  "/api/frota/motoristas_crud/:id",
  autenticar,
  async (req, res) => {
    const { id } = req.params;
    const usuarioLogadoMatricula = req.user.matricula;
    if (!id) {
      return res
        .status(400)
        .json({ message: "ID do motorista é obrigatório." });
    }
    let connection;
    try {
      connection = await promisePool.getConnection();
      await connection.beginTransaction();
      const [motoristas] = await connection.query(
        "SELECT matricula, nome FROM frota_motorista WHERE id = ?",
        [id]
      );
      const motoristaParaAuditoria = motoristas[0];
      const [result] = await connection.query(
        "DELETE FROM frota_motorista WHERE id = ?",
        [id]
      );
      if (result.affectedRows === 1) {
        if (motoristaParaAuditoria) {
          await registrarAuditoria(
            usuarioLogadoMatricula,
            "EXCLUSAO_MOTORISTA_CRUD",
            `Motorista ID ${id} (Matrícula: ${motoristaParaAuditoria.matricula}, Nome: ${motoristaParaAuditoria.nome}) excluído via CRUD.`,
            connection
          );
        } else {
          await registrarAuditoria(
            usuarioLogadoMatricula,
            "EXCLUSAO_MOTORISTA_CRUD",
            `Motorista ID ${id} excluído via CRUD (dados não puderam ser recuperados para auditoria detalhada).`,
            connection
          );
        }
        await connection.commit();
        res.json({ message: "Motorista excluído com sucesso." });
      } else {
        await connection.rollback();
        res.status(404).json({ message: "Motorista não encontrado." });
      }
    } catch (err) {
      if (connection) await connection.rollback();
      console.error("Erro ao excluir motorista (CRUD):", err);
      res.status(500).json({ message: "Erro interno ao excluir motorista." });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.get("/api/frota/estoque_crud", autenticar, async (req, res) => {
  try {
    let query = "SELECT id, cod, nome, unid FROM frota_pçs";
    const queryParams = [];
    const conditions = [];

    if (req.query.cod) {
      conditions.push("cod LIKE ?");
      queryParams.push(`${req.query.cod}%`);
    }
    if (req.query.nome) {
      conditions.push("nome LIKE ?");
      queryParams.push(`%${req.query.nome}%`);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY nome ASC";

    const [rows] = await promisePool.query(query, queryParams);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar itens de estoque (CRUD):", err);
    res
      .status(500)
      .json({ message: "Erro interno ao buscar itens de estoque." });
  }
});
router.post("/api/frota/estoque_crud", autenticar, async (req, res) => {
  const { cod, nome, unid } = req.body;
  const usuarioLogadoMatricula = req.user.matricula;

  if (!cod || !nome) {
    return res
      .status(400)
      .json({ message: "Código e Nome da peça são obrigatórios." });
  }

  try {
    const [existing] = await promisePool.query(
      "SELECT id FROM frota_pçs WHERE cod = ?",
      [cod]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: "Código da peça já cadastrado." });
    }

    const sql = "INSERT INTO frota_pçs (cod, nome, unid) VALUES (?, ?, ?)";
    const [result] = await promisePool.query(sql, [cod, nome, unid || null]);

    if (result.affectedRows === 1) {
      const novoItemId = result.insertId;
      await registrarAuditoria(
        usuarioLogadoMatricula,
        "CADASTRO_PECA_ESTOQUE",
        `Peça ID ${novoItemId} (Código: ${cod}, Nome: ${nome}) cadastrada no estoque.`
      );
      res.status(201).json({
        message: "Peça cadastrada no estoque com sucesso!",
        id: novoItemId,
      });
    } else {
      throw new Error(
        "Nenhuma linha afetada, falha ao inserir peça no estoque."
      );
    }
  } catch (err) {
    console.error("Erro ao cadastrar peça no estoque (CRUD):", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Matrícula já cadastrada." });
    }
    res
      .status(500)
      .json({ message: "Erro interno ao cadastrar peça no estoque." });
  }
});

router.delete("/api/frota/estoque_crud/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  const usuarioLogadoMatricula = req.user.matricula;

  if (!id) {
    return res.status(400).json({ message: "ID da peça é obrigatório." });
  }

  let connection;
  try {
    connection = await promisePool.getConnection();
    await connection.beginTransaction();

    const [pecas] = await connection.query(
      "SELECT cod, nome FROM frota_pçs WHERE id = ?",
      [id]
    );
    const pecaParaAuditoria = pecas[0];

    const [result] = await connection.query(
      "DELETE FROM frota_pçs WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 1) {
      if (pecaParaAuditoria) {
        await registrarAuditoria(
          usuarioLogadoMatricula,
          "EXCLUSAO_PECA_ESTOQUE",
          `Peça ID ${id} (Código: ${pecaParaAuditoria.cod}, Nome: ${pecaParaAuditoria.nome}) excluída do estoque.`,
          connection
        );
      } else {
        await registrarAuditoria(
          usuarioLogadoMatricula,
          "EXCLUSAO_PECA_ESTOQUE",
          `Peça ID ${id} excluída do estoque (dados não puderam ser recuperados para auditoria detalhada).`,
          connection
        );
      }
      await connection.commit();
      res.json({ message: "Peça excluída do estoque com sucesso." });
    } else {
      await connection.rollback();
      res.status(404).json({ message: "Peça não encontrada no estoque." });
    }
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Erro ao excluir peça do estoque (CRUD):", err);
    res
      .status(500)
      .json({ message: "Erro interno ao excluir peça do estoque." });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
