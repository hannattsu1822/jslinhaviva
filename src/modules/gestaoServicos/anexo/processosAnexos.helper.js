const fs = require("fs");
const path = require("path");
const { promisePool } = require("../../../infrastructure/database");
const { uploadsProcessosDir } = require("../../../infrastructure/uploads");

async function salvarAnexos(processoId, files) {
  const anexosSalvos = [];
  const processoUploadDir = path.join(uploadsProcessosDir, String(processoId));

  if (!fs.existsSync(processoUploadDir)) {
    fs.mkdirSync(processoUploadDir, { recursive: true });
  }

  for (const file of files) {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const novoNome = `${processoId}_${Date.now()}${fileExtension}`;
    const novoPath = path.join(processoUploadDir, novoNome);

    fs.renameSync(file.path, novoPath);

    const caminhoServidor = `/upload_arquivos_processos/${processoId}/${novoNome}`;

    const [result] = await promisePool.query(
      `INSERT INTO anexos_processos (processo_id, nome_original, caminho_servidor, tamanho) VALUES (?, ?, ?, ?)`,
      [processoId, file.originalname, caminhoServidor, file.size]
    );

    anexosSalvos.push({
      id:           result.insertId,
      caminho:      caminhoServidor,
      nomeOriginal: file.originalname,
    });
  }

  return anexosSalvos;
}

module.exports = { salvarAnexos };
