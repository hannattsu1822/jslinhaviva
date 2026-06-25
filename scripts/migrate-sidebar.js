const fs = require("fs");
const path = require("path");

const pagesDir = path.join(__dirname, "../frontend/public/pages");

const skipFiles = new Set([
  "inspecoes_redes/mapa.html",
]);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.name.endsWith(".html")) {
      files.push(fullPath);
    }
  }
  return files;
}

function migrateStandardSidebar(content) {
  if (!content.includes('class="sidebar-toggle-button"')) return null;
  if (!content.includes('class="main-content"')) return null;

  let updated = content.replace(
    /<button class="sidebar-toggle-button"[\s\S]*?<div class="main-content">/,
    '<div id="sidebar-root"></div>\n\n    <div class="main-content">'
  );

  if (updated === content) return null;

  updated = updated.replace(
    /\s*<div class="main-content-overlay"><\/div>\s*/g,
    "\n"
  );

  if (!updated.includes('href="/static/css/sidebar_styles.css"')) {
    updated = updated.replace(
      /<\/head>/,
      '    <link rel="stylesheet" href="/static/css/sidebar_styles.css" />\n  </head>'
    );
  }

  return updated;
}

function migrateLegacyLayout(content, relPath) {
  if (!content.includes('class="sidebar"')) return null;
  if (content.includes('id="sidebar-root"')) return null;
  if (content.includes('class="sidebar-toggle-button"')) return null;

  const sidebarMenuMatch = content.match(/<nav class="sidebar-menu">/);
  const rowLayoutMatch = content.match(
    /<div class="container-fluid">\s*<div class="row min-vh-100">\s*<div class="sidebar">/
  );

  if (!sidebarMenuMatch && !rowLayoutMatch) return null;

  let updated = content;

  updated = updated.replace(
    /<div class="container-fluid">\s*<div class="row min-vh-100">\s*<div class="sidebar">[\s\S]*?<\/div>\s*<div class="main-content">/,
    '<div id="sidebar-root"></div>\n\n    <div class="main-content">'
  );

  if (updated === content) return null;

  if (!updated.includes('href="/static/css/sidebar_styles.css"')) {
    updated = updated.replace(
      /<\/head>/,
      '    <link rel="stylesheet" href="/static/css/sidebar_styles.css" />\n  </head>'
    );
  }

  if (!updated.includes("/scripts/sidebar.js")) {
    updated = updated.replace(
      /<\/body>/,
      '    <script src="/scripts/sidebar.js"></script>\n  </body>'
    );
  }

  return updated;
}

const files = walk(pagesDir);
let migrated = 0;

for (const file of files) {
  const rel = path.relative(pagesDir, file).replace(/\\/g, "/");
  if (skipFiles.has(rel)) continue;

  const original = fs.readFileSync(file, "utf8");
  const updated =
    migrateStandardSidebar(original) || migrateLegacyLayout(original, rel);

  if (updated && updated !== original) {
    fs.writeFileSync(file, updated, "utf8");
    console.log("Migrado:", rel);
    migrated += 1;
  }
}

console.log(`Total migrado: ${migrated}`);
