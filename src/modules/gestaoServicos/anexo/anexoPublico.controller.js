const { publicPage } = require("../../../shared/path.helper");
const { sendSafeFile } = require("../../../shared/pathSecurity.helper");
const service = require("./anexoPublico.service");

function paginaVisualizacao(req, res) {
  res.sendFile(publicPage("public/anexo_servico.html"));
}

async function servirArquivo(req, res) {
  try {
    const { anexoId } = req.params;
    const { token, download } = req.query;
    const { anexo, filePath, mime } = await service.resolverArquivoPublico(
      anexoId,
      token
    );

    res.setHeader("Content-Type", mime);
    res.setHeader("X-Content-Type-Options", "nosniff");
    const disposition =
      download === "1" || download === "true" ? "attachment" : "inline";
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${encodeURIComponent(anexo.nome_original || "anexo")}"`
    );

    if (req.method === "HEAD") {
      const fs = require("fs");
      const stat = fs.statSync(filePath);
      res.setHeader("Content-Length", stat.size);
      return res.status(200).end();
    }

    return sendSafeFile(res, filePath);
  } catch (error) {
    const status = error.statusCode || 500;
    if (req.accepts("html") && status === 403) {
      return res.status(403).send("Link inválido ou expirado.");
    }
    return res.status(status).json({
      success: false,
      message: error.message || "Erro ao abrir anexo.",
    });
  }
}

module.exports = {
  paginaVisualizacao,
  servirArquivo,
};
