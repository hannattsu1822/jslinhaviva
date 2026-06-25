const crypto = require("crypto");

function createReportToken(scope, resourceId, ttlSec = 300) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET não configurado.");
  }

  const exp = Date.now() + ttlSec * 1000;
  const payload = `${scope}:${resourceId}:${exp}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

function verifyReportToken(token, scope, resourceId) {
  if (!token || typeof token !== "string") return false;

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 4) return false;

    const [scopePart, idPart, expStr, sig] = parts;
    if (scopePart !== scope || String(idPart) !== String(resourceId)) return false;

    const exp = parseInt(expStr, 10);
    if (!Number.isFinite(exp) || Date.now() > exp) return false;

    const secret = process.env.SESSION_SECRET;
    if (!secret) return false;

    const payload = `${scopePart}:${idPart}:${expStr}`;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

module.exports = { createReportToken, verifyReportToken };
