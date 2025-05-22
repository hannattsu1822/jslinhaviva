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

router.get("/api/placas", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query("SELECT placa FROM veiculos");
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao buscar placas:", err);
    res.status(500).json({ message: "Erro ao buscar placas!" });
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

  try {
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
    await promisePool.query(query, values);
    await registrarAuditoria(
      matricula,
      "Salvar Inspeção",
      `Inspeção salva para placa: ${placa}`
    );
    res.status(201).json({ message: "Inspeção salva com sucesso!" });
  } catch (err) {
    console.error("Erro ao salvar inspeção:", err);
    res.status(500).json({ message: "Erro ao salvar inspeção!" });
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
      query += ` AND matricula = ?`; // Corrigido de matricula_motorista para matricula se o campo no BD for matricula
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
      "SELECT horimetro FROM inspecoes WHERE placa = ? ORDER BY data_inspecao DESC, id DESC LIMIT 1",
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
    const primaryColorForHeader = "#004494"; // Substitua pela sua cor primária exata

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "40mm",
        right: "10mm",
        bottom: "25mm",
        left: "10mm",
      },
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

module.exports = router;
