const webpush = require("web-push");
require("dotenv").config();

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;

console.log("DEBUG: [Backend] Carregando chaves VAPID do arquivo .env");
console.log("DEBUG: [Backend] VAPID_PUBLIC_KEY:", vapidPublicKey ? `"${vapidPublicKey}"` : "NÃO ENCONTRADA!");
console.log("DEBUG: [Backend] VAPID_PRIVATE_KEY:", vapidPrivateKey ? "Encontrada (oculta por segurança)" : "NÃO ENCONTRADA!");
console.log("DEBUG: [Backend] VAPID_SUBJECT:", vapidSubject ? `"${vapidSubject}"` : "NÃO ENCONTRADO!");

if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
  console.error("ERRO CRÍTICO: As chaves VAPID ou o VAPID_SUBJECT não estão definidos no arquivo .env. As notificações push não funcionarão.");
  process.exit(1);
}

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
console.log("DEBUG: [Backend] Detalhes VAPID configurados com sucesso no web-push.");

module.exports = webpush;
