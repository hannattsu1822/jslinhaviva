/**
 * Segunda passagem: converte onclick restantes em data-action.
 */
const fs = require("fs");
const path = require("path");

const frontendRoot = path.join(__dirname, "..", "frontend");

function walk(dir, ext, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      walk(full, ext, files);
    } else if (entry.name.endsWith(ext)) {
      files.push(full);
    }
  }
  return files;
}

function fixOnclick(content) {
  let changed = false;
  let out = content;

  const rules = [
    [/onclick="this\.parentElement\.remove\(\)"/g, 'data-action="dismiss-parent"'],
    [/onclick="event\.stopPropagation\(\)"/g, 'data-stop-propagation="true"'],
    [
      /onclick="window\.open\('([^']*)\$\{([^}]+)\}([^']*)',\s*'_blank'\)"/g,
      'data-action="open-url" data-url="$1${$2}$3"',
    ],
    [
      /onclick="window\.open\('([^']+)',\s*'_blank'\)"/g,
      'data-action="open-url" data-url="$1"',
    ],
    [
      /onclick="window\.(\w+)\(\$\{([^}]+)\}\)(?:,\s*this)?"/g,
      'data-action="$1" data-id="${$2}"',
    ],
    [/onclick="window\.(\w+)\(\)"/g, 'data-action="$1"'],
    [/onclick="window\.(\w+)\((true|false)\)"/g, 'data-action="$1" data-bool="$2"'],
    [/onclick="(\w+)\(\$\{([^}]+)\}\)"/g, 'data-action="$1" data-id="${$2}"'],
    [/onclick="(\w+)\('(\$\{[^}]+\})'\)"/g, 'data-action="$1" data-target="${$2}"'],
    [/onclick="(\w+)\('([^'"]+)'\)"/g, 'data-action="$1" data-target="$2"'],
    [
      /onclick="window\.navigateTo\('([^']*)\$\{([^}]+)\}([^']*)'\)"/g,
      'data-action="navigate" data-href="$1${$2}$3"',
    ],
    [
      /onclick="window\.navigateTo\('([^']+)'\)"/g,
      'data-action="navigate" data-href="$1"',
    ],
    [/onclick="setEmergencial\((true|false)\)"/g, 'data-action="setEmergencial" data-bool="$1"'],
    [
      /onclick="window\.history\.back\(\);?"/g,
      'data-action="back"',
    ],
    [
      /onclick="window\.location\.href = document\.referrer && document\.referrer !== window\.location\.href \? document\.referrer : '([^']+)'"/g,
      'data-action="navigate-referrer" data-fallback="$1"',
    ],
  ];

  for (const [regex, replacement] of rules) {
    const next = out.replace(regex, (...args) => {
      changed = true;
      if (typeof replacement === "function") return replacement(...args);
      return replacement;
    });
    out = next;
  }

  return { content: out, changed };
}

function fixHtml(content) {
  return fixOnclick(content);
}

let jsChanged = 0;
let htmlChanged = 0;

for (const file of walk(frontendRoot, ".js")) {
  const original = fs.readFileSync(file, "utf8");
  const { content, changed } = fixOnclick(original);
  if (changed) {
    fs.writeFileSync(file, content, "utf8");
    jsChanged += 1;
  }
}

for (const file of walk(frontendRoot, ".html")) {
  const original = fs.readFileSync(file, "utf8");
  const { content, changed } = fixHtml(original);
  if (changed) {
    fs.writeFileSync(file, content, "utf8");
    htmlChanged += 1;
  }
}

console.log(`Pass 2 JS: ${jsChanged}, HTML: ${htmlChanged}`);
