const service = require("./veiculos.service");
const { registrarAuditoria } = require("../../../auth");

async function listarMotoristas(req, res) {
  try {
    const motoristas = await service.listarMotoristas();
    res.status(200).json(motoristas);
  } catch (err) {
    console.error("Erro ao buscar motoristas:", err);
    res.status(500).json({ message: "Erro ao buscar motoristas!" });
  }
}

async function listarEncarregados(req, res) {
  try {
    const encarregados = await service.listarEncarregados();
    res.status(200).json(encarregados);
  } catch (err) {
    console.error("Erro ao buscar encarregados:", err);
    res.status(500).json({ message: "Erro ao buscar encarregados!" });
  }
}

async function listarPlacas(req, res) {
  try {
    const placas = await service.listarPlacas();
    res.status(200).json(placas);
  } catch (err) {
    console.error("Erro ao buscar placas:", err);
    res.status(500).json({ message: "Erro ao buscar placas!" });
  }
}

async function listarVeiculosControle(req, res) {
  try {
    const veiculos = await service.listarVeiculosControle(req.query.placa);
    res.status(200).json(veiculos);
  } catch (err) {
    console.error("Erro ao buscar veículos:", err);
    res.status(500).json({ message: "Erro ao buscar veículos!" });
  }
}

async function listarInventario(req, res) {
  try {
    const inventario = await service.listarInventario();
    res.status(200).json(inventario);
  } catch (err) {
    console.error("Erro ao buscar veículos do inventário:", err);
    res.status(500).json({ message: "Erro ao buscar veículos do inventário!" });
  }
}

async function criarItemInventario(req, res) {
  try {
    const { id } = await service.criarItemInventario(req.body);
    await registrarAuditoria(
      req.user.matricula,
      "Cadastro de Veículo",
      `Veículo placa: ${req.body.placa}, nome: ${req.body.nome} cadastrado.`
    );
    res.status(201).json({ message: "Veículo cadastrado com sucesso!", id });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ message: "Placa ou código já cadastrado." });
    }
    const statusCode = err.message.includes("obrigatórios") ? 400 : 500;
    console.error("Erro ao cadastrar veículo:", err);
    res.status(statusCode).json({ message: err.message });
  }
}

async function deletarItemInventario(req, res) {
  try {
    const { id } = req.params;
    const { placa } = await service.deletarItemInventario(id);
    await registrarAuditoria(
      req.user.matricula,
      "Exclusão de Veículo",
      `Veículo com ID: ${id} e Placa: ${placa} foi excluído.`
    );
    res.status(200).json({ message: "Veículo excluído com sucesso!" });
  } catch (err) {
    console.error("Erro ao excluir veículo:", err);
    const statusCode = err.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function listarMotoristasCrud(req, res) {
  try {
    const motoristas = await service.listarMotoristasCrud();
    res.json(motoristas);
  } catch (err) {
    console.error("Erro ao buscar motoristas (CRUD):", err);
    res.status(500).json({ message: "Erro interno ao buscar motoristas." });
  }
}

async function criarMotoristaCrud(req, res) {
  try {
    const { id } = await service.criarMotoristaCrud(req.body);
    await registrarAuditoria(
      req.user.matricula,
      "CADASTRO_MOTORISTA_CRUD",
      `Motorista ID ${id} (Matrícula: ${req.body.matricula}, Nome: ${req.body.nome}) cadastrado via CRUD.`
    );
    res.status(201).json({ message: "Motorista cadastrado com sucesso!", id });
  } catch (err) {
    console.error("Erro ao cadastrar motorista (CRUD):", err);
    const statusCode = err.message.includes("obrigatórios")
      ? 400
      : err.message.includes("já cadastrada")
      ? 409
      : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function deletarMotoristaCrud(req, res) {
  try {
    const { id } = req.params;
    const { motoristaParaAuditoria, connection } =
      await service.deletarMotoristaCrud(id);
    let logMessage;
    if (motoristaParaAuditoria) {
      logMessage = `Motorista ID ${id} (Matrícula: ${motoristaParaAuditoria.matricula}, Nome: ${motoristaParaAuditoria.nome}) excluído via CRUD.`;
    } else {
      logMessage = `Motorista ID ${id} excluído via CRUD (dados não puderam ser recuperados para auditoria detalhada).`;
    }
    await registrarAuditoria(
      req.user.matricula,
      "EXCLUSAO_MOTORISTA_CRUD",
      logMessage,
      connection
    );
    res.json({ message: "Motorista excluído com sucesso." });
  } catch (err) {
    console.error("Erro ao excluir motorista (CRUD):", err);
    const statusCode = err.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function listarEstoqueCrud(req, res) {
  try {
    const itens = await service.listarEstoqueCrud(req.query);
    res.json(itens);
  } catch (err) {
    console.error("Erro ao buscar itens de estoque (CRUD):", err);
    res
      .status(500)
      .json({ message: "Erro interno ao buscar itens de estoque." });
  }
}

async function criarItemEstoqueCrud(req, res) {
  try {
    const { id } = await service.criarItemEstoqueCrud(req.body);
    await registrarAuditoria(
      req.user.matricula,
      "CADASTRO_PECA_ESTOQUE",
      `Peça ID ${id} (Código: ${req.body.cod}, Nome: ${req.body.nome}) cadastrada no estoque.`
    );
    res
      .status(201)
      .json({ message: "Peça cadastrada no estoque com sucesso!", id });
  } catch (err) {
    console.error("Erro ao cadastrar peça no estoque (CRUD):", err);
    const statusCode = err.message.includes("obrigatórios")
      ? 400
      : err.message.includes("já cadastrado")
      ? 409
      : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function deletarItemEstoqueCrud(req, res) {
  try {
    const { id } = req.params;
    const { pecaParaAuditoria, connection } =
      await service.deletarItemEstoqueCrud(id);
    let logMessage;
    if (pecaParaAuditoria) {
      logMessage = `Peça ID ${id} (Código: ${pecaParaAuditoria.cod}, Nome: ${pecaParaAuditoria.nome}) excluída do estoque.`;
    } else {
      logMessage = `Peça ID ${id} excluída do estoque (dados não puderam ser recuperados para auditoria detalhada).`;
    }
    await registrarAuditoria(
      req.user.matricula,
      "EXCLUSAO_PECA_ESTOQUE",
      logMessage,
      connection
    );
    res.json({ message: "Peça excluída do estoque com sucesso." });
  } catch (err) {
    console.error("Erro ao excluir peça do estoque (CRUD):", err);
    const statusCode = err.message.includes("não encontrada") ? 404 : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

module.exports = {
  listarMotoristas,
  listarEncarregados,
  listarPlacas,
  listarVeiculosControle,
  listarInventario,
  criarItemInventario,
  deletarItemInventario,
  listarMotoristasCrud,
  criarMotoristaCrud,
  deletarMotoristaCrud,
  listarEstoqueCrud,
  criarItemEstoqueCrud,
  deletarItemEstoqueCrud,
};
