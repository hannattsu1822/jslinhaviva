const webpush = require("web-push");
const logger = require("./config/logger");
require("dotenv").config();

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;

if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
  logger.error(
    "VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY ou VAPID_SUBJECT não definidos. Push desabilitado."
  );
  process.exit(1);
}

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
logger.info("[Push] VAPID configurado.");

module.exports = webpush;
