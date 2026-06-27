const path = require("path");

const projectRootDir = path.resolve(__dirname, "../..");
const frontendDir = path.join(projectRootDir, "frontend");
const publicDir = path.join(frontendDir, "public");
const viewsDir = path.join(frontendDir, "views");
const sharedReportsDir = path.join(__dirname, "reports");

function publicPage(...segments) {
  return path.join(publicDir, "pages", ...segments);
}

function viewsPage(...segments) {
  return path.join(viewsDir, "pages", ...segments);
}

function reportTemplate(...segments) {
  return path.join(sharedReportsDir, "templates", ...segments);
}

module.exports = {
  projectRootDir,
  frontendDir,
  publicDir,
  viewsDir,
  sharedReportsDir,
  publicPage,
  viewsPage,
  reportTemplate,
};
