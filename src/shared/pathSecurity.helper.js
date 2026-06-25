const path = require("path");
const fs = require("fs");

function resolvePathWithinBase(baseDir, ...segments) {
  const safeSegments = segments
    .flat()
    .filter((segment) => segment !== undefined && segment !== null && segment !== "")
    .map((segment) => String(segment).replace(/\\/g, "/"))
    .filter((segment) => segment !== "." && segment !== "..");

  const resolved = path.resolve(baseDir, ...safeSegments);
  const base = path.resolve(baseDir);

  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    return null;
  }

  return resolved;
}

function sendSafeFile(res, filePath, { downloadName } = {}) {
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ message: "Arquivo não encontrado." });
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    return res.status(403).json({ message: "Acesso negado." });
  }

  if (downloadName) {
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(downloadName)}"`
    );
  }

  return res.sendFile(filePath);
}

module.exports = { resolvePathWithinBase, sendSafeFile };
