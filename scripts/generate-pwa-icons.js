/**
 * Gera PNGs a partir dos SVGs do PWA (ícone estilo login).
 * Uso: node scripts/generate-pwa-icons.js
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const iconsDir = path.join(__dirname, "..", "frontend", "public", "static", "icons");
const sources = [
  { file: "icon.svg", outputs: [192, 512] },
  { file: "icon-maskable.svg", outputs: [512], suffix: "-maskable" },
];

async function svgToPng(page, svgPath, size) {
  const svg = fs.readFileSync(svgPath, "utf8");
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  await page.setContent(
    `<!DOCTYPE html><html><body style="margin:0;background:transparent">
      <img src="${dataUrl}" width="${size}" height="${size}" alt="" />
    </body></html>`,
    { waitUntil: "load" }
  );
  const img = page.locator("img");
  return img.screenshot({ type: "png", omitBackground: true });
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const source of sources) {
    const svgPath = path.join(iconsDir, source.file);
    const suffix = source.suffix || "";

    for (const size of source.outputs) {
      const buffer = await svgToPng(page, svgPath, size);
      const outPath = path.join(iconsDir, `icon-${size}${suffix}.png`);
      fs.writeFileSync(outPath, buffer);
      console.log(`Gerado: ${outPath}`);
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
