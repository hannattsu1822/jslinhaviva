const express = require("express");
const fs = require("fs");
const path = require("path");
const proj4 = require("proj4");
const { autenticar, verificarNivel, registrarAuditoria } = require("../auth");
const { promisePool, upload, projectRootDir } = require("../init");

const router = express.Router();

const convertUtmToLatLon = (easting, northing, utmZoneString) => {
  if (!utmZoneString || !easting || !northing) {
    throw new Error("Dados UTM incompletos para conversão.");
  }

  const zoneNumber = parseInt(utmZoneString, 10);
  const zoneLetterMatch = utmZoneString.match(/[A-Za-z]/);

  if (isNaN(zoneNumber) || !zoneLetterMatch) {
    throw new Error(`Zona UTM inválida: ${utmZoneString}`);
  }

  const zoneLetter = zoneLetterMatch[0];
  const isSouthernHemisphere = zoneLetter.toUpperCase() < "N";

  const utmProjection = `+proj=utm +zone=${zoneNumber} ${
    isSouthernHemisphere ? "+south" : ""
  } +ellps=WGS84 +datum=WGS84 +units=m +no_defs`;
  const wgs84Projection = `+proj=longlat +datum=WGS84 +no_defs`;

  try {
    const eastingSanitized = parseFloat(String(easting).replace(",", "."));
    const northingSanitized = parseFloat(String(northing).replace(",", "."));

    const [longitude, latitude] = proj4(utmProjection, wgs84Projection, [
      eastingSanitized,
      northingSanitized,
    ]);
    return { latitude, longitude };
  } catch (error) {
    console.error("Erro na conversão de coordenadas:", error);
    throw new Error("Erro interno ao converter coordenadas UTM.");
  }
};

const salvarAnexosFibra = async (
  servicoId,
  files,
  etapa,
  tipoAnexo,
  connection
) => {
  const anexosSalvos = [];
  const baseUploadDir = path.join(projectRootDir, "upload_arquivos_fibra");
  const servicoUploadDir = path.join(baseUploadDir, String(servicoId));

  if (!fs.existsSync(servicoUploadDir)) {
    fs.mkdirSync(servicoUploadDir, { recursive: true });
  }

  for (const file of files) {
    const novoNome = `${servicoId}_${Date.now()}${path.extname(
      file.originalname
    )}`;
    const novoPath = path.join(servicoUploadDir, novoNome);
    fs.renameSync(file.path, novoPath);

    const caminhoServidor = `/upload_arquivos_fibra/${servicoId}/${novoNome}`;

    const [result] = await connection.query(
      `INSERT INTO anexos_servicos_fibra (servico_id, etapa, tipo_anexo, nome_original, caminho_servidor, tamanho) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        servicoId,
        etapa,
        tipoAnexo,
        file.originalname,
        caminhoServidor,
        file.size,
      ]
    );
    anexosSalvos.push({ id: result.insertId, caminho: caminhoServidor });
  }
  return anexosSalvos;
};

router.get("/fibra-optica", autenticar, verificarNivel(3), (req, res) => {
  res.render("pages/fibra_optica/dashboard_fibra.html", {
    user: req.session.user,
  });
});

router.get(
  "/registro_projeto_fibra",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    try {
      const [responsaveis] = await promisePool.query(
        "SELECT matricula, nome FROM users WHERE nivel >= 3 ORDER BY nome ASC"
      );
      res.render("pages/fibra_optica/registro_projeto.html", {
        user: req.session.user,
        responsaveis: responsaveis,
      });
    } catch (error) {
      res.status(500).send("Erro ao carregar a página de registro de projeto.");
    }
  }
);

router.get("/mapa_fibra", autenticar, verificarNivel(3), async (req, res) => {
  try {
    const sqlUltimosPontos = `
      SELECT 
        f.id,
        f.tipo_ponto, 
        f.tag, 
        f.created_at, 
        u.nome as nome_coletor
      FROM fibra_maps f
      LEFT JOIN users u ON f.coletado_por_matricula = u.matricula
      ORDER BY f.id DESC
      LIMIT 10;
    `;
    const [ultimosPontos] = await promisePool.query(sqlUltimosPontos);

    res.render("pages/fibra_optica/mapa_fibra.html", {
      user: req.session.user,
      ultimosPontos: ultimosPontos,
    });
  } catch (error) {
    console.error("Erro ao carregar a página do mapa de fibra:", error);
    res.status(500).send("Erro ao carregar a página do mapa.");
  }
});

router.get(
  "/visualizacao_mapa_fibra",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.render("pages/fibra_optica/visualizacao_mapa.html", {
      user: req.session.user,
    });
  }
);

router.post(
  "/registro_projeto_fibra",
  autenticar,
  verificarNivel(4),
  upload.array("anexos", 10),
  async (req, res) => {
    const {
      tipoGeracao,
      processo,
      tipoOrdem,
      linkMaps,
      localReferencia,
      dataServico,
      horarioInicio,
      horarioFim,
      responsavelMatricula,
      descricao,
      observacoes,
      programado,
    } = req.body;

    if (
      !tipoGeracao ||
      !tipoOrdem ||
      !localReferencia ||
      !responsavelMatricula ||
      !descricao
    ) {
      return res.status(400).json({
        message: "Todos os campos obrigatórios devem ser preenchidos.",
      });
    }

    let connection;
    try {
      connection = await promisePool.getConnection();
      await connection.beginTransaction();

      let processoFinal = processo || null;
      if (tipoGeracao === "normal" && !processo) {
        throw new Error(
          "Número do processo é obrigatório para geração normal."
        );
      }

      let horarioInicioFinal = null;
      let horarioFimFinal = null;

      if (tipoGeracao === "normal" && programado === "on") {
        if (!horarioInicio || !horarioFim) {
          throw new Error(
            "Horário de início e fim são obrigatórios para serviços programados."
          );
        }
        horarioInicioFinal = horarioInicio;
        horarioFimFinal = horarioFim;
      } else if (tipoGeracao === "emergencial") {
        horarioInicioFinal = null;
        horarioFimFinal = null;
      } else {
        horarioInicioFinal = horarioInicio || null;
        horarioFimFinal = horarioFim || null;
      }

      const sqlInsert = `
        INSERT INTO servicos_fibra_optica 
        (tipo_geracao, processo, tipo_ordem, link_maps, local_referencia, data_servico, horario_inicio, horario_fim, responsavel_matricula, descricao, observacoes, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendente')
      `;
      const values = [
        tipoGeracao,
        processoFinal,
        tipoOrdem,
        linkMaps,
        localReferencia,
        dataServico || null,
        horarioInicioFinal,
        horarioFimFinal,
        responsavelMatricula,
        descricao,
        observacoes,
      ];
      const [result] = await connection.query(sqlInsert, values);
      const novoServicoId = result.insertId;

      if (tipoGeracao === "emergencial" && !processo) {
        processoFinal = `emergencial-${novoServicoId}`;
        await connection.query(
          "UPDATE servicos_fibra_optica SET processo = ? WHERE id = ?",
          [processoFinal, novoServicoId]
        );
      }

      if (req.files && req.files.length > 0) {
        await salvarAnexosFibra(
          novoServicoId,
          req.files,
          "Registro",
          "Geral",
          connection
        );
      }

      await registrarAuditoria(
        req.session.user.matricula,
        "CADASTRO_SERVICO_FIBRA",
        `Serviço ID ${novoServicoId} (Processo: ${processoFinal}) criado.`,
        connection
      );

      await connection.commit();
      res.status(201).json({
        message: "Serviço registrado com sucesso!",
        servicoId: novoServicoId,
      });
    } catch (error) {
      if (connection) await connection.rollback();
      if (error.message.includes("obrigatório"))
        return res.status(400).json({ message: error.message });
      res.status(500).json({ message: "Erro interno ao registrar o serviço." });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.get(
  "/projetos_fibra_andamento",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    try {
      const { processo, encarregado, tipoOrdem, status, dataInicio, dataFim } =
        req.query;
      const user = req.session.user;

      const [encarregadosParaFiltro] = await promisePool.query(
        "SELECT matricula, nome FROM users WHERE cargo IN ('Técnico', 'Engenheiro', 'Gerente', 'Encarregado', 'Inspetor', 'ADM', 'Admin') ORDER BY nome ASC"
      );
      const statusOptions = ["Pendente", "Em Andamento", "Pausado"];

      let sql = `
            SELECT 
                s.id, s.processo, s.tipo_ordem, s.data_servico,
                s.horario_inicio, s.horario_fim, s.status,
                u_encarregado.nome AS nome_encarregado
            FROM servicos_fibra_optica s
            LEFT JOIN users u_encarregado ON s.encarregado_matricula = u_encarregado.matricula
        `;

      const whereClauses = [];
      const params = [];

      if (status) {
        whereClauses.push("s.status = ?");
        params.push(status);
      } else {
        whereClauses.push(
          "s.status IN ('Pendente', 'Em Andamento', 'Pausado')"
        );
      }

      if (processo) {
        whereClauses.push("s.processo LIKE ?");
        params.push(`%${processo}%`);
      }
      if (encarregado) {
        whereClauses.push("s.encarregado_matricula = ?");
        params.push(encarregado);
      }
      if (tipoOrdem) {
        whereClauses.push("s.tipo_ordem = ?");
        params.push(tipoOrdem);
      }
      if (dataInicio) {
        whereClauses.push("s.data_servico >= ?");
        params.push(dataInicio);
      }
      if (dataFim) {
        whereClauses.push("s.data_servico <= ?");
        params.push(dataFim);
      }

      const cargosComVisaoTotal = [
        "TÉCNICO",
        "ENGENHEIRO",
        "GERENTE",
        "ADM",
        "ADMIN",
        "INSPETOR",
      ];

      if (!cargosComVisaoTotal.includes(user.cargo.toUpperCase())) {
        whereClauses.push("s.encarregado_matricula = ?");
        params.push(user.matricula);
      }

      if (whereClauses.length > 0) {
        sql += " WHERE " + whereClauses.join(" AND ");
      }

      sql += " ORDER BY s.created_at DESC;";

      const [servicos] = await promisePool.query(sql, params);

      res.render("pages/fibra_optica/projetos_andamento.html", {
        user: req.session.user,
        servicos: servicos,
        encarregados: encarregadosParaFiltro,
        statusOptions: statusOptions,
        filtros: req.query,
      });
    } catch (error) {
      console.error("Erro ao carregar projetos em andamento:", error);
      res
        .status(500)
        .send("Erro ao carregar a página de serviços em andamento.");
    }
  }
);

router.get(
  "/projetos_fibra_concluidos",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    try {
      const { encarregado, tipoOrdem, status, dataInicio, dataFim } = req.query;
      const user = req.session.user;

      const [encarregadosParaFiltro] = await promisePool.query(
        "SELECT matricula, nome FROM users WHERE cargo IN ('Técnico', 'Engenheiro', 'Gerente', 'Encarregado', 'Inspetor', 'ADM', 'Admin') ORDER BY nome ASC"
      );
      const statusOptions = [
        "Concluído",
        "Concluído com Pendência",
        "Cancelado",
      ];

      let sql = `
            SELECT 
                s.id, s.processo, s.tipo_ordem, s.data_conclusao,
                s.horario_conclusao, s.status,
                u_encarregado.nome AS nome_encarregado,
                (SELECT COUNT(*) FROM anexos_servicos_fibra a WHERE a.servico_id = s.id AND a.tipo_anexo = 'APR') as apr_count
            FROM servicos_fibra_optica s
            LEFT JOIN users u_encarregado ON s.encarregado_matricula = u_encarregado.matricula
        `;

      const whereClauses = [];
      const params = [];

      if (status) {
        whereClauses.push("s.status = ?");
        params.push(status);
      } else {
        whereClauses.push(
          "s.status IN ('Concluído', 'Concluído com Pendência', 'Cancelado')"
        );
      }

      if (encarregado) {
        whereClauses.push("s.encarregado_matricula = ?");
        params.push(encarregado);
      }
      if (tipoOrdem) {
        whereClauses.push("s.tipo_ordem = ?");
        params.push(tipoOrdem);
      }
      if (dataInicio) {
        whereClauses.push("s.data_conclusao >= ?");
        params.push(dataInicio);
      }
      if (dataFim) {
        whereClauses.push("s.data_conclusao <= ?");
        params.push(dataFim);
      }

      const cargosGestao = [
        "TÉCNICO",
        "ENGENHEIRO",
        "GERENTE",
        "ADM",
        "ADMIN",
        "INSPETOR",
      ];
      if (!cargosGestao.includes(user.cargo.toUpperCase())) {
        whereClauses.push("s.encarregado_matricula = ?");
        params.push(user.matricula);
      }

      if (whereClauses.length > 0) {
        sql += " WHERE " + whereClauses.join(" AND ");
      }

      sql += " ORDER BY s.data_conclusao DESC, s.updated_at DESC;";

      const [servicos] = await promisePool.query(sql, params);

      res.render("pages/fibra_optica/projetos_concluidos.html", {
        user: req.session.user,
        servicos: servicos,
        encarregados: encarregadosParaFiltro,
        statusOptions: statusOptions,
        filtros: req.query,
      });
    } catch (error) {
      res.status(500).send("Erro ao carregar a página de serviços concluídos.");
    }
  }
);

router.get(
  "/fibra/servico/:id",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const { id } = req.params;

    try {
      const servicoSql = `
            SELECT 
                s.*,
                resp.nome AS nome_responsavel,
                enc.nome AS nome_encarregado
            FROM 
                servicos_fibra_optica s
            LEFT JOIN 
                users resp ON s.responsavel_matricula = resp.matricula
            LEFT JOIN 
                users enc ON s.encarregado_matricula = enc.matricula
            WHERE 
                s.id = ?;
        `;
      const [servicoRows] = await promisePool.query(servicoSql, [id]);

      if (servicoRows.length === 0) {
        return res.status(404).send("Serviço não encontrado.");
      }

      const anexosSql = `
            SELECT id, nome_original, caminho_servidor, tamanho, etapa 
            FROM anexos_servicos_fibra 
            WHERE servico_id = ?;
        `;
      const [anexos] = await promisePool.query(anexosSql, [id]);

      res.render("pages/fibra_optica/servico_detalhes.html", {
        user: req.session.user,
        servico: servicoRows[0],
        anexos: anexos,
      });
    } catch (error) {
      res.status(500).send("Erro ao carregar os detalhes do serviço.");
    }
  }
);

router.get(
  "/fibra/servico/:id/editar",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { id } = req.params;
    try {
      const [servicoRows] = await promisePool.query(
        "SELECT * FROM servicos_fibra_optica WHERE id = ?",
        [id]
      );

      if (servicoRows.length === 0) {
        return res.status(404).send("Serviço não encontrado.");
      }

      const [responsaveis] = await promisePool.query(
        "SELECT matricula, nome FROM users WHERE nivel >= 3 ORDER BY nome ASC"
      );

      const [anexos] = await promisePool.query(
        "SELECT id, nome_original FROM anexos_servicos_fibra WHERE servico_id = ?",
        [id]
      );

      res.render("pages/fibra_optica/editar_servico.html", {
        user: req.session.user,
        servico: servicoRows[0],
        responsaveis: responsaveis,
        anexos: anexos,
      });
    } catch (error) {
      console.error("Erro ao carregar página de edição:", error);
      res.status(500).send("Erro ao carregar a página de edição.");
    }
  }
);

router.post(
  "/fibra/servico/:id/editar",
  autenticar,
  verificarNivel(4),
  upload.array("anexos", 10),
  async (req, res) => {
    const { id } = req.params;
    const {
      processo,
      tipoOrdem,
      linkMaps,
      localReferencia,
      dataServico,
      horarioInicio,
      horarioFim,
      responsavelMatricula,
      descricao,
      observacoes,
      anexos_a_remover,
    } = req.body;

    let connection;
    try {
      connection = await promisePool.getConnection();
      await connection.beginTransaction();

      if (anexos_a_remover) {
        const idsParaRemover = anexos_a_remover.split(",").filter(Boolean);
        if (idsParaRemover.length > 0) {
          for (const anexoId of idsParaRemover) {
            const [anexoRows] = await connection.query(
              "SELECT caminho_servidor FROM anexos_servicos_fibra WHERE id = ? AND servico_id = ?",
              [anexoId, id]
            );
            if (anexoRows.length > 0) {
              const caminhoRelativo = anexoRows[0].caminho_servidor;
              const caminhoCorrigido = caminhoRelativo.startsWith("/")
                ? caminhoRelativo.substring(1)
                : caminhoRelativo;
              const caminhoCompleto = path.join(
                projectRootDir,
                caminhoCorrigido
              );

              if (fs.existsSync(caminhoCompleto)) {
                fs.unlinkSync(caminhoCompleto);
              }
            }
            await connection.query(
              "DELETE FROM anexos_servicos_fibra WHERE id = ?",
              [anexoId]
            );
          }
        }
      }

      const sqlUpdate = `
        UPDATE servicos_fibra_optica SET
          processo = ?, tipo_ordem = ?, link_maps = ?, local_referencia = ?,
          data_servico = ?, horario_inicio = ?, horario_fim = ?,
          responsavel_matricula = ?, descricao = ?, observacoes = ?
        WHERE id = ?
      `;
      const values = [
        processo,
        tipoOrdem,
        linkMaps,
        localReferencia,
        dataServico || null,
        horarioInicio,
        horarioFim,
        responsavelMatricula,
        descricao,
        observacoes,
        id,
      ];

      await connection.query(sqlUpdate, values);

      if (req.files && req.files.length > 0) {
        await salvarAnexosFibra(id, req.files, "Edicao", "Geral", connection);
      }

      await registrarAuditoria(
        req.session.user.matricula,
        "EDICAO_SERVICO_FIBRA",
        `Serviço ID ${id} foi atualizado.`,
        connection
      );

      await connection.commit();
      res.status(200).json({
        message: "Serviço atualizado com sucesso!",
        servicoId: id,
      });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error("Erro ao atualizar serviço:", error);
      res.status(500).json({ message: "Erro interno ao atualizar o serviço." });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.get(
  "/api/fibra/encarregados",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    try {
      const cargosPermitidos = [
        "Técnico",
        "Engenheiro",
        "Gerente",
        "Encarregado",
        "Inspetor",
        "ADM",
        "Admin",
      ];
      const [encarregados] = await promisePool.query(
        "SELECT matricula, nome, cargo FROM users WHERE cargo IN (?) ORDER BY nome ASC",
        [cargosPermitidos]
      );
      res.json(encarregados);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Erro ao buscar lista de encarregados." });
    }
  }
);

router.get(
  "/api/fibra/todos-os-pontos",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    try {
      const [pontos] = await promisePool.query(`
      SELECT 
        f.id,
        f.tipo_ponto,
        f.tag,
        f.latitude,
        f.longitude,
        f.altitude,
        f.easting,
        f.northing,
        f.created_at,
        u.nome as nome_coletor
      FROM fibra_maps f
      LEFT JOIN users u ON f.coletado_por_matricula = u.matricula
      ORDER BY f.id DESC
    `);
      res.json(pontos);
    } catch (error) {
      console.error("Erro ao buscar todos os pontos de fibra:", error);
      res.status(500).json({ message: "Erro interno ao buscar os pontos." });
    }
  }
);

router.post(
  "/api/fibra/modificar-atribuicao",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { servicoId, encarregadoMatricula } = req.body;

    if (!servicoId) {
      return res.status(400).json({ message: "ID do serviço é obrigatório." });
    }

    try {
      if (encarregadoMatricula) {
        await promisePool.query(
          "UPDATE servicos_fibra_optica SET encarregado_matricula = ?, status = 'Em Andamento' WHERE id = ?",
          [encarregadoMatricula, servicoId]
        );
        await registrarAuditoria(
          req.session.user.matricula,
          "ATRIBUICAO_ENCARREGADO_FIBRA",
          `Encarregado Matrícula ${encarregadoMatricula} atribuído ao Serviço ID ${servicoId}.`
        );
        res.json({ message: "Encarregado atribuído com sucesso!" });
      } else {
        await promisePool.query(
          "UPDATE servicos_fibra_optica SET encarregado_matricula = NULL, status = 'Pendente' WHERE id = ?",
          [servicoId]
        );
        await registrarAuditoria(
          req.session.user.matricula,
          "REMOCAO_ENCARREGADO_FIBRA",
          `Atribuição removida do Serviço ID ${servicoId}. Status alterado para Pendente.`
        );
        res.json({
          message: "Atribuição removida e serviço retornado para pendente.",
        });
      }
    } catch (error) {
      res
        .status(500)
        .json({ message: "Erro interno ao modificar atribuição." });
    }
  }
);

router.post(
  "/api/fibra/finalizar-servico",
  autenticar,
  verificarNivel(3),
  upload.array("anexosConclusao", 10),
  async (req, res) => {
    const { servicoId, statusConclusao, dataConclusao, horarioConclusao } =
      req.body;
    const matriculaUsuario = req.session.user.matricula;
    const pontosMapa = req.body.pontosMapa
      ? JSON.parse(req.body.pontosMapa)
      : [];

    if (!servicoId || !statusConclusao || !dataConclusao || !horarioConclusao) {
      return res
        .status(400)
        .json({ message: "Dados de conclusão incompletos." });
    }

    if (!["Concluído", "Concluído com Pendência"].includes(statusConclusao)) {
      return res.status(400).json({ message: "Status de conclusão inválido." });
    }

    let connection;
    try {
      connection = await promisePool.getConnection();
      await connection.beginTransaction();

      await connection.query(
        "UPDATE servicos_fibra_optica SET status = ?, data_conclusao = ?, horario_conclusao = ? WHERE id = ?",
        [statusConclusao, dataConclusao, horarioConclusao, servicoId]
      );

      if (pontosMapa && Array.isArray(pontosMapa) && pontosMapa.length > 0) {
        const sqlInsertPonto =
          "INSERT INTO fibra_maps (servico_id, tipo_ponto, tag, utm_zone, easting, northing, altitude, latitude, longitude, coletado_por_matricula) VALUES ?";

        const values = pontosMapa.map((ponto) => {
          const { latitude, longitude } = convertUtmToLatLon(
            ponto.easting,
            ponto.northing,
            ponto.utm_zone
          );
          return [
            servicoId,
            ponto.tipo,
            ponto.tag,
            ponto.utm_zone,
            String(ponto.easting).replace(",", "."),
            String(ponto.northing).replace(",", "."),
            String(ponto.altitude).replace(",", "."),
            latitude,
            longitude,
            matriculaUsuario,
          ];
        });
        await connection.query(sqlInsertPonto, [values]);
      }

      if (req.files && req.files.length > 0) {
        await salvarAnexosFibra(
          servicoId,
          req.files,
          "Conclusao",
          "Geral",
          connection
        );
      }

      await registrarAuditoria(
        req.session.user.matricula,
        "FINALIZACAO_SERVICO_FIBRA",
        `Serviço ID ${servicoId} finalizado com status "${statusConclusao}". ${
          pontosMapa.length || 0
        } pontos de mapa e ${
          req.files ? req.files.length : 0
        } anexos registrados.`,
        connection
      );

      await connection.commit();
      res.json({ message: "Serviço finalizado com sucesso!" });
    } catch (error) {
      if (connection) await connection.rollback();
      res.status(500).json({ message: "Erro interno ao finalizar o serviço." });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.post(
  "/api/fibra/reabrir-servico",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { servicoId } = req.body;
    if (!servicoId) {
      return res.status(400).json({ message: "ID do serviço é obrigatório." });
    }

    try {
      await promisePool.query(
        "UPDATE servicos_fibra_optica SET status = 'Pendente', data_conclusao = NULL, horario_conclusao = NULL WHERE id = ?",
        [servicoId]
      );

      await registrarAuditoria(
        req.session.user.matricula,
        "REABERTURA_SERVICO_FIBRA",
        `Serviço de Fibra ID ${servicoId} foi reaberto.`
      );

      res.json({ message: "Serviço reaberto com sucesso!" });
    } catch (error) {
      res.status(500).json({ message: "Erro interno ao reabrir o serviço." });
    }
  }
);

router.post(
  "/api/fibra/upload-apr",
  autenticar,
  verificarNivel(3),
  upload.array("anexosAPR", 5),
  async (req, res) => {
    const { servicoId } = req.body;
    if (!servicoId || !req.files || req.files.length === 0) {
      return res.status(400).json({
        message: "ID do serviço e ao menos um anexo são obrigatórios.",
      });
    }

    let connection;
    try {
      connection = await promisePool.getConnection();
      await connection.beginTransaction();

      await salvarAnexosFibra(
        servicoId,
        req.files,
        "Conclusao",
        "APR",
        connection
      );

      await registrarAuditoria(
        req.session.user.matricula,
        "UPLOAD_APR_FIBRA",
        `${req.files.length} anexo(s) APR adicionado(s) ao Serviço ID ${servicoId}.`,
        connection
      );

      await connection.commit();
      res.json({ message: "APR(s) anexadas com sucesso!" });
    } catch (error) {
      if (connection) await connection.rollback();
      res.status(500).json({ message: "Erro interno ao anexar APR." });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.post(
  "/api/fibra/salvar-pontos-mapa",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const { pontos } = req.body;
    const matriculaUsuario = req.session.user.matricula;

    if (!pontos || !Array.isArray(pontos) || pontos.length === 0) {
      return res.status(400).json({ message: "Nenhum ponto válido recebido." });
    }

    let connection;
    try {
      connection = await promisePool.getConnection();
      await connection.beginTransaction();

      const sqlInsert =
        "INSERT INTO fibra_maps (tipo_ponto, tag, utm_zone, easting, northing, altitude, latitude, longitude, coletado_por_matricula) VALUES ?";

      const values = pontos.map((ponto) => {
        const { latitude, longitude } = convertUtmToLatLon(
          ponto.easting,
          ponto.northing,
          ponto.utm_zone
        );
        return [
          ponto.tipo,
          ponto.tag,
          ponto.utm_zone,
          String(ponto.easting).replace(",", "."),
          String(ponto.northing).replace(",", "."),
          String(ponto.altitude).replace(",", "."),
          latitude,
          longitude,
          matriculaUsuario,
        ];
      });

      await connection.query(sqlInsert, [values]);

      await registrarAuditoria(
        matriculaUsuario,
        "COLETA_PONTOS_MAPA_FIBRA",
        `${pontos.length} ponto(s) de mapa de fibra foram registrados.`,
        connection
      );

      await connection.commit();
      res.status(201).json({ message: "Pontos salvos com sucesso!" });
    } catch (error) {
      if (connection) await connection.rollback();
      res.status(500).json({ message: "Erro interno ao salvar os pontos." });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.delete(
  "/api/fibra/ponto-mapa/:id",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { id } = req.params;
    const matriculaUsuario = req.session.user.matricula;

    try {
      const [result] = await promisePool.query(
        "DELETE FROM fibra_maps WHERE id = ?",
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Ponto não encontrado." });
      }

      await registrarAuditoria(
        matriculaUsuario,
        "EXCLUSAO_PONTO_MAPA_FIBRA",
        `Ponto de mapa ID ${id} foi excluído.`
      );

      res.status(200).json({ message: "Ponto excluído com sucesso!" });
    } catch (error) {
      res.status(500).json({ message: "Erro interno ao excluir o ponto." });
    }
  }
);

router.delete(
  "/api/fibra/servico/:id",
  autenticar,
  verificarNivel(5),
  async (req, res) => {
    const { id } = req.params;

    let connection;
    try {
      connection = await promisePool.getConnection();
      await connection.beginTransaction();

      const uploadDir = path.join(
        projectRootDir,
        "upload_arquivos_fibra",
        String(id)
      );
      if (fs.existsSync(uploadDir)) {
        fs.rmSync(uploadDir, { recursive: true, force: true });
      }

      await connection.query("DELETE FROM servicos_fibra_optica WHERE id = ?", [
        id,
      ]);

      await registrarAuditoria(
        req.session.user.matricula,
        "EXCLUSAO_SERVICO_FIBRA",
        `Serviço de Fibra ID ${id} e seus anexos foram excluídos.`,
        connection
      );

      await connection.commit();
      res.json({ message: "Serviço excluído com sucesso!" });
    } catch (error) {
      if (connection) await connection.rollback();
      res.status(500).json({ message: "Erro interno ao excluir o serviço." });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.get(
  "/api/fibra/servico/:id/aprs",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const { id } = req.params;
    try {
      const [anexos] = await promisePool.query(
        "SELECT id, nome_original, caminho_servidor FROM anexos_servicos_fibra WHERE servico_id = ? AND tipo_anexo = 'APR'",
        [id]
      );
      res.json(anexos);
    } catch (error) {
      console.error("Erro ao buscar anexos APR:", error);
      res.status(500).json({ message: "Erro interno ao buscar anexos." });
    }
  }
);

router.delete(
  "/api/fibra/anexo-apr/:id",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
      connection = await promisePool.getConnection();
      await connection.beginTransaction();

      const [anexoRows] = await connection.query(
        "SELECT caminho_servidor FROM anexos_servicos_fibra WHERE id = ?",
        [id]
      );

      if (anexoRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: "Anexo não encontrado." });
      }

      const caminhoRelativo = anexoRows[0].caminho_servidor;
      if (caminhoRelativo) {
        const caminhoCorrigido = caminhoRelativo.startsWith("/")
          ? caminhoRelativo.substring(1)
          : caminhoRelativo;
        const caminhoCompleto = path.join(projectRootDir, caminhoCorrigido);

        if (fs.existsSync(caminhoCompleto)) {
          fs.unlinkSync(caminhoCompleto);
        }
      }

      await connection.query("DELETE FROM anexos_servicos_fibra WHERE id = ?", [
        id,
      ]);

      await registrarAuditoria(
        req.session.user.matricula,
        "EXCLUSAO_ANEXO_APR_FIBRA",
        `Anexo APR ID ${id} foi excluído.`,
        connection
      );

      await connection.commit();
      res.json({ message: "Anexo APR excluído com sucesso!" });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error("Erro ao excluir anexo APR:", error);
      res.status(500).json({ message: "Erro interno ao excluir o anexo." });
    } finally {
      if (connection) connection.release();
    }
  }
);

module.exports = router;
