const { promisePool } = require("../../../init");

async function listarDispositivosParaGerenciamento() {
  const [devices] = await promisePool.query(
    "SELECT id, local_tag, serial_number, descricao, ativo, ultima_leitura, status_json FROM dispositivos_logbox ORDER BY local_tag"
  );

  return devices.map((device) => {
    let status = {};
    
    try {
      status = device.status_json && typeof device.status_json === "string"
        ? JSON.parse(device.status_json)
        : device.status_json || {};
    } catch (e) {
      console.error(`Erro ao parsear status_json para SN ${device.serial_number}:`, device.status_json);
      status = {};
    }

    const temperaturaExterna = status.ch_analog_1 !== undefined
      ? status.ch_analog_1
      : status.value_channels
      ? status.value_channels[2]
      : null;

    return {
      ...device,
      temperatura_externa: temperaturaExterna,
      connection_status: status.connection_status || "offline",
    };
  });
}

async function listarDispositivosAtivos() {
  const [devices] = await promisePool.query(
    "SELECT id, local_tag, serial_number, ativo FROM dispositivos_logbox WHERE ativo = 1 ORDER BY local_tag"
  );
  return devices;
}

async function obterDispositivoPorId(id) {
  const [rows] = await promisePool.query(
    "SELECT * FROM dispositivos_logbox WHERE id = ?",
    [id]
  );

  if (rows.length === 0) {
    throw new Error("Dispositivo não encontrado");
  }

  return rows[0];
}

async function salvarDispositivo(dadosDispositivo) {
  const { id, local_tag, serial_number, descricao } = dadosDispositivo;

  if (!local_tag || local_tag.trim() === "") {
    throw new Error("Local/Tag é obrigatório");
  }

  if (!serial_number || serial_number.trim() === "") {
    throw new Error("Número de série é obrigatório");
  }

  if (id) {
    await promisePool.query(
      "UPDATE dispositivos_logbox SET local_tag = ?, serial_number = ?, descricao = ? WHERE id = ?",
      [local_tag, serial_number, descricao, id]
    );
  } else {
    await promisePool.query(
      "INSERT INTO dispositivos_logbox (local_tag, serial_number, descricao) VALUES (?, ?, ?)",
      [local_tag, serial_number, descricao]
    );
  }
}

async function excluirDispositivo(id) {
  await promisePool.query("DELETE FROM dispositivos_logbox WHERE id = ?", [id]);
}

module.exports = {
  listarDispositivosParaGerenciamento,
  listarDispositivosAtivos,
  obterDispositivoPorId,
  salvarDispositivo,
  excluirDispositivo,
};
