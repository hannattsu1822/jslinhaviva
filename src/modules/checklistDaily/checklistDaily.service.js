const fs = require("fs");
const path = require("path");

const { projectRootDir } = require("../../shared/path.helper");
const checklistQuery = require("./checklistDaily.query");

const UPLOAD_BASE_DIR = path.join(projectRootDir, "upload_checklist_diario_veiculos");

if (!fs.existsSync(UPLOAD_BASE_DIR)) {
  fs.mkdirSync(UPLOAD_BASE_DIR, { recursive: true });
}

function normalizePlaca(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "");
}

function flattenMulterFiles(files) {
  if (!files) return [];

  if (Array.isArray(files)) return files;

  if (typeof files === "object") {
    const all = [];
    for (const key of Object.keys(files)) {
      const arr = files[key];
      if (Array.isArray(arr)) all.push(...arr);
    }
    return all;
  }

  return [];
}

async function verificarStatusDiario(placaRaw) {
  const placa = normalizePlaca(placaRaw);
  if (!placa) {
    throw new Error("Placa obrigatória para verificar status do checklist diário.");
  }

  const registro = await checklistQuery.buscarChecklistDoDiaPorPlaca(placa);

  return {
    realizado: !!registro,
    detalhes: registro || null,
  };
}

async function processarNovoChecklist(matricula, dados, arquivos) {
  const placa = normalizePlaca(dados && dados.placa);
  if (!placa) {
    throw new Error("Placa obrigatória.");
  }

  const jaExisteHoje = await checklistQuery.buscarChecklistDoDiaPorPlaca(placa);
  if (jaExisteHoje) {
    throw new Error("Já existe checklist diário registrado hoje para esta placa.");
  }

  const checklistId = await checklistQuery.inserirChecklist({
    matricula,
    ...dados,
    placa,
  });

  const fotosSalvas = [];
  const arquivosArray = flattenMulterFiles(arquivos);

  if (arquivosArray.length > 0) {
    const pastaDestino = path.join(UPLOAD_BASE_DIR, String(checklistId));

    if (!fs.existsSync(pastaDestino)) {
      fs.mkdirSync(pastaDestino, { recursive: true });
    }

    for (const arquivo of arquivosArray) {
      const extensao = path.extname(arquivo.originalname || "");
      const novoNomeArquivo = `foto_${checklistId}_${Date.now()}_${Math.round(
        Math.random() * 1e9
      )}${extensao}`;

      const caminhoFinal = path.join(pastaDestino, novoNomeArquivo);

      fs.renameSync(arquivo.path, caminhoFinal);

      const caminhoRelativo = `/upload_checklist_diario_veiculos/${checklistId}/${novoNomeArquivo}`;

      await checklistQuery.salvarFoto(
        checklistId,
        caminhoRelativo,
        arquivo.originalname || novoNomeArquivo,
        arquivo.size || 0
      );

      fotosSalvas.push(caminhoRelativo);
    }
  }

  return { success: true, id: checklistId, fotos: fotosSalvas };
}

async function obterListaGestao(filtros) {
  const checklists = await checklistQuery.listarChecklistsFiltrados(filtros);
  return checklists;
}

async function obterDetalhesCompletos(id) {
  const fotos = await checklistQuery.buscarFotosPorChecklistId(id);
  return { fotos };
}

async function removerChecklist(id) {
  await checklistQuery.excluirChecklist(id);

  const pastaDestino = path.join(UPLOAD_BASE_DIR, String(id));
  if (fs.existsSync(pastaDestino)) {
    fs.rmSync(pastaDestino, { recursive: true, force: true });
  }
}

module.exports = {
  verificarStatusDiario,
  processarNovoChecklist,
  obterListaGestao,
  obterDetalhesCompletos,
  removerChecklist,
};
