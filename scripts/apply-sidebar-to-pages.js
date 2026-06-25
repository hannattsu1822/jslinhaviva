const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const targetDirs = [
  path.join(projectRoot, "frontend/public/pages"),
  path.join(projectRoot, "frontend/views/pages"),
];

const UNIFIED_CSS = "/shared/css/sidebar.css";
const UNIFIED_JS = "/shared/scripts/sidebar.js";
const FONT_AWESOME =
  '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" />';

const SKIP_FILES = new Set([
  "inspecoes_redes/mapa.html",
  "into/index.html",
  "login/login.html",
  "noc/painel_operacoes.html",
]);

const SKIP_PATH_PARTS = ["/templates/"];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else if (entry.name.endsWith(".html")) files.push(fullPath);
  }
  return files;
}

function shouldSkip(relPath, content) {
  if (SKIP_FILES.has(relPath)) return true;
  if (SKIP_PATH_PARTS.some((part) => relPath.includes(part))) return true;
  if (relPath.includes("relatorio_template") || relPath.includes("relatorio-template")) {
    return true;
  }
  if (content.includes('class="login-page"')) return true;
  if (content.includes("login-page__")) return true;
  return false;
}

function ensureHeadAssets(content) {
  let updated = content;

  if (!updated.includes(UNIFIED_CSS)) {
    updated = updated.replace(/<\/head>/i, `    <link rel="stylesheet" href="${UNIFIED_CSS}" />\n  </head>`);
  }

  if (!updated.includes("font-awesome") && !updated.includes("fa-solid")) {
    updated = updated.replace(/<\/head>/i, `    ${FONT_AWESOME}\n  </head>`);
  }

  return updated;
}

function ensureSidebarMarkup(content) {
  if (content.includes('id="sidebar-root"')) {
    return content;
  }

  let updated = content.replace(
    /<body([^>]*)>/i,
    '<body$1>\n    <div id="sidebar-root"></div>'
  );

  if (!updated.includes('class="main-content"')) {
    updated = updated.replace(
      /(<div id="sidebar-root"><\/div>\s*)/i,
      '$1<div class="main-content">\n'
    );
    updated = updated.replace(
      /(\s*)<\/body>/i,
      "\n    </div>$1</body>"
    );
  }

  return updated;
}

function ensureSidebarScript(content) {
  if (content.includes(UNIFIED_JS)) {
    return content;
  }

  return content.replace(
    /<\/body>/i,
    `    <script src="${UNIFIED_JS}"></script>\n  </body>`
  );
}

function cleanDuplicateSidebarLogic(content) {
  return content.replace(
    /\s*\/\/ Recupera os dados do usuário do localStorage[\s\S]*?\/\/ Função para logout \(Esta lógica pode estar no sidebar\.js\)\s*function logout\(\) \{[\s\S]*?window\.location\.href = "\/";[\s\S]*?\}\s*/g,
    "\n"
  );
}

let updatedCount = 0;

for (const dir of targetDirs) {
  for (const file of walk(dir)) {
    const rel = path.relative(path.join(projectRoot, "frontend"), file).replace(/\\/g, "/");
    const relFromPages = rel.replace(/^public\/pages\//, "").replace(/^views\/pages\//, "");

    const original = fs.readFileSync(file, "utf8");
    if (shouldSkip(relFromPages, original)) continue;

    let updated = original;
    updated = ensureHeadAssets(updated);
    updated = ensureSidebarMarkup(updated);
    updated = ensureSidebarScript(updated);
    updated = cleanDuplicateSidebarLogic(updated);

    if (updated !== original) {
      fs.writeFileSync(file, updated, "utf8");
      console.log("Pronto:", relFromPages);
      updatedCount += 1;
    }
  }
}

console.log(`Páginas preparadas: ${updatedCount}`);
