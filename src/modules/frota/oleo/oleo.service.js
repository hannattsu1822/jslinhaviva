const { promisePool } = require("../../../init");

async function listarVeiculosParaOleo() {
  const [rows] = await promisePool.query(
    "SELECT id, placa, modelo FROM veiculos ORDER BY placa"
  );
  return rows;
}

async function listarTecnicosParaOleo() {
  const [rows] = await promisePool.query(
    "SELECT id, matricula, nome FROM users WHERE cargo IN ('Técnico', 'Engenheiro') ORDER BY nome"
  );
  return rows;
}

async function registrarTrocaOleo(dadosTroca) {
  const { veiculo_id, responsavel_id, data_troca, horimetro, observacoes } =
    dadosTroca;
  if (!veiculo_id || !responsavel_id || !data_troca || !horimetro) {
    throw new Error("Preencha todos os campos obrigatórios!");
  }
  if (parseFloat(horimetro) < 0) {
    throw new Error("Horímetro deve ser um valor positivo!");
  }

  const [veiculo] = await promisePool.query(
    "SELECT id, placa FROM veiculos WHERE id = ?",
    [veiculo_id]
  );
  if (veiculo.length === 0) {
    throw new Error("Veículo não encontrado!");
  }
  const placa = veiculo[0].placa;

  const [responsavel] = await promisePool.query(
    'SELECT id, matricula FROM users WHERE id = ? AND cargo IN ("Técnico", "Engenheiro")',
    [responsavel_id]
  );
  if (responsavel.length === 0) {
    throw new Error("Responsável técnico não encontrado ou não autorizado!");
  }

  const [ultimaTrocaOleo] = await promisePool.query(
    "SELECT horimetro FROM trocas_oleo WHERE veiculo_id = ? ORDER BY data_troca DESC LIMIT 1",
    [veiculo_id]
  );
  const horimetroUltimaTroca = ultimaTrocaOleo[0]?.horimetro || 0;

  if (parseFloat(horimetro) < parseFloat(horimetroUltimaTroca)) {
    throw new Error(
      `O horímetro informado (${horimetro}) deve ser maior ou igual ao último registrado para troca de óleo (${horimetroUltimaTroca})`
    );
  }

  const query = `INSERT INTO trocas_oleo (veiculo_id, responsavel_id, data_troca, horimetro, observacoes) VALUES (?, ?, ?, ?, ?)`;
  const values = [
    veiculo_id,
    responsavel_id,
    data_troca,
    horimetro,
    observacoes || null,
  ];
  const [result] = await promisePool.query(query, values);

  return {
    id: result.insertId,
    placa: placa,
  };
}

async function listarHistoricoOleo(veiculo_id) {
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
  return rows;
}

async function calcularProximasTrocas() {
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
  return cards;
}

async function deletarTrocaOleo(id) {
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

  if (result.affectedRows === 0) {
    throw new Error(
      `Registro de troca de óleo com ID ${id} não encontrado para exclusão!`
    );
  }
  return { placa };
}

module.exports = {
  listarVeiculosParaOleo,
  listarTecnicosParaOleo,
  registrarTrocaOleo,
  listarHistoricoOleo,
  calcularProximasTrocas,
  deletarTrocaOleo,
};
