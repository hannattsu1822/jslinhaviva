const { promisePool } = require("../../infrastructure/database");

const NIVEL_DELEGAR_MOTORISTA = 7;

async function assertMotoristaExiste(matricula) {
  const [rows] = await promisePool.query(
    "SELECT matricula FROM users WHERE matricula = ? AND nivel > 0",
    [matricula]
  );
  if (rows.length === 0) {
    throw new Error("Motorista não encontrado ou inativo.");
  }
}

async function listarMotoristas() {
  const [rows] = await promisePool.query(
    "SELECT matricula, nome, cargo FROM users WHERE nivel > 0 ORDER BY nome ASC"
  );
  return rows;
}

async function listarVeiculos() {
  const [veiculos] = await promisePool.query(
    "SELECT id, placa, modelo FROM veiculos_frota WHERE status = 'ATIVO' ORDER BY modelo, placa"
  );
  return veiculos;
}

async function obterUltimoKm(veiculoId) {
  if (!veiculoId) {
    throw new Error("ID do veículo é obrigatório.");
  }
  const [rows] = await promisePool.query(
    "SELECT chegada_km FROM prv_registros WHERE veiculo_id = ? AND chegada_km IS NOT NULL ORDER BY id DESC LIMIT 1",
    [veiculoId]
  );
  return rows.length > 0 ? rows[0].chegada_km : null;
}

async function obterStatusViagem(veiculoId) {
  if (!veiculoId) {
    throw new Error("ID do veículo é obrigatório.");
  }
  const [rows] = await promisePool.query(
    "SELECT * FROM prv_registros WHERE veiculo_id = ? AND chegada_km IS NULL LIMIT 1",
    [veiculoId]
  );
  return rows.length > 0 ? rows[0] : null;
}

async function listarRegistros(veiculoId, mesAno) {
  if (!veiculoId || !mesAno) {
    throw new Error("ID do veículo e Mês/Ano são obrigatórios.");
  }
  const [ano, mes] = mesAno.split("-");
  const mesAnoFormatado = `${mes}/${ano}`;
  const [registros] = await promisePool.query(
    `SELECT r.*,
      DATE_FORMAT(
        STR_TO_DATE(CONCAT(r.dia, '/', r.mes_ano_referencia), '%d/%m/%Y'),
        '%Y-%m-%d'
      ) AS data_viagem
     FROM prv_registros r
     WHERE r.veiculo_id = ? AND r.mes_ano_referencia = ? AND r.chegada_km IS NOT NULL
     ORDER BY data_viagem, r.saida_horario`,
    [veiculoId, mesAnoFormatado]
  );
  return registros;
}

async function iniciarViagem(dadosViagem, matriculaOperador, nivelOperador) {
  const {
    veiculo_id,
    data_viagem,
    saida_horario,
    saida_local,
    saida_km,
    motorista_matricula: motoristaInformado,
  } = dadosViagem;
  if (!veiculo_id || !data_viagem || !saida_km) {
    throw new Error("Veículo, Data da Viagem e KM de Saída são obrigatórios.");
  }

  let motoristaMatricula = matriculaOperador;
  const matriculaInformada =
    typeof motoristaInformado === "string"
      ? motoristaInformado.trim()
      : "";

  if (matriculaInformada && matriculaInformada !== matriculaOperador) {
    if (nivelOperador < NIVEL_DELEGAR_MOTORISTA) {
      throw new Error(
        "Você não tem permissão para registrar saída em nome de outro motorista."
      );
    }
    await assertMotoristaExiste(matriculaInformada);
    motoristaMatricula = matriculaInformada;
  }

  const criadoPorMatricula =
    motoristaMatricula !== matriculaOperador ? matriculaOperador : null;

  const [viagemAberta] = await promisePool.query(
    "SELECT id FROM prv_registros WHERE veiculo_id = ? AND chegada_km IS NULL",
    [veiculo_id]
  );
  if (viagemAberta.length > 0) {
    throw new Error(
      "Não é possível iniciar uma nova viagem. Já existe uma em andamento para este veículo."
    );
  }

  const [ultimoKmRows] = await promisePool.query(
    "SELECT chegada_km FROM prv_registros WHERE veiculo_id = ? AND chegada_km IS NOT NULL ORDER BY id DESC LIMIT 1",
    [veiculo_id]
  );
  if (ultimoKmRows.length > 0) {
    const ultimoKmRegistrado = ultimoKmRows[0].chegada_km;
    if (parseInt(saida_km, 10) !== ultimoKmRegistrado) {
      throw new Error(
        `O KM de saída (${saida_km}) não corresponde ao último KM final registrado (${ultimoKmRegistrado}) para este veículo.`
      );
    }
  }

  const [ano, mes, dia] = data_viagem.split("-");
  const mesAnoFormatado = `${mes}/${ano}`;
  const sql = `
        INSERT INTO prv_registros 
        (veiculo_id, mes_ano_referencia, dia, saida_horario, saida_local, saida_km, motorista_matricula, criado_por_matricula)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
  const [result] = await promisePool.query(sql, [
    veiculo_id,
    mesAnoFormatado,
    dia,
    saida_horario,
    saida_local,
    saida_km,
    motoristaMatricula,
    criadoPorMatricula,
  ]);
  return {
    id: result.insertId,
    motoristaMatricula,
    criadoPorMatricula,
  };
}

async function finalizarViagem(id, dadosChegada, matriculaUsuario, nivelUsuario) {
  const {
    chegada_horario,
    chegada_local,
    chegada_km,
    processo,
    tipo_servico,
    ocorrencias,
  } = dadosChegada;
  if (!chegada_km) {
    throw new Error("KM de Chegada é obrigatório.");
  }

  const [registros] = await promisePool.query(
    "SELECT motorista_matricula FROM prv_registros WHERE id = ?",
    [id]
  );
  if (registros.length === 0) {
    throw new Error("Registro de saída não encontrado.");
  }
  if (
    nivelUsuario < 4 &&
    registros[0].motorista_matricula !== matriculaUsuario
  ) {
    throw new Error("Você não tem permissão para finalizar este registro.");
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
    throw new Error("Registro de saída não encontrado.");
  }
}

async function excluirRegistro(id, matriculaUsuario, nivelUsuario) {
  const [registros] = await promisePool.query(
    "SELECT motorista_matricula FROM prv_registros WHERE id = ?",
    [id]
  );
  if (registros.length === 0) {
    throw new Error("Registro não encontrado.");
  }
  if (
    nivelUsuario < 4 &&
    registros[0].motorista_matricula !== matriculaUsuario
  ) {
    throw new Error("Você não tem permissão para excluir este registro.");
  }

  const [result] = await promisePool.query(
    "DELETE FROM prv_registros WHERE id = ?",
    [id]
  );
  if (result.affectedRows === 0) {
    throw new Error("Registro não encontrado.");
  }
}

module.exports = {
  NIVEL_DELEGAR_MOTORISTA,
  listarMotoristas,
  listarVeiculos,
  obterUltimoKm,
  obterStatusViagem,
  listarRegistros,
  iniciarViagem,
  finalizarViagem,
  excluirRegistro,
};
