const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs").promises;
const {
  promisePool,
  upload,
  projectRootDir,
  uploadsSubestacoesDir,
} = require("../init");
const { autenticar, registrarAuditoria } = require("../auth");

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
const podeGerenciarPaginaServicos = (req, res, next) => {
  const cargosPermitidos = [
    "ADMIN",
    "Engenheiro",
    "Encarregado",
    "Técnico",
    "ADM",
    "Gerente",
    "Inspetor",
    "Estagiário",
  ];
  if (req.user && cargosPermitidos.includes(req.user.cargo)) {
    next();
  } else {
    res.status(403).json({ message: "Acesso negado." });
  }
};
const podeModificarServicos = (req, res, next) => {
  const cargosPermitidos = [
    "ADMIN",
    "Engenheiro",
    "Encarregado",
    "Técnico",
    "ADM",
    "Gerente",
  ];
  if (req.user && cargosPermitidos.includes(req.user.cargo)) {
    next();
  } else {
    res.status(403).json({ message: "Acesso negado." });
  }
};
const podeGerenciarPaginaInspecoes = (req, res, next) => {
  const cargosPermitidos = [
    "ADMIN",
    "Engenheiro",
    "Técnico",
    "Inspetor",
    "Gerente",
    "Encarregado",
    "Estagiário",
  ];
  if (req.user && cargosPermitidos.includes(req.user.cargo)) {
    next();
  } else {
    res.status(403).json({ message: "Acesso negado." });
  }
};
const podeRealizarInspecao = (req, res, next) => {
  const cargosPermitidos = [
    "ADMIN",
    "Engenheiro",
    "Técnico",
    "Inspetor",
    "Encarregado",
    "Estagiário",
  ];
  if (req.user && cargosPermitidos.includes(req.user.cargo)) {
    next();
  } else {
    res.status(403).json({ message: "Acesso negado." });
  }
};
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

async function verificarInspecaoExiste(req, res, next) {
  const { inspecaoId } = req.params;
  if (isNaN(parseInt(inspecaoId, 10))) {
    return res
      .status(400)
      .json({ message: `ID da inspeção inválido: ${inspecaoId}` });
  }
  try {
    const [inspecao] = await promisePool.query(
      "SELECT id, formulario_inspecao_num FROM inspecoes_subestacoes WHERE id = ?",
      [inspecaoId]
    );
    if (inspecao.length === 0) {
      return res
        .status(404)
        .json({ message: `Inspeção com ID ${inspecaoId} não encontrada.` });
    }
    req.inspecao = inspecao[0];
    req.inspecaoId = parseInt(inspecaoId, 10);
    next();
  } catch (error) {
    console.error("Erro ao verificar inspeção:", error);
    res.status(500).json({ message: "Erro interno ao verificar inspeção." });
  }
}

async function verificarServicoExiste(req, res, next) {
  const { servicoId } = req.params;
  if (isNaN(parseInt(servicoId, 10))) {
    return res
      .status(400)
      .json({ message: `ID do serviço inválido: ${servicoId}` });
  }
  try {
    const [servicoRows] = await promisePool.query(
      "SELECT id, status, data_conclusao, observacoes_conclusao, processo FROM servicos_subestacoes WHERE id = ?",
      [servicoId]
    );
    if (servicoRows.length === 0) {
      return res
        .status(404)
        .json({ message: `Serviço com ID ${servicoId} não encontrado.` });
    }
    req.servico = servicoRows[0];
    next();
  } catch (error) {
    console.error("Erro ao verificar serviço:", error);
    res.status(500).json({ message: "Erro interno ao verificar serviço." });
  }
}

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
router.get(
  "/pagina-servicos-subestacoes",
  autenticar,
  podeGerenciarPaginaServicos,
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/servicos-subestacoes-servicos.html"
      )
    );
  }
);
router.get(
  "/pagina-checklist-inspecao-subestacao",
  autenticar,
  podeRealizarInspecao,
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/inspecoes-checklist-subestacoes.html"
      )
    );
  }
);
router.get(
  "/pagina-listagem-inspecoes-subestacoes",
  autenticar,
  podeGerenciarPaginaInspecoes,
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/listagem-inspecoes.html"
      )
    );
  }
);
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
    if (!tag)
      return res
        .status(400)
        .json({ message: "TAG do equipamento é obrigatória." });
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
        return res
          .status(409)
          .json({
            message:
              "Erro ao criar equipamento: Número de série já cadastrado.",
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
        return res
          .status(404)
          .json({
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
    if (!tag)
      return res
        .status(400)
        .json({ message: "TAG do equipamento é obrigatória." });
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
          return res
            .status(400)
            .json({
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
        return res
          .status(404)
          .json({
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
        return res
          .status(409)
          .json({
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
        return res
          .status(404)
          .json({
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
router.get(
  "/usuarios-responsaveis-para-servicos",
  autenticar,
  async (req, res) => {
    try {
      const cargosRelevantes = [
        "Técnico",
        "Engenheiro",
        "Gerente",
        "ADMIN",
        "ADM",
        "Inspetor",
      ];
      const placeholders = cargosRelevantes.map(() => "?").join(",");
      const query = `SELECT DISTINCT id, nome FROM users WHERE cargo IN (${placeholders}) ORDER BY nome ASC`;
      const [rows] = await promisePool.query(query, cargosRelevantes);
      res.json(rows);
    } catch (error) {
      console.error("Erro ao buscar usuários responsáveis:", error);
      res
        .status(500)
        .json({ message: "Erro interno ao buscar usuários responsáveis." });
    }
  }
);
router.get("/usuarios-encarregados", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      "SELECT id, nome FROM users WHERE cargo = 'Encarregado' ORDER BY nome ASC"
    );
    res.json(rows);
  } catch (error) {
    console.error("Erro ao buscar encarregados:", error);
    res.status(500).json({ message: "Erro interno ao buscar encarregados." });
  }
});
router.post(
  "/api/servicos-subestacoes",
  autenticar,
  podeModificarServicos,
  upload.array("anexosServico", 5),
  async (req, res) => {
    const {
      subestacao_id,
      processo,
      motivo,
      alimentador,
      equipamento_id,
      data_prevista,
      horario_inicio,
      horario_fim,
      responsavel_id,
      status,
      data_conclusao,
      observacoes_conclusao,
      encarregado_designado_id,
    } = req.body;
    const arquivos = req.files;
    if (
      !subestacao_id ||
      !processo ||
      !motivo ||
      !data_prevista ||
      !horario_inicio ||
      !horario_fim ||
      !responsavel_id
    ) {
      if (arquivos && arquivos.length > 0) {
        for (const file of arquivos) {
          try {
            await fs.unlink(file.path);
          } catch (e) {}
        }
      }
      return res.status(400).json({ message: "Campos obrigatórios faltando." });
    }
    if (status === "CONCLUIDO" && !data_conclusao) {
      if (arquivos && arquivos.length > 0) {
        for (const file of arquivos) {
          try {
            await fs.unlink(file.path);
          } catch (e) {}
        }
      }
      return res
        .status(400)
        .json({
          message: "Data de conclusão é obrigatória para serviços concluídos.",
        });
    }
    const connection = await promisePool.getConnection();
    let novoServicoId;
    let arquivosMovidosComSucesso = [];
    try {
      await connection.beginTransaction();
      const equipamentoIdFinal =
        equipamento_id &&
        equipamento_id !== "" &&
        !isNaN(parseInt(equipamento_id))
          ? parseInt(equipamento_id)
          : null;
      const dataConclusaoFinal = status === "CONCLUIDO" ? data_conclusao : null;
      const observacoesConclusaoFinal =
        status === "CONCLUIDO" ? observacoes_conclusao : null;
      const encarregadoIdFinal =
        encarregado_designado_id && !isNaN(parseInt(encarregado_designado_id))
          ? parseInt(encarregado_designado_id)
          : null;
      const [resultServico] = await connection.query(
        `INSERT INTO servicos_subestacoes (subestacao_id, processo, motivo, alimentador, equipamento_id, data_prevista, horario_inicio, horario_fim, responsavel_id, status, data_conclusao, observacoes_conclusao, encarregado_designado_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          parseInt(subestacao_id),
          processo,
          motivo,
          alimentador,
          equipamentoIdFinal,
          data_prevista,
          horario_inicio,
          horario_fim,
          parseInt(responsavel_id),
          status || "PROGRAMADO",
          dataConclusaoFinal,
          observacoesConclusaoFinal,
          encarregadoIdFinal,
        ]
      );
      novoServicoId = resultServico.insertId;
      let anexosSalvosInfo = [];
      if (arquivos && arquivos.length > 0) {
        const servicoUploadDir = path.join(
          uploadsSubestacoesDir,
          "servicos",
          `servico_${String(novoServicoId)}`
        );
        await fs.mkdir(servicoUploadDir, { recursive: true });
        for (const file of arquivos) {
          const nomeUnicoArquivo = `${Date.now()}_${file.originalname.replace(
            /[^a-zA-Z0-9.\-_]/g,
            "_"
          )}`;
          const caminhoDestino = path.join(servicoUploadDir, nomeUnicoArquivo);
          const caminhoRelativoServidor = `servicos/servico_${novoServicoId}/${nomeUnicoArquivo}`;
          await fs.rename(file.path, caminhoDestino);
          arquivosMovidosComSucesso.push(caminhoDestino);
          let categoriaAnexoFinal = "DOCUMENTO_REGISTRO";
          const [resultAnexo] = await connection.query(
            `INSERT INTO servicos_subestacoes_anexos (id_servico, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              novoServicoId,
              file.originalname,
              `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
              file.mimetype,
              file.size,
              categoriaAnexoFinal,
            ]
          );
          anexosSalvosInfo.push({
            id: resultAnexo.insertId,
            nome_original: file.originalname,
            caminho_servidor: `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
          });
        }
      }
      await connection.commit();
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "CREATE_SERVICO_SUBESTACAO",
          `Serviço de Subestação ID ${novoServicoId} criado. Processo: ${processo}`,
          connection
        );
      }
      res
        .status(201)
        .json({
          id: novoServicoId,
          message: "Serviço de subestação registrado com sucesso!",
          anexos: anexosSalvosInfo,
        });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao criar serviço de subestação:", error);
      for (const caminho of arquivosMovidosComSucesso) {
        try {
          await fs.unlink(caminho);
        } catch (e) {}
      }
      if (arquivos && arquivos.length > 0) {
        for (const file of arquivos) {
          if (
            file.path &&
            (file.path.includes("temp") || file.path.includes("upload_"))
          ) {
            try {
              await fs.access(file.path);
              await fs.unlink(file.path);
            } catch (e) {}
          }
        }
      }
      if (
        error.code === "ER_DUP_ENTRY" &&
        error.sqlMessage &&
        error.sqlMessage.includes("processo")
      ) {
        return res
          .status(409)
          .json({
            message:
              "Erro ao criar serviço: Número de Processo/OS já cadastrado.",
          });
      }
      res
        .status(500)
        .json({
          message: "Erro interno ao criar serviço de subestação.",
          detalhes: error.message,
        });
    } finally {
      if (connection) connection.release();
    }
  }
);
router.put(
  "/api/servicos-subestacoes/:servicoId",
  autenticar,
  podeModificarServicos,
  upload.array("anexosServico", 5),
  async (req, res) => {
    const { servicoId } = req.params;
    if (isNaN(parseInt(servicoId, 10))) {
      return res
        .status(400)
        .json({ message: `ID do serviço inválido: ${servicoId}` });
    }
    const {
      subestacao_id,
      processo,
      motivo,
      alimentador,
      equipamento_id,
      data_prevista,
      horario_inicio,
      horario_fim,
      responsavel_id,
      status,
      data_conclusao,
      observacoes_conclusao,
      encarregado_designado_id,
    } = req.body;
    const arquivosNovos = req.files;
    if (
      !subestacao_id ||
      !processo ||
      !motivo ||
      !data_prevista ||
      !horario_inicio ||
      !horario_fim ||
      !responsavel_id
    ) {
      if (arquivosNovos && arquivosNovos.length > 0) {
        for (const file of arquivosNovos) {
          try {
            await fs.unlink(file.path);
          } catch (e) {}
        }
      }
      return res.status(400).json({ message: "Campos obrigatórios faltando." });
    }
    if (status === "CONCLUIDO" && !data_conclusao) {
      if (arquivosNovos && arquivosNovos.length > 0) {
        for (const file of arquivosNovos) {
          try {
            await fs.unlink(file.path);
          } catch (e) {}
        }
      }
      return res
        .status(400)
        .json({
          message: "Data de conclusão é obrigatória para serviços concluídos.",
        });
    }
    const connection = await promisePool.getConnection();
    let arquivosMovidosComSucesso = [];
    try {
      await connection.beginTransaction();
      const equipamentoIdFinal =
        equipamento_id &&
        equipamento_id !== "" &&
        !isNaN(parseInt(equipamento_id))
          ? parseInt(equipamento_id)
          : null;
      const dataConclusaoFinal = status === "CONCLUIDO" ? data_conclusao : null;
      const observacoesConclusaoFinal =
        status === "CONCLUIDO" ? observacoes_conclusao : null;
      const encarregadoIdFinal =
        encarregado_designado_id && !isNaN(parseInt(encarregado_designado_id))
          ? parseInt(encarregado_designado_id)
          : null;
      const [updateResult] = await connection.query(
        `UPDATE servicos_subestacoes SET subestacao_id = ?, processo = ?, motivo = ?, alimentador = ?, equipamento_id = ?, data_prevista = ?, horario_inicio = ?, horario_fim = ?, responsavel_id = ?, status = ?, data_conclusao = ?, observacoes_conclusao = ?, encarregado_designado_id = ? WHERE id = ?`,
        [
          parseInt(subestacao_id),
          processo,
          motivo,
          alimentador,
          equipamentoIdFinal,
          data_prevista,
          horario_inicio,
          horario_fim,
          parseInt(responsavel_id),
          status,
          dataConclusaoFinal,
          observacoesConclusaoFinal,
          encarregadoIdFinal,
          servicoId,
        ]
      );
      if (updateResult.affectedRows === 0) {
        throw new Error("Serviço não encontrado ou nenhum dado alterado.");
      }
      let anexosSalvosInfo = [];
      if (arquivosNovos && arquivosNovos.length > 0) {
        const servicoUploadDir = path.join(
          uploadsSubestacoesDir,
          "servicos",
          `servico_${String(servicoId)}`
        );
        await fs.mkdir(servicoUploadDir, { recursive: true });
        for (const file of arquivosNovos) {
          const nomeUnicoArquivo = `${Date.now()}_${file.originalname.replace(
            /[^a-zA-Z0-9.\-_]/g,
            "_"
          )}`;
          const caminhoDestino = path.join(servicoUploadDir, nomeUnicoArquivo);
          const caminhoRelativoServidor = `servicos/servico_${servicoId}/${nomeUnicoArquivo}`;
          await fs.rename(file.path, caminhoDestino);
          arquivosMovidosComSucesso.push(caminhoDestino);
          const [resultAnexo] = await connection.query(
            `INSERT INTO servicos_subestacoes_anexos (id_servico, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              servicoId,
              file.originalname,
              `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
              file.mimetype,
              file.size,
              "DOCUMENTO_REGISTRO",
            ]
          );
          anexosSalvosInfo.push({
            id: resultAnexo.insertId,
            nome_original: file.originalname,
            caminho_servidor: `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
          });
        }
      }
      await connection.commit();
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "UPDATE_SERVICO_SUBESTACAO",
          `Serviço de Subestação ID ${servicoId} atualizado. Processo: ${processo}`,
          connection
        );
      }
      res.json({
        id: servicoId,
        message: "Serviço de subestação atualizado com sucesso!",
        anexosAdicionados: anexosSalvosInfo,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao atualizar serviço de subestação:", error);
      for (const caminho of arquivosMovidosComSucesso) {
        try {
          await fs.unlink(caminho);
        } catch (e) {}
      }
      if (arquivosNovos && arquivosNovos.length > 0) {
        for (const file of arquivosNovos) {
          if (
            file.path &&
            (file.path.includes("temp") || file.path.includes("upload_"))
          ) {
            try {
              await fs.access(file.path);
              await fs.unlink(file.path);
            } catch (e) {}
          }
        }
      }
      if (
        error.code === "ER_DUP_ENTRY" &&
        error.sqlMessage &&
        error.sqlMessage.includes("processo")
      ) {
        return res
          .status(409)
          .json({
            message:
              "Erro ao atualizar serviço: Número de Processo/OS já cadastrado para outro serviço.",
          });
      }
      res
        .status(500)
        .json({
          message: "Erro interno ao atualizar serviço de subestação.",
          detalhes: error.message,
        });
    } finally {
      if (connection) connection.release();
    }
  }
);
router.delete(
  "/api/servicos-subestacoes/:servicoId",
  autenticar,
  podeModificarServicos,
  async (req, res) => {
    const { servicoId } = req.params;
    if (isNaN(parseInt(servicoId, 10))) {
      return res
        .status(400)
        .json({ message: `ID do serviço inválido: ${servicoId}` });
    }
    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();
      const [anexos] = await connection.query(
        "SELECT caminho_servidor FROM servicos_subestacoes_anexos WHERE id_servico = ?",
        [servicoId]
      );
      await connection.query(
        "DELETE FROM servicos_subestacoes_anexos WHERE id_servico = ?",
        [servicoId]
      );
      const [result] = await connection.query(
        "DELETE FROM servicos_subestacoes WHERE id = ?",
        [servicoId]
      );
      if (result.affectedRows === 0) {
        await connection.rollback();
        return res
          .status(404)
          .json({ message: `Serviço com ID ${servicoId} não encontrado.` });
      }
      if (anexos.length > 0) {
        const servicoUploadDir = path.join(
          uploadsSubestacoesDir,
          "servicos",
          `servico_${String(servicoId)}`
        );
        for (const anexo of anexos) {
          const caminhoRelativoNoServidor = anexo.caminho_servidor.replace(
            /^\/upload_arquivos_subestacoes\//,
            ""
          );
          const caminhoCompleto = path.join(
            uploadsSubestacoesDir,
            caminhoRelativoNoServidor
          );
          try {
            await fs.access(caminhoCompleto);
            await fs.unlink(caminhoCompleto);
          } catch (err) {}
        }
        try {
          await fs.rm(servicoUploadDir, { recursive: true, force: true });
        } catch (err) {
          if (err.code !== "ENOENT") {
            console.warn(
              `Falha ao remover diretório de anexos do serviço ${servicoId} (${servicoUploadDir}): ${err.message}`
            );
          }
        }
      }
      await connection.commit();
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "DELETE_SERVICO_SUBESTACAO",
          `Serviço de Subestação ID ${servicoId} e seus anexos foram excluídos.`,
          connection
        );
      }
      res.json({
        message: `Serviço ID ${servicoId} e seus anexos foram excluídos com sucesso.`,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao excluir serviço de subestação:", error);
      res
        .status(500)
        .json({
          message: "Erro interno ao excluir serviço de subestação.",
          detalhes: error.message,
        });
    } finally {
      if (connection) connection.release();
    }
  }
);
router.get(
  "/api/servicos-subestacoes",
  autenticar,
  podeGerenciarPaginaServicos,
  async (req, res) => {
    try {
      let query = ` SELECT ss.id, ss.processo, ss.motivo, ss.alimentador, DATE_FORMAT(ss.data_prevista, '%Y-%m-%d') as data_prevista, ss.horario_inicio, ss.horario_fim, ss.status, DATE_FORMAT(ss.data_conclusao, '%Y-%m-%d') as data_conclusao, s.sigla as subestacao_sigla, s.nome as subestacao_nome, u.nome as responsavel_nome, e.tag as equipamento_tag, ss.subestacao_id, ss.responsavel_id, ss.equipamento_id, ud.nome as encarregado_designado_nome FROM servicos_subestacoes ss JOIN subestacoes s ON ss.subestacao_id = s.Id JOIN users u ON ss.responsavel_id = u.id LEFT JOIN infra_equip e ON ss.equipamento_id = e.id LEFT JOIN users ud ON ss.encarregado_designado_id = ud.id WHERE 1=1 `;
      const params = [];
      if (req.query.subestacao_id) {
        query += " AND ss.subestacao_id = ?";
        params.push(req.query.subestacao_id);
      }
      if (req.query.status) {
        query += " AND ss.status = ?";
        params.push(req.query.status);
      }
      if (req.query.processo) {
        query += " AND ss.processo LIKE ?";
        params.push(`%${req.query.processo}%`);
      }
      if (req.query.data_prevista_de) {
        query += " AND ss.data_prevista >= ?";
        params.push(req.query.data_prevista_de);
      }
      if (req.query.data_prevista_ate) {
        query += " AND ss.data_prevista <= ?";
        params.push(req.query.data_prevista_ate);
      }
      query += " ORDER BY ss.data_prevista DESC, ss.id DESC";
      const [rows] = await promisePool.query(query, params);
      res.json(rows);
    } catch (error) {
      console.error("Erro ao listar serviços de subestação:", error);
      res
        .status(500)
        .json({
          message: "Erro interno ao listar serviços de subestação.",
          detalhes: error.message,
        });
    }
  }
);
router.get(
  "/api/servicos-subestacoes/:servicoId",
  autenticar,
  podeGerenciarPaginaServicos,
  async (req, res) => {
    const { servicoId } = req.params;
    if (isNaN(parseInt(servicoId, 10))) {
      return res
        .status(400)
        .json({ message: `ID do serviço inválido: ${servicoId}` });
    }
    try {
      const [servicoRows] = await promisePool.query(
        `SELECT ss.id, ss.processo, ss.motivo, ss.alimentador, DATE_FORMAT(ss.data_prevista, '%Y-%m-%d') as data_prevista, ss.horario_inicio, ss.horario_fim, ss.status, DATE_FORMAT(ss.data_conclusao, '%Y-%m-%d') as data_conclusao, ss.observacoes_conclusao, s.Id as subestacao_id, s.sigla as subestacao_sigla, s.nome as subestacao_nome, u.id as responsavel_id, u.nome as responsavel_nome, e.id as equipamento_id, e.tag as equipamento_tag, ss.encarregado_designado_id, ud.nome as encarregado_designado_nome FROM servicos_subestacoes ss JOIN subestacoes s ON ss.subestacao_id = s.Id JOIN users u ON ss.responsavel_id = u.id LEFT JOIN infra_equip e ON ss.equipamento_id = e.id LEFT JOIN users ud ON ss.encarregado_designado_id = ud.id WHERE ss.id = ?`,
        [servicoId]
      );
      if (servicoRows.length === 0) {
        return res
          .status(404)
          .json({ message: `Serviço com ID ${servicoId} não encontrado.` });
      }
      const servico = servicoRows[0];
      const [anexosRows] = await promisePool.query(
        `SELECT id, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo FROM servicos_subestacoes_anexos WHERE id_servico = ?`,
        [servicoId]
      );
      servico.anexos = anexosRows;
      res.json(servico);
    } catch (error) {
      console.error("Erro ao buscar detalhes do serviço:", error);
      res
        .status(500)
        .json({
          message: "Erro interno ao buscar detalhes do serviço.",
          detalhes: error.message,
        });
    }
  }
);
router.put(
  "/api/servicos-subestacoes/:servicoId/concluir",
  autenticar,
  podeModificarServicos,
  verificarServicoExiste,
  upload.array("anexos_conclusao_servico", 5),
  async (req, res) => {
    const { servicoId } = req.params;
    const {
      data_conclusao_manual,
      hora_conclusao_manual,
      observacoes_conclusao_manual,
    } = req.body;
    const arquivosConclusao = req.files;
    const { servico } = req;
    if (servico.status === "CONCLUIDO" || servico.status === "CANCELADO") {
      if (arquivosConclusao && arquivosConclusao.length > 0) {
        for (const file of arquivosConclusao) {
          try {
            await fs.unlink(file.path);
          } catch (e) {}
        }
      }
      return res
        .status(400)
        .json({
          message: `Serviço (Processo: ${servico.processo}) já está no status ${servico.status}.`,
        });
    }
    if (!data_conclusao_manual) {
      if (arquivosConclusao && arquivosConclusao.length > 0) {
        for (const file of arquivosConclusao) {
          try {
            await fs.unlink(file.path);
          } catch (e) {}
        }
      }
      return res
        .status(400)
        .json({ message: "Data de conclusão é obrigatória." });
    }
    const connection = await promisePool.getConnection();
    let arquivosMovidosComSucesso = [];
    try {
      await connection.beginTransaction();
      let dataConclusaoFinal = data_conclusao_manual;
      let observacoesFinais =
        observacoes_conclusao_manual || servico.observacoes_conclusao || "";
      let horarioConclusaoFinal = hora_conclusao_manual || null;
      if (!dataConclusaoFinal) {
        dataConclusaoFinal = new Date().toISOString().split("T")[0];
      }
      let updateQuery =
        "UPDATE servicos_subestacoes SET status = 'CONCLUIDO', data_conclusao = ?, observacoes_conclusao = ?";
      const updateParams = [dataConclusaoFinal, observacoesFinais];
      if (horarioConclusaoFinal) {
        updateQuery += ", horario_fim = IFNULL(horario_fim, ?)";
        updateParams.push(horarioConclusaoFinal);
      } else {
        const now = new Date();
        const horaAtualFormatada = now.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
        updateQuery += ", horario_fim = IFNULL(horario_fim, ?)";
        updateParams.push(horaAtualFormatada);
      }
      updateQuery += " WHERE id = ?";
      updateParams.push(servicoId);
      await connection.query(updateQuery, updateParams);
      let anexosSalvosConclusaoInfo = [];
      if (arquivosConclusao && arquivosConclusao.length > 0) {
        const servicoUploadDirConclusao = path.join(
          uploadsSubestacoesDir,
          "servicos",
          `servico_${String(servicoId)}`,
          "conclusao"
        );
        await fs.mkdir(servicoUploadDirConclusao, { recursive: true });
        for (const file of arquivosConclusao) {
          const nomeUnicoArquivo = `${Date.now()}_${file.originalname.replace(
            /[^a-zA-Z0-9.\-_]/g,
            "_"
          )}`;
          const caminhoDestino = path.join(
            servicoUploadDirConclusao,
            nomeUnicoArquivo
          );
          const caminhoRelativoServidor = `servicos/servico_${servicoId}/conclusao/${nomeUnicoArquivo}`;
          await fs.rename(file.path, caminhoDestino);
          arquivosMovidosComSucesso.push(caminhoDestino);
          const [resultAnexo] = await connection.query(
            `INSERT INTO servicos_subestacoes_anexos (id_servico, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo, descricao_anexo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              servicoId,
              file.originalname,
              `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
              file.mimetype,
              file.size,
              "ANEXO_CONCLUSAO",
              "Anexo de conclusão",
            ]
          );
          anexosSalvosConclusaoInfo.push({
            id: resultAnexo.insertId,
            nome_original: file.originalname,
            caminho_servidor: `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
          });
        }
      }
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "CONCLUDE_SERVICO_SUBESTACAO",
          `Serviço de Subestação ID ${servicoId} (Processo: ${servico.processo}) marcado como CONCLUÍDO. Data: ${dataConclusaoFinal}. Anexos Conclusão: ${anexosSalvosConclusaoInfo.length}`,
          connection
        );
      }
      await connection.commit();
      res.json({
        message: `Serviço (Processo: ${servico.processo}) concluído com sucesso!`,
        anexosConclusao: anexosSalvosConclusaoInfo,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao concluir o serviço:", error);
      if (arquivosConclusao && arquivosConclusao.length > 0) {
        for (const file of arquivosConclusao) {
          if (
            file.path &&
            (file.path.includes("temp") || file.path.includes("upload_"))
          ) {
            try {
              await fs.access(file.path);
              await fs.unlink(file.path);
            } catch (e) {}
          }
        }
      }
      for (const caminho of arquivosMovidosComSucesso) {
        try {
          await fs.unlink(caminho);
        } catch (e) {}
      }
      res
        .status(500)
        .json({
          message: "Erro interno ao concluir o serviço.",
          detalhes: error.message,
        });
    } finally {
      if (connection) connection.release();
    }
  }
);
router.put(
  "/api/servicos-subestacoes/:servicoId/reabrir",
  autenticar,
  podeModificarServicos,
  verificarServicoExiste,
  async (req, res) => {
    const { servicoId } = req.params;
    const { servico } = req;
    if (servico.status !== "CONCLUIDO" && servico.status !== "CANCELADO") {
      return res
        .status(400)
        .json({
          message: `Serviço (Processo: ${servico.processo}) no status ${servico.status} não pode ser reaberto.`,
        });
    }
    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        "UPDATE servicos_subestacoes SET status = 'EM_ANDAMENTO', data_conclusao = NULL, observacoes_conclusao = NULL WHERE id = ?",
        [servicoId]
      );
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "REOPEN_SERVICO_SUBESTACAO",
          `Serviço de Subestação ID ${servicoId} (Processo: ${servico.processo}) reaberto.`,
          connection
        );
      }
      await connection.commit();
      res.json({
        message: `Serviço (Processo: ${servico.processo}) reaberto com sucesso! Novo status: EM ANDAMENTO.`,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao reabrir o serviço:", error);
      res
        .status(500)
        .json({
          message: "Erro interno ao reabrir o serviço.",
          detalhes: error.message,
        });
    } finally {
      if (connection) connection.release();
    }
  }
);
router.put(
  "/api/servicos-subestacoes/:servicoId/designar-encarregado",
  autenticar,
  podeModificarServicos,
  verificarServicoExiste,
  async (req, res) => {
    const { servicoId } = req.params;
    const { encarregado_designado_id } = req.body;
    const { servico } = req;
    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();
      const encarregadoFinalId =
        encarregado_designado_id && !isNaN(parseInt(encarregado_designado_id))
          ? parseInt(encarregado_designado_id)
          : null;
      await connection.query(
        "UPDATE servicos_subestacoes SET encarregado_designado_id = ? WHERE id = ?",
        [encarregadoFinalId, servicoId]
      );
      if (req.user && req.user.matricula) {
        let nomeEncarregado = "Ninguém";
        if (encarregadoFinalId) {
          const [encarregado] = await connection.query(
            "SELECT nome FROM users WHERE id = ?",
            [encarregadoFinalId]
          );
          nomeEncarregado =
            encarregado.length > 0
              ? encarregado[0].nome
              : `ID ${encarregadoFinalId}`;
        }
        const acao = encarregadoFinalId
          ? "DESIGNATE_ENCARREGADO_SERVICO"
          : "UNDESIGNATE_ENCARREGADO_SERVICO";
        const detalheAcao = encarregadoFinalId
          ? `designado para Encarregado: ${nomeEncarregado}`
          : "encarregado desvinculado";
        await registrarAuditoria(
          req.user.matricula,
          acao,
          `Serviço ID ${servicoId} (Proc: ${servico.processo}) ${detalheAcao}.`,
          connection
        );
      }
      await connection.commit();
      const mensagem = encarregadoFinalId
        ? `Serviço (Processo: ${servico.processo}) designado com sucesso!`
        : `Encarregado desvinculado do serviço (Processo: ${servico.processo}) com sucesso!`;
      res.json({ message: mensagem });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao designar/desvincular encarregado:", error);
      res
        .status(500)
        .json({
          message: "Erro interno ao designar/desvincular encarregado.",
          detalhes: error.message,
        });
    } finally {
      if (connection) connection.release();
    }
  }
);
router.post(
  "/inspecoes-subestacoes",
  autenticar,
  podeRealizarInspecao,
  upload.any(),
  async (req, res) => {
    const {
      subestacao_id,
      responsavel_levantamento_id,
      data_avaliacao,
      hora_inicial,
      hora_final,
      status_inspecao,
      observacoes_gerais,
    } = req.body;
    const generalAttachments = [];
    const itemPhotos = {};
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        if (file.fieldname === "anexosInspecao") {
          generalAttachments.push(file);
        } else if (file.fieldname.startsWith("foto_item_")) {
          const itemNum = file.fieldname.split("_")[2];
          itemPhotos[itemNum] = file;
        }
      });
    }
    let itensDoChecklist;
    try {
      if (req.body.itens && typeof req.body.itens === "string") {
        itensDoChecklist = JSON.parse(req.body.itens);
      } else {
        throw new Error(
          "Dados dos itens do checklist não recebidos ou em formato incorreto."
        );
      }
    } catch (e) {
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          try {
            await fs.unlink(file.path);
          } catch (errunlink) {}
        }
      }
      return res
        .status(400)
        .json({
          message: "Formato inválido para os itens do checklist.",
          detalhes: e.message,
        });
    }
    if (
      !subestacao_id ||
      !responsavel_levantamento_id ||
      !data_avaliacao ||
      !hora_inicial ||
      !itensDoChecklist ||
      !Array.isArray(itensDoChecklist) ||
      itensDoChecklist.length === 0
    ) {
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          try {
            await fs.unlink(file.path);
          } catch (e) {}
        }
      }
      return res
        .status(400)
        .json({
          message: "Campos obrigatórios do cabeçalho e itens são necessários.",
        });
    }
    for (const item of itensDoChecklist) {
      if (
        item.item_num == null ||
        !item.grupo_item ||
        !item.descricao_item_original ||
        !item.avaliacao
      ) {
        if (req.files && req.files.length > 0) {
          for (const file of req.files) {
            try {
              await fs.unlink(file.path);
            } catch (e) {}
          }
        }
        return res
          .status(400)
          .json({
            message: `Dados incompletos para o item do checklist: ${JSON.stringify(
              item
            )}`,
          });
      }
      if (!["N", "A", "NA"].includes(item.avaliacao)) {
        if (req.files && req.files.length > 0) {
          for (const file of req.files) {
            try {
              await fs.unlink(file.path);
            } catch (e) {}
          }
        }
        return res
          .status(400)
          .json({
            message: `Avaliação inválida ('${item.avaliacao}') para o item ${item.item_num}. Use N, A, ou NA.`,
          });
      }
      if (item.avaliacao === "A" && !itemPhotos[item.item_num]) {
        if (req.files && req.files.length > 0) {
          for (const file of req.files) {
            try {
              await fs.unlink(file.path);
            } catch (e) {}
          }
        }
        return res
          .status(400)
          .json({
            message: `Item ${item.item_num} (${item.descricao_item_original}) está marcado como Anormal, mas não foi enviada uma foto de evidência.`,
          });
      }
    }
    const connection = await promisePool.getConnection();
    let novaInspecaoId;
    let arquivosMovidosComSucessoParaRollback = [];
    try {
      await connection.beginTransaction();
      const [resultInspecao] = await connection.query(
        `INSERT INTO inspecoes_subestacoes (subestacao_id, responsavel_levantamento_id, data_avaliacao, hora_inicial, hora_final, status_inspecao, observacoes_gerais, formulario_inspecao_num) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          subestacao_id,
          responsavel_levantamento_id,
          data_avaliacao,
          hora_inicial,
          hora_final || null,
          status_inspecao || "EM_ANDAMENTO",
          observacoes_gerais || null,
          null,
        ]
      );
      novaInspecaoId = resultInspecao.insertId;
      await connection.query(
        "UPDATE inspecoes_subestacoes SET formulario_inspecao_num = ? WHERE id = ?",
        [String(novaInspecaoId), novaInspecaoId]
      );
      const itensParaInserir = itensDoChecklist.map((item) => [
        novaInspecaoId,
        item.item_num,
        item.grupo_item,
        item.descricao_item_original,
        item.avaliacao,
        item.observacao_item || null,
      ]);
      if (itensParaInserir.length > 0) {
        await connection.query(
          `INSERT INTO inspecoes_subestacoes_itens (inspecao_id, item_num, grupo_item, descricao_item_original, avaliacao, observacao_item) VALUES ?`,
          [itensParaInserir]
        );
      }
      let anexosSalvosInfo = [];
      const inspecaoUploadDir = path.join(
        uploadsSubestacoesDir,
        "checklist",
        `checklist_${String(novaInspecaoId)}`
      );
      await fs.mkdir(inspecaoUploadDir, { recursive: true });
      for (const file of generalAttachments) {
        const nomeUnicoArquivo = `${Date.now()}_GA_${file.originalname.replace(
          /[^a-zA-Z0-9.\-_]/g,
          "_"
        )}`;
        const caminhoDestino = path.join(inspecaoUploadDir, nomeUnicoArquivo);
        const caminhoRelativoServidor = `checklist/checklist_${novaInspecaoId}/${nomeUnicoArquivo}`;
        await fs.rename(file.path, caminhoDestino);
        arquivosMovidosComSucessoParaRollback.push(caminhoDestino);
        const [resultAnexo] = await connection.query(
          `INSERT INTO inspecoes_subestacoes_anexos (inspecao_id, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo, descricao_anexo, item_num_associado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            novaInspecaoId,
            file.originalname,
            `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
            file.mimetype,
            file.size,
            "FOTO_EVIDENCIA_GERAL",
            req.body.descricao_anexo_geral || null,
            null,
          ]
        );
        anexosSalvosInfo.push({
          id: resultAnexo.insertId,
          nome_original: file.originalname,
          caminho_servidor: `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
          type: "general",
        });
      }
      for (const itemNumKey in itemPhotos) {
        const file = itemPhotos[itemNumKey];
        const nomeUnicoArquivo = `${Date.now()}_ITEM${itemNumKey}_${file.originalname.replace(
          /[^a-zA-Z0-9.\-_]/g,
          "_"
        )}`;
        const caminhoDestino = path.join(inspecaoUploadDir, nomeUnicoArquivo);
        const caminhoRelativoServidor = `checklist/checklist_${novaInspecaoId}/${nomeUnicoArquivo}`;
        await fs.rename(file.path, caminhoDestino);
        arquivosMovidosComSucessoParaRollback.push(caminhoDestino);
        const [resultAnexo] = await connection.query(
          `INSERT INTO inspecoes_subestacoes_anexos (inspecao_id, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo, item_num_associado) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            novaInspecaoId,
            file.originalname,
            `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
            file.mimetype,
            file.size,
            "FOTO_EVIDENCIA_ITEM",
            parseInt(itemNumKey),
          ]
        );
        anexosSalvosInfo.push({
          id: resultAnexo.insertId,
          item_num: parseInt(itemNumKey),
          nome_original: file.originalname,
          caminho_servidor: `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
          type: "item_specific",
        });
      }
      await connection.commit();
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "CREATE_INSPECAO_SUBESTACAO",
          `Inspeção de subestação ID ${novaInspecaoId} para subestação ID ${subestacao_id} criada.`,
          connection
        );
      }
      res
        .status(201)
        .json({
          id: novaInspecaoId,
          formulario_inspecao_num: String(novaInspecaoId),
          message: "Inspeção registrada com sucesso!",
          anexos: anexosSalvosInfo,
        });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao registrar inspeção:", error);
      for (const caminho of arquivosMovidosComSucessoParaRollback) {
        try {
          await fs.unlink(caminho);
        } catch (e) {}
      }
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          if (
            file.path &&
            (file.path.includes("temp") || file.path.includes("upload_"))
          ) {
            try {
              await fs.access(file.path);
              await fs.unlink(file.path);
            } catch (e) {}
          }
        }
      }
      if (
        error.code === "ER_DUP_ENTRY" &&
        error.sqlMessage &&
        error.sqlMessage.includes("uq_inspecao_item_num")
      ) {
        return res
          .status(409)
          .json({
            message: "Erro: Itens do checklist duplicados para esta inspeção.",
          });
      }
      res
        .status(500)
        .json({
          message: "Erro interno ao registrar inspeção.",
          detalhes: error.message,
        });
    } finally {
      if (connection) connection.release();
    }
  }
);
router.post(
  "/inspecoes-subestacoes/:inspecaoId/anexos-escritorio",
  autenticar,
  podeGerenciarPaginaInspecoes,
  verificarInspecaoExiste,
  upload.array("anexosEscritorio", 5),
  async (req, res) => {
    const { inspecaoId } = req;
    const arquivos = req.files;
    if (!arquivos || arquivos.length === 0) {
      return res.status(400).json({ message: "Nenhum arquivo enviado." });
    }
    const connection = await promisePool.getConnection();
    let arquivosMovidosComSucesso = [];
    try {
      await connection.beginTransaction();
      const inspecaoEscritorioUploadDir = path.join(
        uploadsSubestacoesDir,
        "inspecoes_escritorio",
        `inspecao_escritorio_${String(inspecaoId)}`
      );
      await fs.mkdir(inspecaoEscritorioUploadDir, { recursive: true });
      let anexosSalvosInfo = [];
      for (const file of arquivos) {
        const nomeUnicoArquivo = `${Date.now()}_ESCRITORIO_${file.originalname.replace(
          /[^a-zA-Z0-9.\-_]/g,
          "_"
        )}`;
        const caminhoDestino = path.join(
          inspecaoEscritorioUploadDir,
          nomeUnicoArquivo
        );
        const caminhoRelativoServidor = `inspecoes_escritorio/inspecao_escritorio_${inspecaoId}/${nomeUnicoArquivo}`;
        await fs.rename(file.path, caminhoDestino);
        arquivosMovidosComSucesso.push(caminhoDestino);
        const categoriaAnexoFinal = "DOCUMENTO_ESCRITORIO";
        const descricaoAnexoFinal = req.body.descricao_anexo_escritorio || null;
        const [resultAnexo] = await connection.query(
          `INSERT INTO inspecoes_subestacoes_anexos (inspecao_id, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo, descricao_anexo, item_num_associado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            inspecaoId,
            file.originalname,
            `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
            file.mimetype,
            file.size,
            categoriaAnexoFinal,
            descricaoAnexoFinal,
            null,
          ]
        );
        anexosSalvosInfo.push({
          id: resultAnexo.insertId,
          nome_original: file.originalname,
          caminho_servidor: `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
        });
      }
      await connection.commit();
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "UPLOAD_ANEXO_ESCRITORIO_INSPECAO",
          `Anexos de escritório adicionados à Inspeção ID ${inspecaoId}. Arquivos: ${anexosSalvosInfo
            .map((a) => a.nome_original)
            .join(", ")}`,
          connection
        );
      }
      res
        .status(201)
        .json({
          message: "Anexos de escritório salvos com sucesso!",
          anexos: anexosSalvosInfo,
        });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao salvar anexos de escritório:", error);
      for (const caminho of arquivosMovidosComSucesso) {
        try {
          await fs.unlink(caminho);
        } catch (e) {}
      }
      if (arquivos && arquivos.length > 0) {
        for (const file of arquivos) {
          if (
            file.path &&
            (file.path.includes("temp") || file.path.includes("upload_"))
          ) {
            try {
              await fs.access(file.path);
              await fs.unlink(file.path);
            } catch (e) {}
          }
        }
      }
      res
        .status(500)
        .json({
          message: "Erro interno ao salvar anexos de escritório.",
          detalhes: error.message,
        });
    } finally {
      if (connection) connection.release();
    }
  }
);
router.get(
  "/inspecoes-subestacoes",
  autenticar,
  podeGerenciarPaginaInspecoes,
  async (req, res) => {
    try {
      let query = ` SELECT i.id, i.formulario_inspecao_num, DATE_FORMAT(i.data_avaliacao, '%Y-%m-%d') as data_avaliacao, i.hora_inicial, i.hora_final, i.status_inspecao, s.sigla as subestacao_sigla, s.nome as subestacao_nome, u.nome as responsavel_nome FROM inspecoes_subestacoes i JOIN subestacoes s ON i.subestacao_id = s.Id JOIN users u ON i.responsavel_levantamento_id = u.id WHERE 1=1 `;
      const params = [];
      if (req.query.subestacao_id) {
        query += " AND i.subestacao_id = ?";
        params.push(req.query.subestacao_id);
      }
      if (req.query.status_inspecao) {
        query += " AND i.status_inspecao = ?";
        params.push(req.query.status_inspecao);
      }
      if (req.query.responsavel_id) {
        query += " AND i.responsavel_levantamento_id = ?";
        params.push(req.query.responsavel_id);
      }
      if (req.query.data_avaliacao_de) {
        query += " AND i.data_avaliacao >= ?";
        params.push(req.query.data_avaliacao_de);
      }
      if (req.query.data_avaliacao_ate) {
        query += " AND i.data_avaliacao <= ?";
        params.push(req.query.data_avaliacao_ate);
      }
      query += " ORDER BY i.data_avaliacao DESC, i.id DESC";
      const [rows] = await promisePool.query(query, params);
      res.json(rows);
    } catch (error) {
      console.error("Erro interno ao listar inspeções:", error);
      res
        .status(500)
        .json({
          message: "Erro interno ao listar inspeções.",
          detalhes: error.message,
        });
    }
  }
);
router.get(
  "/inspecoes-subestacoes/:id",
  autenticar,
  podeGerenciarPaginaInspecoes,
  async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id, 10))) {
      return res
        .status(400)
        .json({ message: `ID da inspeção inválido: ${id}` });
    }
    try {
      const [inspecaoHeaderRows] = await promisePool.query(
        `SELECT i.id, i.subestacao_id, i.formulario_inspecao_num, i.responsavel_levantamento_id, DATE_FORMAT(i.data_avaliacao, '%Y-%m-%d') as data_avaliacao, i.hora_inicial, i.hora_final, i.status_inspecao, i.observacoes_gerais, s.sigla as subestacao_sigla, s.nome as subestacao_nome, u.nome as responsavel_nome FROM inspecoes_subestacoes i JOIN subestacoes s ON i.subestacao_id = s.Id JOIN users u ON i.responsavel_levantamento_id = u.id WHERE i.id = ?`,
        [id]
      );
      if (inspecaoHeaderRows.length === 0) {
        return res
          .status(404)
          .json({ message: `Inspeção com ID ${id} não encontrada.` });
      }
      const inspecaoHeader = inspecaoHeaderRows[0];
      const [inspecaoItensRows] = await promisePool.query(
        `SELECT item_num, grupo_item, descricao_item_original, avaliacao, observacao_item FROM inspecoes_subestacoes_itens WHERE inspecao_id = ? ORDER BY item_num ASC`,
        [id]
      );
      const [anexosItensRows] = await promisePool.query(
        `SELECT item_num_associado, nome_original, caminho_servidor, categoria_anexo FROM inspecoes_subestacoes_anexos WHERE inspecao_id = ? AND item_num_associado IS NOT NULL AND categoria_anexo = 'FOTO_EVIDENCIA_ITEM'`,
        [id]
      );
      const anexosPorItem = {};
      anexosItensRows.forEach((anexo) => {
        if (!anexosPorItem[anexo.item_num_associado]) {
          anexosPorItem[anexo.item_num_associado] = [];
        }
        anexosPorItem[anexo.item_num_associado].push({
          nome: anexo.nome_original,
          caminho: anexo.caminho_servidor,
        });
      });
      const itensAgrupados = {};
      if (inspecaoItensRows.length > 0) {
        inspecaoItensRows.forEach((item) => {
          if (!itensAgrupados[item.grupo_item]) {
            itensAgrupados[item.grupo_item] = [];
          }
          itensAgrupados[item.grupo_item].push({
            num: item.item_num,
            desc: item.descricao_item_original,
            avaliacao: item.avaliacao,
            obs: item.observacao_item,
            anexos: anexosPorItem[item.item_num] || [],
          });
        });
      }
      const [anexosGeraisRows] = await promisePool.query(
        `SELECT nome_original, caminho_servidor, categoria_anexo, descricao_anexo FROM inspecoes_subestacoes_anexos WHERE inspecao_id = ? AND (item_num_associado IS NULL OR categoria_anexo != 'FOTO_EVIDENCIA_ITEM')`,
        [id]
      );
      const resultadoCompleto = {
        ...inspecaoHeader,
        gruposDeItens: itensAgrupados,
        anexosGerais: anexosGeraisRows.map((anexo) => ({
          nome: anexo.nome_original,
          caminho: anexo.caminho_servidor,
          categoria: anexo.categoria_anexo,
          descricao: anexo.descricao_anexo,
        })),
      };
      res.json(resultadoCompleto);
    } catch (error) {
      console.error("Erro ao buscar detalhes da inspeção:", error);
      res
        .status(500)
        .json({
          message: "Erro interno ao buscar detalhes da inspeção.",
          detalhes: error.message,
        });
    }
  }
);
router.put(
  "/inspecoes-subestacoes/:inspecaoId/concluir",
  autenticar,
  podeGerenciarPaginaInspecoes,
  verificarInspecaoExiste,
  async (req, res) => {
    const { inspecaoId } = req;
    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();
      const [currentInspecaoRows] = await connection.query(
        "SELECT status_inspecao, hora_final FROM inspecoes_subestacoes WHERE id = ?",
        [inspecaoId]
      );
      if (currentInspecaoRows.length === 0) {
        await connection.rollback();
        return res
          .status(404)
          .json({ message: `Inspeção com ID ${inspecaoId} não encontrada.` });
      }
      const currentStatus = currentInspecaoRows[0].status_inspecao;
      let horaFinalAtual = currentInspecaoRows[0].hora_final;
      if (currentStatus === "CONCLUIDA" || currentStatus === "CANCELADA") {
        await connection.rollback();
        return res
          .status(400)
          .json({
            message: `Inspeção ID ${inspecaoId} já está no status ${currentStatus} e não pode ser alterada para concluída novamente.`,
          });
      }
      let sqlUpdateQuery =
        "UPDATE inspecoes_subestacoes SET status_inspecao = 'CONCLUIDA'";
      const paramsUpdate = [];
      if (!horaFinalAtual) {
        const now = new Date();
        horaFinalAtual = now.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
        sqlUpdateQuery += ", hora_final = ?";
        paramsUpdate.push(horaFinalAtual);
      }
      sqlUpdateQuery += " WHERE id = ?";
      paramsUpdate.push(inspecaoId);
      const [result] = await connection.query(sqlUpdateQuery, paramsUpdate);
      if (result.affectedRows === 0) {
        await connection.rollback();
        return res
          .status(404)
          .json({
            message: "Falha ao atualizar a inspeção. Nenhuma linha afetada.",
          });
      }
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "CONCLUDE_INSPECAO_SUBESTACAO",
          `Inspeção de subestação ID ${inspecaoId} marcada como CONCLUÍDA.`,
          connection
        );
      }
      await connection.commit();
      res.json({ message: `Inspeção ID ${inspecaoId} concluída com sucesso!` });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao concluir a inspeção:", error);
      res
        .status(500)
        .json({
          message: "Erro interno ao concluir a inspeção.",
          detalhes: error.message,
        });
    } finally {
      if (connection) connection.release();
    }
  }
);
router.put(
  "/inspecoes-subestacoes/:inspecaoId/reabrir",
  autenticar,
  podeGerenciarPaginaInspecoes,
  verificarInspecaoExiste,
  async (req, res) => {
    const { inspecaoId } = req;
    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();
      const [currentInspecaoRows] = await connection.query(
        "SELECT status_inspecao FROM inspecoes_subestacoes WHERE id = ?",
        [inspecaoId]
      );
      if (currentInspecaoRows.length === 0) {
        await connection.rollback();
        return res
          .status(404)
          .json({ message: `Inspeção com ID ${inspecaoId} não encontrada.` });
      }
      const currentStatus = currentInspecaoRows[0].status_inspecao;
      const statusReversiveis = ["CONCLUIDA", "CANCELADA"];
      if (!statusReversiveis.includes(currentStatus)) {
        await connection.rollback();
        return res
          .status(400)
          .json({
            message: `Inspeção ID ${inspecaoId} no status ${currentStatus} não pode ser reaberta.`,
          });
      }
      const [result] = await connection.query(
        "UPDATE inspecoes_subestacoes SET status_inspecao = 'EM_ANDAMENTO', hora_final = NULL WHERE id = ?",
        [inspecaoId]
      );
      if (result.affectedRows === 0) {
        await connection.rollback();
        return res
          .status(404)
          .json({
            message: "Falha ao reabrir a inspeção. Nenhuma linha afetada.",
          });
      }
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "REOPEN_INSPECAO_SUBESTACAO",
          `Inspeção de subestação ID ${inspecaoId} reaberta (status EM_ANDAMENTO).`,
          connection
        );
      }
      await connection.commit();
      res.json({ message: `Inspeção ID ${inspecaoId} reaberta com sucesso!` });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao reabrir a inspeção:", error);
      res
        .status(500)
        .json({
          message: "Erro interno ao reabrir a inspeção.",
          detalhes: error.message,
        });
    } finally {
      if (connection) connection.release();
    }
  }
);
router.delete(
  "/inspecoes-subestacoes/:inspecaoId",
  autenticar,
  podeGerenciarPaginaInspecoes,
  verificarInspecaoExiste,
  async (req, res) => {
    const { inspecaoId } = req;
    const inspecaoInfo = req.inspecao;
    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();
      const [anexos] = await connection.query(
        "SELECT caminho_servidor FROM inspecoes_subestacoes_anexos WHERE inspecao_id = ?",
        [inspecaoId]
      );
      await connection.query(
        "DELETE FROM inspecoes_subestacoes_anexos WHERE inspecao_id = ?",
        [inspecaoId]
      );
      await connection.query(
        "DELETE FROM inspecoes_subestacoes_itens WHERE inspecao_id = ?",
        [inspecaoId]
      );
      const [result] = await connection.query(
        "DELETE FROM inspecoes_subestacoes WHERE id = ?",
        [inspecaoId]
      );
      if (result.affectedRows === 0) {
        await connection.rollback();
        return res
          .status(404)
          .json({
            message: `Inspeção com ID ${inspecaoId} não encontrada para exclusão.`,
          });
      }
      if (anexos.length > 0) {
        const anexoChecklistBaseDir = path.join(
          uploadsSubestacoesDir,
          "checklist",
          `checklist_${String(inspecaoId)}`
        );
        const anexoEscritorioBaseDir = path.join(
          uploadsSubestacoesDir,
          "inspecoes_escritorio",
          `inspecao_escritorio_${String(inspecaoId)}`
        );
        for (const anexo of anexos) {
          const caminhoRelativoNoServidor = anexo.caminho_servidor.replace(
            /^\/upload_arquivos_subestacoes\//,
            ""
          );
          const caminhoCompleto = path.join(
            uploadsSubestacoesDir,
            caminhoRelativoNoServidor
          );
          try {
            await fs.access(caminhoCompleto);
            await fs.unlink(caminhoCompleto);
          } catch (err) {
            console.warn(
              `Arquivo de anexo não encontrado ou falha ao excluir: ${caminhoCompleto} - ${err.message}`
            );
          }
        }
        try {
          await fs.rm(anexoChecklistBaseDir, { recursive: true, force: true });
        } catch (e) {
          if (e.code !== "ENOENT") {
            console.warn(
              `Falha ao remover dir ${anexoChecklistBaseDir}: ${e.message}`
            );
          }
        }
        try {
          await fs.rm(anexoEscritorioBaseDir, { recursive: true, force: true });
        } catch (e) {
          if (e.code !== "ENOENT") {
            console.warn(
              `Falha ao remover dir ${anexoEscritorioBaseDir}: ${e.message}`
            );
          }
        }
      }
      await connection.commit();
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "DELETE_INSPECAO_SUBESTACAO",
          `Inspeção de subestação ID ${inspecaoId} (Form: ${
            inspecaoInfo.formulario_inspecao_num || "N/A"
          }) e seus dados foram excluídos.`,
          connection
        );
      }
      res.json({ message: `Inspeção ID ${inspecaoId} excluída com sucesso.` });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao excluir inspeção:", error);
      res
        .status(500)
        .json({
          message: "Erro interno ao excluir inspeção.",
          detalhes: error.message,
        });
    } finally {
      if (connection) connection.release();
    }
  }
);

module.exports = router;
