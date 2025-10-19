const service = require("./prv.service");

async function listarRegistrosPrv(req, res) {
  try {
    const resultado = await service.listarRegistrosPrv(req.query);
    res.json(resultado);
  } catch (error) {
    console.error("Erro ao buscar dados do relatório PRV:", error);
    const statusCode = error.message.includes("obrigatórios") ? 400 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function exportarRegistrosPrv(req, res) {
  try {
    const { workbook, fileName } = await service.exportarRegistrosPrv(
      req.query
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=" + fileName);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Erro ao exportar relatório PRV:", error);
    const statusCode = error.message.includes("obrigatórios") ? 400 : 500;
    res.status(statusCode).send(error.message);
  }
}

module.exports = {
  listarRegistrosPrv,
  exportarRegistrosPrv,
};
