/**
 * Exporta pontos da tabela fibra_maps para GeoJSON e KML.
 * Uso: node scripts/export-fibra-pontos.js
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const SQL = `
  SELECT
    f.id,
    f.tipo_ponto,
    f.tag,
    f.utm_zone,
    f.easting,
    f.northing,
    f.altitude,
    f.latitude,
    f.longitude,
    f.created_at,
    f.coletado_por_matricula,
    u.nome AS nome_coletor
  FROM fibra_maps f
  LEFT JOIN users u ON f.coletado_por_matricula = u.matricula
  ORDER BY f.id ASC
`;

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildGeoJSON(pontos) {
  const features = pontos
    .filter((p) => {
      const lat = parseFloat(p.latitude);
      const lon = parseFloat(p.longitude);
      return !isNaN(lat) && !isNaN(lon);
    })
    .map((ponto) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [parseFloat(ponto.longitude), parseFloat(ponto.latitude)],
      },
      properties: {
        id: ponto.id,
        tipo_ponto: ponto.tipo_ponto,
        tag: ponto.tag,
        altitude_m: parseFloat(ponto.altitude) || null,
        utm_zone: ponto.utm_zone,
        easting: ponto.easting,
        northing: ponto.northing,
        coletado_por: ponto.nome_coletor || ponto.coletado_por_matricula,
        matricula_coletor: ponto.coletado_por_matricula,
        data_coleta: ponto.created_at
          ? new Date(ponto.created_at).toISOString()
          : null,
      },
    }));

  return {
    type: "FeatureCollection",
    name: "Pontos de Fibra Óptica - Linhaviva",
    crs: {
      type: "name",
      properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" },
    },
    features,
  };
}

function buildKML(pontos) {
  const placemarks = pontos
    .filter((p) => {
      const lat = parseFloat(p.latitude);
      const lon = parseFloat(p.longitude);
      return !isNaN(lat) && !isNaN(lon);
    })
    .map((ponto) => {
      const lat = parseFloat(ponto.latitude);
      const lon = parseFloat(ponto.longitude);
      const dataColeta = ponto.created_at
        ? new Date(ponto.created_at).toLocaleString("pt-BR")
        : "N/A";

      return `    <Placemark>
      <name>${escapeXml(ponto.tag)} (${escapeXml(ponto.tipo_ponto)})</name>
      <description><![CDATA[
        <b>ID:</b> ${ponto.id}<br/>
        <b>Tipo:</b> ${escapeXml(ponto.tipo_ponto)}<br/>
        <b>TAG:</b> ${escapeXml(ponto.tag)}<br/>
        <b>Altitude:</b> ${escapeXml(ponto.altitude)} m<br/>
        <b>UTM:</b> ${escapeXml(ponto.utm_zone)} | E: ${escapeXml(ponto.easting)} | N: ${escapeXml(ponto.northing)}<br/>
        <b>Coletor:</b> ${escapeXml(ponto.nome_coletor || ponto.coletado_por_matricula)}<br/>
        <b>Data:</b> ${escapeXml(dataColeta)}
      ]]></description>
      <Point>
        <coordinates>${lon},${lat},${parseFloat(ponto.altitude) || 0}</coordinates>
      </Point>
    </Placemark>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Pontos de Fibra Óptica - Linhaviva</name>
    <description>Pontos coletados no módulo de fibra óptica (coordenadas WGS84)</description>
${placemarks}
  </Document>
</kml>
`;
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [pontos] = await connection.query(SQL);

    if (!pontos.length) {
      console.log("Nenhum ponto encontrado na tabela fibra_maps.");
      process.exit(0);
    }

    const dateStamp = new Date().toISOString().slice(0, 10);
    const outputDir = path.join(__dirname, "..", "exports");
    fs.mkdirSync(outputDir, { recursive: true });

    const geojsonPath = path.join(
      outputDir,
      `pontos_fibra_${dateStamp}.geojson`
    );
    const kmlPath = path.join(outputDir, `pontos_fibra_${dateStamp}.kml`);

    const geojson = buildGeoJSON(pontos);
    const kml = buildKML(pontos);

    fs.writeFileSync(geojsonPath, JSON.stringify(geojson, null, 2), "utf8");
    fs.writeFileSync(kmlPath, kml, "utf8");

    console.log(`Exportados ${geojson.features.length} ponto(s):`);
    console.log(`  GeoJSON: ${geojsonPath}`);
    console.log(`  KML:     ${kmlPath}`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Erro ao exportar pontos de fibra:", error.message);
  process.exit(1);
});
