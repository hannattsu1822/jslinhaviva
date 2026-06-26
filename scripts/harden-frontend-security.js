/**
 * Endurece innerHTML (safeHtml) e remove onclick inline (data-action) no frontend.
 */
const fs = require("fs");
const path = require("path");

const frontendRoot = path.join(__dirname, "..", "frontend");
const SHARED_SCRIPTS = `
    <script src="/shared/utils/dom-safe.js"></script>
    <script src="/shared/utils/ui-actions.js"></script>`;

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

function alreadyUsesSafeHtmlAssignment(line) {
  return /\.innerHTML\s*[+]?=\s*safeHtml`/i.test(line);
}

function hardenJsInnerHtml(content) {
  let changed = false;

  const replaced = content.replace(
    /(\.innerHTML\s*(?:\+?=)\s*)`([\s\S]*?)`/g,
    (match, prefix, template) => {
      if (!template.includes("${")) return match;
      if (alreadyUsesSafeHtmlAssignment(match)) return match;
      changed = true;
      return `${prefix}safeHtml\`${template}\``;
    }
  );

  return { content: replaced, changed };
}

function convertOnclickInHtmlTag(tag) {
  const onclickMatch = tag.match(/\sonclick="([^"]*)"/i);
  if (!onclickMatch) return tag;

  let tagOut = tag.replace(/\sonclick="[^"]*"/i, "");
  const handler = onclickMatch[1].trim();

  if (/^window\.location\.href\s*=\s*['"]([^'"]+)['"]$/i.test(handler)) {
    const href = handler.match(/['"]([^'"]+)['"]/)[1];
    tagOut = tagOut.replace(/<(\w+)/i, `<$1 data-action="navigate" data-href="${href}"`);
    return tagOut;
  }

  if (/^window\.history\.back\(\)$/i.test(handler)) {
    tagOut = tagOut.replace(/<(\w+)/i, `<$1 data-action="back"`);
    return tagOut;
  }

  if (/^window\.print\(\)$/i.test(handler)) {
    tagOut = tagOut.replace(/<(\w+)/i, `<$1 data-action="print"`);
    return tagOut;
  }

  if (/^location\.reload\(\)$/i.test(handler)) {
    tagOut = tagOut.replace(/<(\w+)/i, `<$1 data-action="reload"`);
    return tagOut;
  }

  const navigateToMatch = handler.match(/^navigateTo\(['"]([^'"]+)['"]\)$/i);
  if (navigateToMatch) {
    tagOut = tagOut.replace(
      /<(\w+)/i,
      `<$1 data-action="navigateTo" data-target="${navigateToMatch[1]}"`
    );
    return tagOut;
  }

  const fnCallMatch = handler.match(/^([a-zA-Z_$][\w$]*)\((.*)\);?$/);
  if (fnCallMatch) {
    const fnName = fnCallMatch[1];
    const args = fnCallMatch[2].trim();

    if (args === "") {
      tagOut = tagOut.replace(/<(\w+)/i, `<$1 data-action="${fnName}"`);
      return tagOut;
    }

    if (/^event\.preventDefault\(\);\s*(\w+)\((\d+)\)$/.test(handler)) {
      const m = handler.match(/^event\.preventDefault\(\);\s*(\w+)\((\d+)\)$/);
      tagOut = tagOut.replace(
        /<(\w+)/i,
        `<$1 data-action="paginate" data-handler="${m[1]}" data-page="${m[2]}"`
      );
      return tagOut;
    }

    const idMatch = args.match(/^(\d+)$/);
    if (idMatch) {
      tagOut = tagOut.replace(
        /<(\w+)/i,
        `<$1 data-action="${fnName}" data-id="${idMatch[1]}"`
      );
      return tagOut;
    }

    const strMatch = args.match(/^['"]([^'"]*)['"]$/);
    if (strMatch) {
      tagOut = tagOut.replace(
        /<(\w+)/i,
        `<$1 data-action="${fnName}" data-target="${strMatch[1]}"`
      );
      return tagOut;
    }
  }

  const openFileMatch = handler.match(
    /^document\.getElementById\(['"]([^'"]+)['"]\)\.click\(\)$/i
  );
  if (openFileMatch) {
    tagOut = tagOut.replace(
      /<(\w+)/i,
      `<$1 data-action="open-file" data-input="${openFileMatch[1]}"`
    );
    return tagOut;
  }

  return tag;
}

function hardenHtmlContent(content) {
  let changed = false;
  let out = content;

  if (!out.includes("dom-safe.js")) {
    const headClose = out.indexOf("</head>");
    if (headClose !== -1) {
      out = `${out.slice(0, headClose)}${SHARED_SCRIPTS}\n${out.slice(headClose)}`;
      changed = true;
    }
  }

  const withOnclick = out.replace(/<[^>]*\sonclick="[^"]*"[^>]*>/gi, (tag) => {
    const converted = convertOnclickInHtmlTag(tag);
    if (converted !== tag) changed = true;
    return converted;
  });

  return { content: withOnclick, changed };
}

function hardenJsOnclickInTemplates(content) {
  let changed = false;

  const replaced = content.replace(/onclick="([^"]*)"/g, (full, handler) => {
    const fakeTag = `<button onclick="${handler}">`;
    const converted = convertOnclickInHtmlTag(fakeTag);
    if (converted === fakeTag) return full;

    changed = true;
    const attrs = converted.replace(/^<button\s*/i, "").replace(/>$/, "");
    return attrs.trim();
  });

  return { content: replaced, changed };
}

function processJsFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  let changed = false;

  const inner = hardenJsInnerHtml(content);
  content = inner.content;
  changed = changed || inner.changed;

  const onclick = hardenJsOnclickInTemplates(content);
  content = onclick.content;
  changed = changed || onclick.changed;

  if (changed) {
    fs.writeFileSync(filePath, content, "utf8");
  }
  return changed;
}

function processHtmlFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  const result = hardenHtmlContent(content);
  if (result.changed) {
    fs.writeFileSync(filePath, result.content, "utf8");
  }
  return result.changed;
}

const jsFiles = walk(frontendRoot, ".js");
const htmlFiles = walk(frontendRoot, ".html");

let jsChanged = 0;
let htmlChanged = 0;

for (const file of jsFiles) {
  if (processJsFile(file)) jsChanged += 1;
}

for (const file of htmlFiles) {
  if (processHtmlFile(file)) htmlChanged += 1;
}

console.log(`JS atualizados: ${jsChanged}/${jsFiles.length}`);
console.log(`HTML atualizados: ${htmlChanged}/${htmlFiles.length}`);
