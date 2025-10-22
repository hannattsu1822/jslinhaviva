const { promisePool } = require("../../init");

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
    "SELECT * FROM prv_registros WHERE veiculo_id = ? AND mes_ano_referencia = ? AND chegada_km IS NOT NULL ORDER BY dia, saida_horario",
    [veiculoId, mesAnoFormatado]
  );
  return registros;
}

async function iniciarViagem(dadosViagem, matriculaMotorista) {
  const { veiculo_id, data_viagem, saida_horario, saida_local, saida_km } =
    dadosViagem;
  if (!veiculo_id || !data_viagem || !saida_km) {
    throw new Error("Veículo, Data da Viagem e KM de Saída são obrigatórios.");
  }

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
    matriculaMotorista,
  ]);
  return { id: result.insertId };
}

async function finalizarViagem(id, dadosChegada) {
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

async function excluirRegistro(id) {
  const [result] = await promisePool.query(
    "DELETE FROM prv_registros WHERE id = ?",
    [id]
  );
  if (result.affectedRows === 0) {
    throw new Error("Registro não encontrado.");
  }
}

module.exports = {
  listarVeiculos,
  obterUltimoKm,
  obterStatusViagem,
  listarRegistros,
  iniciarViagem,
  finalizarViagem,
  excluirRegistro,
};
