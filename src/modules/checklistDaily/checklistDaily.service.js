const fs = require("fs");
const path = require("path");
const { projectRootDir } = require("../../shared/path.helper");
const checklistQuery = require("./checklistDaily.query");

const UPLOAD_BASE_DIR = path.join(
  projectRootDir,
  "upload_checklist_diario_veiculos"
);

if (!fs.existsSync(UPLOAD_BASE_DIR)) {
  fs.mkdirSync(UPLOAD_BASE_DIR, { recursive: true });
}

async function verificarStatusDiario(matricula) {
  const registro = await checklistQuery.buscarChecklistDoDia(matricula);
  return {
    realizado: !!registro,
    detalhes: registro || null,
  };
}

async function processarNovoChecklist(matricula, dados, arquivos) {
  const checklistId = await checklistQuery.inserirChecklist({
    matricula,
    ...dados,
  });

  const fotosSalvas = [];

  if (arquivos && arquivos.length > 0) {
    const pastaDestino = path.join(UPLOAD_BASE_DIR, String(checklistId));

    if (!fs.existsSync(pastaDestino)) {
      fs.mkdirSync(pastaDestino, { recursive: true });
    }

    for (const arquivo of arquivos) {
      const extensao = path.extname(arquivo.originalname);
      const novoNomeArquivo = `foto_${checklistId}_${Date.now()}_${Math.round(
        Math.random() * 1e9
      )}${extensao}`;
      const caminhoFinal = path.join(pastaDestino, novoNomeArquivo);

      fs.renameSync(arquivo.path, caminhoFinal);

      const caminhoRelativo = `/upload_checklist_diario_veiculos/${checklistId}/${novoNomeArquivo}`;

      await checklistQuery.salvarFoto(
        checklistId,
        caminhoRelativo,
        arquivo.originalname,
        arquivo.size
      );
      fotosSalvas.push(caminhoRelativo);
    }
  }

  return { success: true, id: checklistId, fotos: fotosSalvas };
}

// --- NOVAS FUNÇÕES DE GESTÃO ---

async function obterListaGestao(filtros) {
  const checklists = await checklistQuery.listarChecklistsFiltrados(filtros);

  // Formatar datas para o frontend se necessário, ou deixar cru
  return checklists;
}

async function obterDetalhesCompletos(id) {
  // Como não temos uma query de "buscar por ID" na tabela principal exportada,
  // vamos assumir que o frontend já tem os dados principais da lista
  // e só precisa das fotos. Mas para ser completo, idealmente buscaríamos tudo.

  const fotos = await checklistQuery.buscarFotosPorChecklistId(id);
  return { fotos };
}

async function removerChecklist(id) {
  // Aqui poderia ter lógica para apagar os arquivos físicos também
  // Por enquanto, vamos focar em apagar do banco
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
