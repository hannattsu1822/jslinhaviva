const path = require("path");

const projectRootDir = path.resolve(__dirname, "../..");
const frontendDir = path.join(projectRootDir, "frontend");
const publicDir = path.join(frontendDir, "public");
const viewsDir = path.join(frontendDir, "views");

function publicPage(...segments) {
  return path.join(publicDir, "pages", ...segments);
}

function viewsPage(...segments) {
  return path.join(viewsDir, "pages", ...segments);
}

module.exports = {
  projectRootDir,
  frontendDir,
  publicDir,
  viewsDir,
  publicPage,
  viewsPage,
};
