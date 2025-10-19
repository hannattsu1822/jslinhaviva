const { promisePool } = require("../../../init");
const proj4 = require("proj4");

function convertUtmToLatLon(easting, northing, utmZoneString) {
  if (!utmZoneString || !easting || !northing) {
    throw new Error("Dados UTM incompletos para conversão.");
  }

  const zoneNumber = parseInt(utmZoneString, 10);
  const zoneLetterMatch = utmZoneString.match(/[A-Za-z]/);

  if (isNaN(zoneNumber) || !zoneLetterMatch) {
    throw new Error(`Zona UTM inválida: ${utmZoneString}`);
  }

  const zoneLetter = zoneLetterMatch[0];
  const isSouthernHemisphere = zoneLetter.toUpperCase() < "N";

  const utmProjection = `+proj=utm +zone=${zoneNumber} ${
    isSouthernHemisphere ? "+south" : ""
  } +ellps=WGS84 +datum=WGS84 +units=m +no_defs`;
  const wgs84Projection = `+proj=longlat +datum=WGS84 +no_defs`;

  try {
    const eastingSanitized = parseFloat(String(easting).replace(",", "."));
    const northingSanitized = parseFloat(String(northing).replace(",", "."));

    const [longitude, latitude] = proj4(utmProjection, wgs84Projection, [
      eastingSanitized,
      northingSanitized,
    ]);
    return { latitude, longitude };
  } catch (error) {
    console.error("Erro na conversão de coordenadas:", error);
    throw new Error("Erro interno ao converter coordenadas UTM.");
  }
}

async function obterUltimosPontos() {
  const sql = `
        SELECT f.id, f.tipo_ponto, f.tag, f.created_at, u.nome as nome_coletor
        FROM fibra_maps f
        LEFT JOIN users u ON f.coletado_por_matricula = u.matricula
        ORDER BY f.id DESC
        LIMIT 10;
    `;
  const [ultimosPontos] = await promisePool.query(sql);
  return ultimosPontos;
}

async function obterTodosOsPontos() {
  const [pontos] = await promisePool.query(`
        SELECT f.id, f.tipo_ponto, f.tag, f.latitude, f.longitude, f.altitude, f.easting, f.northing, f.created_at, u.nome as nome_coletor
        FROM fibra_maps f
        LEFT JOIN users u ON f.coletado_por_matricula = u.matricula
        ORDER BY f.id DESC
    `);
  return pontos;
}

async function salvarPontos(pontos, matriculaUsuario) {
  if (!pontos || !Array.isArray(pontos) || pontos.length === 0) {
    throw new Error("Nenhum ponto válido recebido.");
  }
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const sqlInsert =
      "INSERT INTO fibra_maps (tipo_ponto, tag, utm_zone, easting, northing, altitude, latitude, longitude, coletado_por_matricula) VALUES ?";
    const values = pontos.map((ponto) => {
      const { latitude, longitude } = convertUtmToLatLon(
        ponto.easting,
        ponto.northing,
        ponto.utm_zone
      );
      return [
        ponto.tipo,
        ponto.tag,
        ponto.utm_zone,
        String(ponto.easting).replace(",", "."),
        String(ponto.northing).replace(",", "."),
        String(ponto.altitude).replace(",", "."),
        latitude,
        longitude,
        matriculaUsuario,
      ];
    });
    await connection.query(sqlInsert, [values]);
    await connection.commit();
    return { connection };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function obterPontoPorId(id) {
  const [pontoRows] = await promisePool.query(
    "SELECT * FROM fibra_maps WHERE id = ?",
    [id]
  );
  if (pontoRows.length === 0) {
    throw new Error("Ponto não encontrado.");
  }
  return pontoRows[0];
}

async function editarPonto(id, dadosPonto) {
  const { tipo_ponto, tag, utm_zone, easting, northing, altitude } = dadosPonto;
  if (!tipo_ponto || !tag || !utm_zone || !easting || !northing || !altitude) {
    throw new Error("Todos os campos são obrigatórios.");
  }
  const { latitude, longitude } = convertUtmToLatLon(
    easting,
    northing,
    utm_zone
  );
  const sqlUpdate = `
        UPDATE fibra_maps SET tipo_ponto = ?, tag = ?, utm_zone = ?, easting = ?, northing = ?, altitude = ?, latitude = ?, longitude = ?
        WHERE id = ?
    `;
  const values = [
    tipo_ponto,
    tag,
    utm_zone,
    String(easting).replace(",", "."),
    String(northing).replace(",", "."),
    String(altitude).replace(",", "."),
    latitude,
    longitude,
    id,
  ];
  await promisePool.query(sqlUpdate, values);
}

async function excluirPonto(id) {
  const [result] = await promisePool.query(
    "DELETE FROM fibra_maps WHERE id = ?",
    [id]
  );
  if (result.affectedRows === 0) {
    throw new Error("Ponto não encontrado.");
  }
}

module.exports = {
  obterUltimosPontos,
  obterTodosOsPontos,
  salvarPontos,
  obterPontoPorId,
  editarPonto,
  excluirPonto,
};
