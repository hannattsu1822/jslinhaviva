const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const targetDirs = [
  path.join(projectRoot, "frontend/public/pages"),
  path.join(projectRoot, "frontend/views/pages"),
  path.join(projectRoot, "public/pages"),
  path.join(projectRoot, "views/pages"),
];

const UNIFIED_CSS = "/shared/css/sidebar.css";
const UNIFIED_JS = "/shared/scripts/sidebar.js";

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

function unifyContent(content) {
  let updated = content;

  updated = updated.replace(
    /href="(?:\/static\/css\/sidebar_styles\.css|static\/css\/sidebar_styles\.css|\/static\/css\/components\/sidebar\.css)"/g,
    `href="${UNIFIED_CSS}"`
  );

  updated = updated.replace(
    /src="(?:\/scripts\/sidebar\.js|\/scripts\/components\/sidebar\.js)"/g,
    `src="${UNIFIED_JS}"`
  );

  updated = updated.replace(
    /<%-\s*include\(['"]\.\.\/\.\.\/partials\/sidebar\.html['"]\)\s*%>/g,
    '<div id="sidebar-root"></div>'
  );

  updated = updated.replace(
    /<header class="main-header">\s*<button class="sidebar-toggle-button"[\s\S]*?<\/button>\s*/g,
    '<header class="main-header">\n          '
  );

  if (
    (updated.includes(UNIFIED_JS) ||
      updated.includes('id="sidebar-root"') ||
      updated.includes("partials/sidebar")) &&
    !updated.includes('id="sidebar-root"')
  ) {
    updated = updated.replace(
      /<body([^>]*)>/,
      '<body$1>\n    <div id="sidebar-root"></div>'
    );
  }

  if (updated.includes('id="sidebar-root"') && !updated.includes(UNIFIED_CSS)) {
    updated = updated.replace(/<\/head>/, `    <link rel="stylesheet" href="${UNIFIED_CSS}" />\n  </head>`);
  }

  if (updated.includes('id="sidebar-root"') && !updated.includes(UNIFIED_JS)) {
    updated = updated.replace(
      /<\/body>/,
      `    <script src="${UNIFIED_JS}"></script>\n  </body>`
    );
  }

  return updated;
}

let migrated = 0;

for (const dir of targetDirs) {
  for (const file of walk(dir)) {
    const original = fs.readFileSync(file, "utf8");
    const updated = unifyContent(original);
    if (updated !== original) {
      fs.writeFileSync(file, updated, "utf8");
      console.log("Atualizado:", path.relative(projectRoot, file));
      migrated += 1;
    }
  }
}

console.log(`Total atualizado: ${migrated}`);
