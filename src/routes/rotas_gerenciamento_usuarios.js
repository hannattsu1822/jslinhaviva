/*const express = require("express");
const router = express.Router();
const { promisePool } = require("../init");
const { autenticar, verificarNivel, criarHashSenha } = require("../auth");
const ExcelJS = require("exceljs");

router.get(
  "/api/gerenciamento/usuarios",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    try {
      const page = parseInt(req.query.pagina) || 1;
      const limit = 15;
      const offset = (page - 1) * limit;
      const { termo, cargo, nivel } = req.query;
      let whereClauses = [];
      let params = [];
      if (termo) {
        whereClauses.push("(nome LIKE ? OR matricula LIKE ?)");
        params.push(`%${termo}%`, `%${termo}%`);
      }
      if (cargo) {
        whereClauses.push("cargo LIKE ?");
        params.push(`%${cargo}%`);
      }
      if (nivel && nivel !== "") {
        whereClauses.push("nivel = ?");
        params.push(nivel);
      }
      const whereString =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
      const countSql = `SELECT COUNT(*) as total FROM users ${whereString}`;
      const [countRows] = await promisePool.query(countSql, params);
      const totalUsers = countRows[0].total;
      const totalPages = Math.ceil(totalUsers / limit);
      const usersSql = `SELECT id, nome, matricula, cargo, nivel FROM users ${whereString} ORDER BY nome ASC LIMIT ? OFFSET ?`;
      const [users] = await promisePool.query(usersSql, [
        ...params,
        limit,
        offset,
      ]);
      res.json({ users, currentPage: page, totalPages });
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      res.status(500).json({ message: "Erro interno ao buscar usuários." });
    }
  }
);

router.get(
  "/api/gerenciamento/usuarios/:id",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await promisePool.query(
        "SELECT id, nome, matricula, cargo, nivel FROM users WHERE id = ?",
        [id]
      );
      if (rows.length === 0)
        return res.status(404).json({ message: "Usuário não encontrado." });
      res.json(rows[0]);
    } catch (error) {
      res.status(500).json({ message: "Erro interno ao buscar usuário." });
    }
  }
);

router.post(
  "/api/gerenciamento/usuarios",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { nome, matricula, cargo, nivel, senha } = req.body;
    if (!nome || !matricula || !cargo || !nivel || !senha)
      return res
        .status(400)
        .json({ message: "Todos os campos são obrigatórios." });
    try {
      const hashSenha = await criarHashSenha(senha);
      const [result] = await promisePool.query(
        "INSERT INTO users (nome, matricula, cargo, nivel, senha) VALUES (?, ?, ?, ?, ?)",
        [nome, matricula, cargo, nivel, hashSenha]
      );
      res
        .status(201)
        .json({ id: result.insertId, message: "Usuário criado com sucesso!" });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY")
        return res
          .status(409)
          .json({ message: "A matrícula informada já está em uso." });
      res.status(500).json({ message: "Erro interno ao criar usuário." });
    }
  }
);

router.put(
  "/api/gerenciamento/usuarios/:id",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { id } = req.params;
    const { nome, matricula, cargo, nivel, senha } = req.body;
    try {
      let sql, params;
      if (senha) {
        const hashSenha = await criarHashSenha(senha);
        sql =
          "UPDATE users SET nome = ?, matricula = ?, cargo = ?, nivel = ?, senha = ? WHERE id = ?";
        params = [nome, matricula, cargo, nivel, hashSenha, id];
      } else {
        sql =
          "UPDATE users SET nome = ?, matricula = ?, cargo = ?, nivel = ? WHERE id = ?";
        params = [nome, matricula, cargo, nivel, id];
      }
      const [result] = await promisePool.query(sql, params);
      if (result.affectedRows === 0)
        return res.status(404).json({ message: "Usuário não encontrado." });
      res.json({ message: "Usuário atualizado com sucesso!" });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY")
        return res.status(409).json({
          message: "A matrícula informada já está em uso por outro usuário.",
        });
      res.status(500).json({ message: "Erro interno ao atualizar usuário." });
    }
  }
);

router.put(
  "/api/gerenciamento/usuarios/:id/status",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { id } = req.params;
    const { nivelAtual } = req.body;
    const novoNivel = nivelAtual > 0 ? 0 : 1;
    try {
      await promisePool.query("UPDATE users SET nivel = ? WHERE id = ?", [
        novoNivel,
        id,
      ]);
      res.json({
        message: `Usuário ${
          novoNivel > 0 ? "ativado" : "desativado"
        } com sucesso!`,
      });
    } catch (error) {
      res.status(500).json({ message: "Erro ao alterar status do usuário." });
    }
  }
);

router.delete(
  "/api/gerenciamento/usuarios/:id",
  autenticar,
  verificarNivel(5),
  async (req, res) => {
    const { id } = req.params;
    try {
      const [result] = await promisePool.query(
        "DELETE FROM users WHERE id = ?",
        [id]
      );
      if (result.affectedRows === 0)
        return res.status(404).json({ message: "Usuário não encontrado." });
      res.json({ message: "Usuário excluído permanentemente com sucesso!" });
    } catch (error) {
      res.status(500).json({ message: "Erro interno ao excluir usuário." });
    }
  }
);

router.get(
  "/pagina-gerenciamento-frota",
  autenticar,
  verificarNivel(4),
  (req, res) => {
    res.render("pages/gestor/gerenciamento-frota.html", {
      user: req.session.user,
    });
  }
);

router.get(
  "/api/gestao-frota/veiculos",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    try {
      const page = parseInt(req.query.pagina) || 1;
      const limit = 15;
      const offset = (page - 1) * limit;
      const { termo, status } = req.query;
      let whereClauses = [];
      let params = [];
      if (termo) {
        whereClauses.push("(placa LIKE ? OR modelo LIKE ?)");
        params.push(`%${termo}%`, `%${termo}%`);
      }
      if (status) {
        whereClauses.push("status = ?");
        params.push(status);
      }
      const whereString =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
      const countSql = `SELECT COUNT(*) as total FROM veiculos_frota ${whereString}`;
      const [countRows] = await promisePool.query(countSql, params);
      const totalVeiculos = countRows[0].total;
      const totalPages = Math.ceil(totalVeiculos / limit);
      const veiculosSql = `SELECT * FROM veiculos_frota ${whereString} ORDER BY modelo ASC LIMIT ? OFFSET ?`;
      const [veiculos] = await promisePool.query(veiculosSql, [
        ...params,
        limit,
        offset,
      ]);
      res.json({ veiculos, currentPage: page, totalPages });
    } catch (error) {
      console.error("Erro ao buscar veículos:", error);
      res.status(500).json({ message: "Erro interno ao buscar veículos." });
    }
  }
);

router.get(
  "/api/gestao-frota/veiculos/:id",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await promisePool.query(
        "SELECT * FROM veiculos_frota WHERE id = ?",
        [id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ message: "Veículo não encontrado." });
      }
      res.json(rows[0]);
    } catch (error) {
      res.status(500).json({ message: "Erro interno ao buscar veículo." });
    }
  }
);

router.post(
  "/api/gestao-frota/veiculos",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { placa, modelo, tipo, ano, status } = req.body;
    if (!placa || !modelo) {
      return res
        .status(400)
        .json({ message: "Placa e Modelo são obrigatórios." });
    }
    try {
      const [result] = await promisePool.query(
        "INSERT INTO veiculos_frota (placa, modelo, tipo, ano, status) VALUES (?, ?, ?, ?, ?)",
        [placa, modelo, tipo || null, ano || null, status || "ATIVO"]
      );
      res
        .status(201)
        .json({ id: result.insertId, message: "Veículo criado com sucesso!" });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res
          .status(409)
          .json({ message: "A placa informada já está em uso." });
      }
      res.status(500).json({ message: "Erro interno ao criar veículo." });
    }
  }
);

router.put(
  "/api/gestao-frota/veiculos/:id",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { id } = req.params;
    const { placa, modelo, tipo, ano, status } = req.body;
    if (!placa || !modelo) {
      return res
        .status(400)
        .json({ message: "Placa e Modelo são obrigatórios." });
    }
    try {
      const [result] = await promisePool.query(
        "UPDATE veiculos_frota SET placa = ?, modelo = ?, tipo = ?, ano = ?, status = ? WHERE id = ?",
        [placa, modelo, tipo, ano, status, id]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Veículo não encontrado." });
      }
      res.json({ message: "Veículo atualizado com sucesso!" });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          message: "A placa informada já está em uso por outro veículo.",
        });
      }
      res.status(500).json({ message: "Erro interno ao atualizar veículo." });
    }
  }
);

router.delete(
  "/api/gestao-frota/veiculos/:id",
  autenticar,
  verificarNivel(5),
  async (req, res) => {
    const { id } = req.params;
    try {
      const [result] = await promisePool.query(
        "DELETE FROM veiculos_frota WHERE id = ?",
        [id]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Veículo não encontrado." });
      }
      res.json({ message: "Veículo excluído permanentemente com sucesso!" });
    } catch (error) {
      res.status(500).json({ message: "Erro interno ao excluir veículo." });
    }
  }
);

router.get(
  "/pagina-relatorios-prv",
  autenticar,
  verificarNivel(4),
  (req, res) => {
    res.render("pages/gestor/relatorios-prv.html", { user: req.session.user });
  }
);

router.get(
  "/api/relatorios/prv",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { veiculoId, dataInicio, dataFim } = req.query;
    if (!veiculoId || !dataInicio || !dataFim) {
      return res
        .status(400)
        .json({ message: "Veículo e período de datas são obrigatórios." });
    }
    try {
      const sql = `
        SELECT 
          r.*, 
          v.placa, 
          v.modelo,
          STR_TO_DATE(CONCAT(r.dia, '/', r.mes_ano_referencia), '%d/%m/%Y') as dia
        FROM prv_registros r
        JOIN veiculos_frota v ON r.veiculo_id = v.id
        WHERE r.veiculo_id = ? 
          AND STR_TO_DATE(CONCAT(r.dia, '/', r.mes_ano_referencia), '%d/%m/%Y') BETWEEN ? AND ?
        ORDER BY dia, r.saida_horario
      `;
      const [registros] = await promisePool.query(sql, [
        veiculoId,
        dataInicio,
        dataFim,
      ]);

      if (registros.length === 0) {
        const [veiculoRows] = await promisePool.query(
          "SELECT placa, modelo FROM veiculos_frota WHERE id = ?",
          [veiculoId]
        );
        return res.json({
          veiculo: veiculoRows[0] || {},
          registros: [],
        });
      }
      res.json({
        veiculo: {
          placa: registros[0].placa,
          modelo: registros[0].modelo,
        },
        registros: registros,
      });
    } catch (error) {
      console.error("Erro ao buscar dados do relatório PRV:", error);
      res.status(500).json({ message: "Erro ao buscar dados do relatório." });
    }
  }
);

router.get(
  "/api/relatorios/prv/export",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { veiculoId, dataInicio, dataFim } = req.query;
    if (!veiculoId || !dataInicio || !dataFim) {
      return res
        .status(400)
        .send("Veículo e período de datas são obrigatórios.");
    }
    try {
      const sql = `
        SELECT 
          r.*, 
          v.placa, 
          v.modelo,
          u.nome as nome_motorista,
          STR_TO_DATE(CONCAT(r.dia, '/', r.mes_ano_referencia), '%d/%m/%Y') as dia_completo
        FROM prv_registros r
        JOIN veiculos_frota v ON r.veiculo_id = v.id
        LEFT JOIN users u ON r.motorista_matricula = u.matricula
        WHERE r.veiculo_id = ? 
          AND STR_TO_DATE(CONCAT(r.dia, '/', r.mes_ano_referencia), '%d/%m/%Y') BETWEEN ? AND ?
        ORDER BY dia_completo, r.saida_horario
      `;
      const [registros] = await promisePool.query(sql, [
        veiculoId,
        dataInicio,
        dataFim,
      ]);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Roteiro de Viagem");

      worksheet.mergeCells("A1:K1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = "PLANILHA ROTEIRO DE VIAGEM DO VEÍCULO - PRV";
      titleCell.font = { name: "Arial", size: 16, bold: true };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };

      const veiculoInfo =
        registros.length > 0
          ? `${registros[0].placa} / ${registros[0].modelo}`
          : "N/A";

      const formatDate = (dateStr) => {
        const [y, m, d] = dateStr.split("-");
        return `${d}/${m}/${y}`;
      };

      worksheet.getCell("A3").value = "Placa/Tipo:";
      worksheet.getCell("B3").value = veiculoInfo;
      worksheet.getCell("A4").value = "Período:";
      worksheet.getCell("B4").value = `${formatDate(dataInicio)} a ${formatDate(
        dataFim
      )}`;

      const headerRow = worksheet.getRow(6);
      headerRow.values = [
        "DATA",
        "SAÍDA",
        "",
        "",
        "CHEGADA",
        "",
        "",
        "MOTORISTA/MATRÍCULA",
        "PROCESSO",
        "TIPO DE SERVIÇO",
      ];
      worksheet.mergeCells("B6:D6");
      worksheet.mergeCells("E6:G6");

      const subHeaderRow = worksheet.getRow(7);
      subHeaderRow.values = [
        "",
        "HORÁRIO",
        "LOCAL",
        "KM",
        "HORÁRIO",
        "LOCAL",
        "KM",
      ];

      ["A6", "H6", "I6", "J6"].forEach((cell) => {
        worksheet.mergeCells(`${cell}:${cell.charAt(0)}7`);
        worksheet.getCell(cell).alignment = {
          vertical: "middle",
          horizontal: "center",
        };
      });

      const headerCells = [
        "A6",
        "B6",
        "E6",
        "H6",
        "I6",
        "J6",
        "B7",
        "C7",
        "D7",
        "E7",
        "F7",
        "G7",
      ];
      headerCells.forEach((cell) => {
        worksheet.getCell(cell).font = { bold: true };
        worksheet.getCell(cell).alignment = {
          horizontal: "center",
          vertical: "middle",
        };
        worksheet.getCell(cell).border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      registros.forEach((r) => {
        const motoristaFormatado = r.nome_motorista
          ? `${r.nome_motorista} - ${r.motorista_matricula}`
          : r.motorista_matricula;

        worksheet.addRow([
          r.dia_completo,
          r.saida_horario,
          r.saida_local,
          r.saida_km,
          r.chegada_horario,
          r.chegada_local,
          r.chegada_km,
          motoristaFormatado,
          r.processo,
          r.tipo_servico,
        ]);
      });

      worksheet.columns = [
        { key: "dia", width: 12, style: { numFmt: "dd/mm/yyyy" } },
        { key: "saida_h", width: 10 },
        { key: "saida_l", width: 25 },
        { key: "saida_k", width: 10 },
        { key: "chegada_h", width: 10 },
        { key: "chegada_l", width: 25 },
        { key: "chegada_k", width: 10 },
        { key: "motorista", width: 35 },
        { key: "processo", width: 15 },
        { key: "servico", width: 30 },
      ];

      const fileName = `PRV_${
        veiculoInfo.split(" / ")[0]
      }_${dataInicio}_a_${dataFim}.xlsx`;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", "attachment; filename=" + fileName);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Erro ao exportar relatório PRV:", error);
      res.status(500).send("Erro ao gerar o arquivo Excel.");
    }
  }
);
module.exports = router;*/

