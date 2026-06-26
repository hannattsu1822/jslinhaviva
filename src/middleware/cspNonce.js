const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");

function generateNonce() {
  return crypto.randomBytes(16).toString("base64");
}

function injectNonceIntoHtml(html, nonce) {
  if (!nonce || typeof html !== "string") return html;

  return html.replace(/<script(\s[^>]*)?>/gi, (tag) => {
    if (/src\s*=/.test(tag)) return tag;
    if (/nonce\s*=/.test(tag)) return tag;
    return tag.replace("<script", `<script nonce="${nonce}"`);
  });
}

function cspNonceMiddleware(req, res, next) {
  const nonce = generateNonce();
  res.locals.cspNonce = nonce;
  req.cspNonce = nonce;

  const originalSend = res.send.bind(res);
  res.send = function sendWithNonce(body) {
    if (typeof body === "string" && /<html[\s>]/i.test(body)) {
      return originalSend(injectNonceIntoHtml(body, nonce));
    }
    return originalSend(body);
  };

  const originalRender = res.render.bind(res);
  res.render = function renderWithNonce(view, options, callback) {
    let opts = options;
    let cb = callback;
    if (typeof options === "function") {
      cb = options;
      opts = {};
    }
    opts = { ...(opts || {}), cspNonce: nonce };

    return originalRender(view, opts, (err, html) => {
      if (err) {
        if (cb) return cb(err);
        return next(err);
      }
      const htmlWithNonce = injectNonceIntoHtml(html, nonce);
      if (cb) return cb(null, htmlWithNonce);
      return originalSend(htmlWithNonce);
    });
  };

  const originalSendFile = res.sendFile.bind(res);
  res.sendFile = function sendFileWithNonce(filePath, options, callback) {
    let opts = options;
    let cb = callback;
    if (typeof options === "function") {
      cb = options;
      opts = {};
    }

    const resolvedPath = path.resolve(filePath);
    if (resolvedPath.toLowerCase().endsWith(".html")) {
      fs.readFile(resolvedPath, "utf8", (err, html) => {
        if (err) {
          if (cb) return cb(err);
          return next(err);
        }
        res.type("html");
        return originalSend(injectNonceIntoHtml(html, nonce));
      });
      return;
    }

    return originalSendFile(filePath, opts, cb);
  };

  next();
}

function createStaticWithHtmlNonce(rootDir) {
  const staticHandler = express.static(rootDir, { index: false });

  return function staticWithHtmlNonce(req, res, next) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return staticHandler(req, res, next);
    }

    const relativePath = decodeURIComponent(req.path);
    const filePath = path.join(rootDir, relativePath);

    if (
      !filePath.startsWith(path.resolve(rootDir)) ||
      !fs.existsSync(filePath) ||
      fs.statSync(filePath).isDirectory() ||
      !filePath.toLowerCase().endsWith(".html")
    ) {
      return staticHandler(req, res, next);
    }

    fs.readFile(filePath, "utf8", (err, html) => {
      if (err) return next(err);
      res.type("html");
      res.send(injectNonceIntoHtml(html, res.locals.cspNonce));
    });
  };
}

module.exports = {
  cspNonceMiddleware,
  injectNonceIntoHtml,
  createStaticWithHtmlNonce,
};
