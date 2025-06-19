const express = require("express");
const router = express.Router();
const path = require("path");
const { promisePool, projectRootDir } = require("../init"); // Ajuste o caminho conforme necessário
const { autenticar, registrarAuditoria } = require("../auth"); // Ajuste o caminho conforme necessário

// Middlewares de Permissão (Idealmente, centralizar no futuro)
const podeAcessarSubestacoesDashboard = (req, res, next) => {
  const cargosPermitidos = [
    "ADMIN",
    "Engenheiro",
    "Encarregado",
    "ADM",
    "Gerente",
    "Inspetor",
    "Técnico",
    "Estagiário",
  ];
  if (req.user && cargosPermitidos.includes(req.user.cargo)) {
    next();
  } else {
    res
      .status(403)
      .send(
        "<h1>Acesso Negado</h1><p>Você não tem permissão para acessar esta área.</p><p><a href='/dashboard'>Voltar ao Dashboard Principal</a></p>"
      );
  }
};

const podeGerenciarPaginaSubestacoes = (req, res, next) => {
  const cargosPermitidos = [
    "ADMIN",
    "Engenheiro",
    "Encarregado",
    "ADM",
    "Gerente",
    "Inspetor",
    "Técnico",
    "Estagiário",
  ];
  if (req.user && cargosPermitidos.includes(req.user.cargo)) {
    next();
  } else {
    res.status(403).json({ message: "Acesso negado." });
  }
};

const podeModificarSubestacoes = (req, res, next) => {
  const cargosPermitidos = [
    "ADMIN",
    "Engenheiro",
    "Encarregado",
    "ADM",
    "Gerente",
  ];
  if (req.user && cargosPermitidos.includes(req.user.cargo)) {
    next();
  } else {
    res.status(403).json({ message: "Acesso negado." });
  }
};

const podeModificarEquipamentos = (req, res, next) => {
  const cargosPermitidos = [
    "ADMIN",
    "Engenheiro",
    "Técnico",
    "Encarregado",
    "ADM",
    "Gerente",
    "Inspetor",
  ];
  if (req.user && cargosPermitidos.includes(req.user.cargo)) {
    next();
  } else {
    res.status(403).json({ message: "Acesso negado." });
  }
};

// Função de Verificação (Idealmente, centralizar no futuro)
async function verificarSubestacaoExiste(req, res, next) {
  const { subestacaoId } = req.params;
  if (isNaN(parseInt(subestacaoId, 10))) {
    return res
      .status(400)
      .json({ message: `ID da subestação inválido: ${subestacaoId}` });
  }
  try {
    const [subestacao] = await promisePool.query(
      "SELECT Id FROM subestacoes WHERE Id = ?",
      [subestacaoId]
    );
    if (subestacao.length === 0) {
      return res
        .status(404)
        .json({ message: `Subestação com ID ${subestacaoId} não encontrada.` });
    }
    req.subestacaoId = parseInt(subestacaoId, 10);
    next();
  } catch (error) {
    console.error("Erro ao verificar subestação:", error);
    res.status(500).json({ message: "Erro interno ao verificar subestação." });
  }
}

// Rotas para Páginas HTML
router.get(
  "/subestacoes-dashboard",
  autenticar,
  podeAcessarSubestacoesDashboard,
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/subestacoes-dashboard.html"
      )
    );
  }
);

router.get(
  "/pagina-subestacoes-admin",
  autenticar,
  podeGerenciarPaginaSubestacoes,
  (req, res) => {
    res.sendFile(
      path.join(projectRootDir, "public/pages/subestacoes/subestacoes.html")
    );
  }
);

// Rotas API para Subestações (CRUD)
router.get("/subestacoes", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      "SELECT Id, sigla, nome, Ano_Inicio_Op FROM subestacoes ORDER BY nome ASC"
    );
    res.json(rows);
  } catch (error) {
    console.error("Erro ao buscar subestações:", error);
    res.status(500).json({ message: "Erro interno ao buscar subestações." });
  }
});

router.get("/subestacoes/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id, 10))) {
    return res
      .status(400)
      .json({ message: `ID da subestação inválido: ${id}` });
  }
  try {
    const [rows] = await promisePool.query(
      "SELECT Id, sigla, nome, Ano_Inicio_Op FROM subestacoes WHERE Id = ?",
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Subestação não encontrada." });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error("Erro ao buscar subestação por ID:", error);
    res.status(500).json({ message: "Erro interno ao buscar subestação." });
  }
});

router.post(
  "/subestacoes",
  autenticar,
  podeModificarSubestacoes,
  async (req, res) => {
    const { sigla, nome, Ano_Inicio_Op } = req.body;
    if (!sigla || !nome) {
      return res
        .status(400)
        .json({ message: "Sigla e Nome são obrigatórios." });
    }
    let anoOperacao = null;
    if (Ano_Inicio_Op) {
      const anoNum = parseInt(Ano_Inicio_Op, 10);
      if (isNaN(anoNum) || anoNum < 1900 || anoNum > 2200) {
        return res
          .status(400)
          .json({ message: "Ano de Início de Operação inválido." });
      }
      anoOperacao = anoNum;
    }
    try {
      const [result] = await promisePool.query(
        "INSERT INTO subestacoes (sigla, nome, Ano_Inicio_Op) VALUES (?, ?, ?)",
        [sigla.toUpperCase(), nome, anoOperacao]
      );
      const newSubestacaoId = result.insertId;
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "CREATE_SUBESTACAO",
          `Subestação criada: ID ${newSubestacaoId}, Sigla: ${sigla}`
        );
      }
      res.status(201).json({
        id: newSubestacaoId,
        sigla: sigla.toUpperCase(),
        nome,
        Ano_Inicio_Op: anoOperacao,
        message: "Subestação criada com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao criar subestação:", error);
      if (error.code === "ER_DUP_ENTRY") {
        return res
          .status(409)
          .json({ message: "Erro ao criar subestação: Sigla já cadastrada." });
      }
      res.status(500).json({ message: "Erro interno ao criar subestação." });
    }
  }
);

router.put(
  "/subestacoes/:id",
  autenticar,
  podeModificarSubestacoes,
  async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id, 10))) {
      return res
        .status(400)
        .json({ message: `ID da subestação inválido: ${id}` });
    }
    const { sigla, nome, Ano_Inicio_Op } = req.body;
    if (!sigla || !nome) {
      return res
        .status(400)
        .json({ message: "Sigla e Nome são obrigatórios." });
    }
    let anoOperacao = undefined;
    if (Ano_Inicio_Op !== undefined) {
      if (Ano_Inicio_Op === null || String(Ano_Inicio_Op).trim() === "") {
        anoOperacao = null;
      } else {
        const anoNum = parseInt(Ano_Inicio_Op, 10);
        if (isNaN(anoNum) || anoNum < 1900 || anoNum > 2200) {
          return res
            .status(400)
            .json({ message: "Ano de Início de Operação inválido." });
        }
        anoOperacao = anoNum;
      }
    }
    try {
      const [currentSubestacao] = await promisePool.query(
        "SELECT sigla, nome, Ano_Inicio_Op FROM subestacoes WHERE Id = ?",
        [id]
      );
      if (currentSubestacao.length === 0) {
        return res
          .status(404)
          .json({ message: "Subestação não encontrada para atualização." });
      }
      const updateFields = {
        sigla: sigla.toUpperCase(),
        nome: nome,
        Ano_Inicio_Op:
          anoOperacao !== undefined
            ? anoOperacao
            : currentSubestacao[0].Ano_Inicio_Op,
      };
      await promisePool.query(
        "UPDATE subestacoes SET sigla = ?, nome = ?, Ano_Inicio_Op = ? WHERE Id = ?",
        [updateFields.sigla, updateFields.nome, updateFields.Ano_Inicio_Op, id]
      );
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "UPDATE_SUBESTACAO",
          `Subestação atualizada: ID ${id}`
        );
      }
      res.json({
        id: parseInt(id),
        ...updateFields,
        message: "Subestação atualizada com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao atualizar subestação:", error);
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          message:
            "Erro ao atualizar subestação: Sigla já cadastrada para outra subestação.",
        });
      }
      res
        .status(500)
        .json({ message: "Erro interno ao atualizar subestação." });
    }
  }
);

router.delete(
  "/subestacoes/:id",
  autenticar,
  podeModificarSubestacoes,
  async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id, 10))) {
      return res
        .status(400)
        .json({ message: `ID da subestação inválido: ${id}` });
    }
    try {
      const [equipamentos] = await promisePool.query(
        "SELECT COUNT(*) as count FROM infra_equip WHERE subest_id = ?",
        [id]
      );
      if (equipamentos[0].count > 0) {
        return res.status(409).json({
          message: `Não é possível excluir subestação: Existem ${equipamentos[0].count} equipamentos associados.`,
        });
      }
      const [servicos] = await promisePool.query(
        "SELECT COUNT(*) as count FROM servicos_subestacoes WHERE subestacao_id = ?",
        [id]
      );
      if (servicos[0].count > 0) {
        return res.status(409).json({
          message: `Não é possível excluir subestação: Existem ${servicos[0].count} serviços associados.`,
        });
      }
      const [inspecoes] = await promisePool.query(
        "SELECT COUNT(*) as count FROM inspecoes_subestacoes WHERE subestacao_id = ?",
        [id]
      );
      if (inspecoes[0].count > 0) {
        return res.status(409).json({
          message: `Não é possível excluir subestação: Existem ${inspecoes[0].count} inspeções associadas.`,
        });
      }
      const [result] = await promisePool.query(
        "DELETE FROM subestacoes WHERE Id = ?",
        [id]
      );
      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ message: "Subestação não encontrada para exclusão." });
      }
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "DELETE_SUBESTACAO",
          `Subestação excluída: ID ${id}`
        );
      }
      res.json({ message: "Subestação excluída com sucesso!" });
    } catch (error) {
      console.error("Erro ao excluir subestação:", error);
      if (error.code === "ER_ROW_IS_REFERENCED_2") {
        return res.status(409).json({
          message:
            "Não é possível excluir subestação: Existem registros associados em outras tabelas.",
        });
      }
      res.status(500).json({ message: "Erro interno ao excluir subestação." });
    }
  }
);

// Rotas API para Equipamentos (CRUD)
router.get(
  "/subestacoes/:subestacaoId/equipamentos",
  autenticar,
  verificarSubestacaoExiste,
  async (req, res) => {
    try {
      const [rows] = await promisePool.query(
        `SELECT ie.id, ie.subest_id, ie.description, ie.tag, ie.serial_number, ie.model, ie.voltage_range, ie.status, DATE_FORMAT(ie.date_inst, '%Y-%m-%d') as date_inst FROM infra_equip ie WHERE ie.subest_id = ? ORDER BY ie.tag ASC`,
        [req.subestacaoId]
      );
      res.json(rows);
    } catch (error) {
      console.error("Erro ao buscar equipamentos:", error);
      res.status(500).json({ message: "Erro interno ao buscar equipamentos." });
    }
  }
);

router.post(
  "/subestacoes/:subestacaoId/equipamentos",
  autenticar,
  verificarSubestacaoExiste,
  podeModificarEquipamentos,
  async (req, res) => {
    const { subestacaoId } = req;
    const {
      description,
      tag,
      serial_number,
      model,
      voltage_range,
      status,
      date_inst,
    } = req.body;

    if (!tag) {
      return res
        .status(400)
        .json({ message: "TAG do equipamento é obrigatória." });
    }

    let dataInstalacao = date_inst;
    if (dataInstalacao) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInstalacao)) {
        try {
          const parsedDate = new Date(dataInstalacao);
          if (isNaN(parsedDate.getTime())) throw new Error("Data inválida");
          dataInstalacao = parsedDate.toISOString().split("T")[0];
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInstalacao))
            throw new Error("Formato inválido após conversão");
        } catch (e) {
          return res
            .status(400)
            .json({ message: "Data de Instalação inválida. Use YYYY-MM-DD." });
        }
      }
    } else {
      dataInstalacao = null;
    }

    try {
      const [result] = await promisePool.query(
        "INSERT INTO infra_equip (subest_id, description, tag, serial_number, model, voltage_range, status, date_inst) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          subestacaoId,
          description,
          tag.toUpperCase(),
          serial_number,
          model,
          voltage_range,
          status || "ATIVO",
          dataInstalacao,
        ]
      );
      const newEquipamentoId = result.insertId;
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "CREATE_EQUIPAMENTO_SUB",
          `Equipamento ID ${newEquipamentoId}, TAG: ${tag}, para Subestação ID: ${subestacaoId} criado.`
        );
      }
      res.status(201).json({
        id: newEquipamentoId,
        subest_id: subestacaoId,
        description,
        tag: tag.toUpperCase(),
        serial_number,
        model,
        voltage_range,
        status: status || "ATIVO",
        date_inst: dataInstalacao,
        message: "Equipamento criado com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao criar equipamento:", error);
      if (
        error.code === "ER_DUP_ENTRY" &&
        error.sqlMessage &&
        error.sqlMessage.includes("serial_number")
      ) {
        return res.status(409).json({
          message: "Erro ao criar equipamento: Número de série já cadastrado.",
        });
      }
      res.status(500).json({ message: "Erro interno ao criar equipamento." });
    }
  }
);

router.get(
  "/subestacoes/:subestacaoId/equipamentos/:equipamentoId",
  autenticar,
  verificarSubestacaoExiste,
  async (req, res) => {
    const { equipamentoId } = req.params;
    if (isNaN(parseInt(equipamentoId, 10))) {
      return res
        .status(400)
        .json({ message: `ID do equipamento inválido: ${equipamentoId}` });
    }
    try {
      const [rows] = await promisePool.query(
        `SELECT ie.id, ie.subest_id, ie.description, ie.tag, ie.serial_number, ie.model, ie.voltage_range, ie.status, DATE_FORMAT(ie.date_inst, '%Y-%m-%d') as date_inst FROM infra_equip ie WHERE ie.id = ? AND ie.subest_id = ?`,
        [equipamentoId, req.subestacaoId]
      );
      if (rows.length === 0) {
        return res.status(404).json({
          message: `Equipamento ID ${equipamentoId} não encontrado na subestação ${req.subestacaoId}.`,
        });
      }
      res.json(rows[0]);
    } catch (error) {
      console.error("Erro ao buscar equipamento:", error);
      res.status(500).json({ message: "Erro interno ao buscar equipamento." });
    }
  }
);

router.put(
  "/subestacoes/:subestacaoId/equipamentos/:equipamentoId",
  autenticar,
  verificarSubestacaoExiste,
  podeModificarEquipamentos,
  async (req, res) => {
    const { equipamentoId } = req.params;
    if (isNaN(parseInt(equipamentoId, 10))) {
      return res
        .status(400)
        .json({ message: `ID do equipamento inválido: ${equipamentoId}` });
    }
    const { subestacaoId } = req;
    const {
      description,
      tag,
      serial_number,
      model,
      voltage_range,
      status,
      date_inst,
    } = req.body;

    if (!tag) {
      return res
        .status(400)
        .json({ message: "TAG do equipamento é obrigatória." });
    }

    let dataInstalacao = undefined;
    if (date_inst !== undefined) {
      if (date_inst === null || String(date_inst).trim() === "") {
        dataInstalacao = null;
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date_inst)) {
        try {
          const parsedDate = new Date(date_inst);
          if (isNaN(parsedDate.getTime())) throw new Error("Data inválida");
          dataInstalacao = parsedDate.toISOString().split("T")[0];
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInstalacao))
            throw new Error("Formato inválido após conversão");
        } catch (e) {
          return res.status(400).json({
            message: "Data de Instalação inválida. Use YYYY-MM-DD ou null.",
          });
        }
      } else {
        dataInstalacao = date_inst;
      }
    }

    try {
      const [currentEquip] = await promisePool.query(
        "SELECT * FROM infra_equip WHERE id = ? AND subest_id = ?",
        [equipamentoId, subestacaoId]
      );
      if (currentEquip.length === 0) {
        return res.status(404).json({
          message: `Equipamento ID ${equipamentoId} não encontrado na subestação ${subestacaoId}.`,
        });
      }

      const updateData = {
        description:
          description !== undefined ? description : currentEquip[0].description,
        tag: tag.toUpperCase(),
        serial_number:
          serial_number !== undefined
            ? serial_number
            : currentEquip[0].serial_number,
        model: model !== undefined ? model : currentEquip[0].model,
        voltage_range:
          voltage_range !== undefined
            ? voltage_range
            : currentEquip[0].voltage_range,
        status: status !== undefined ? status : currentEquip[0].status,
        date_inst:
          dataInstalacao !== undefined
            ? dataInstalacao
            : currentEquip[0].date_inst,
      };

      await promisePool.query(
        "UPDATE infra_equip SET description = ?, tag = ?, serial_number = ?, model = ?, voltage_range = ?, status = ?, date_inst = ? WHERE id = ? AND subest_id = ?",
        [
          updateData.description,
          updateData.tag,
          updateData.serial_number,
          updateData.model,
          updateData.voltage_range,
          updateData.status,
          updateData.date_inst,
          equipamentoId,
          subestacaoId,
        ]
      );
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "UPDATE_EQUIPAMENTO_SUB",
          `Equipamento ID ${equipamentoId}, TAG: ${updateData.tag}, da Subestação ID: ${subestacaoId} atualizado.`
        );
      }
      res.json({
        id: parseInt(equipamentoId),
        subest_id: subestacaoId,
        ...updateData,
        message: "Equipamento atualizado com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao atualizar equipamento:", error);
      if (
        error.code === "ER_DUP_ENTRY" &&
        error.sqlMessage &&
        error.sqlMessage.includes("serial_number")
      ) {
        return res.status(409).json({
          message:
            "Erro ao atualizar equipamento: Número de série já cadastrado para outro equipamento.",
        });
      }
      res
        .status(500)
        .json({ message: "Erro interno ao atualizar equipamento." });
    }
  }
);

router.delete(
  "/subestacoes/:subestacaoId/equipamentos/:equipamentoId",
  autenticar,
  verificarSubestacaoExiste,
  podeModificarEquipamentos,
  async (req, res) => {
    const { equipamentoId } = req.params;
    if (isNaN(parseInt(equipamentoId, 10))) {
      return res
        .status(400)
        .json({ message: `ID do equipamento inválido: ${equipamentoId}` });
    }
    const { subestacaoId } = req;
    try {
      const [result] = await promisePool.query(
        "DELETE FROM infra_equip WHERE id = ? AND subest_id = ?",
        [equipamentoId, subestacaoId]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: `Equipamento ID ${equipamentoId} não encontrado na subestação ${subestacaoId} para exclusão.`,
        });
      }
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "DELETE_EQUIPAMENTO_SUB",
          `Equipamento ID ${equipamentoId} da Subestação ID: ${subestacaoId} excluído.`
        );
      }
      res.json({ message: "Equipamento excluído com sucesso!" });
    } catch (error) {
      console.error("Erro ao excluir equipamento:", error);
      res.status(500).json({ message: "Erro interno ao excluir equipamento." });
    }
  }
);

module.exports = router;
