const { getMessaging } = require("firebase-admin/messaging");
const { getFirestore } = require("firebase-admin/firestore");

const APP_ID = "wittfinances-282f1";

function dayLabelFor(threshold) {
  return threshold === 0 ? "hoy" : threshold === 1 ? "mañana" : `en ${threshold} días`;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(amount) || 0,
  );
}

function buildReminderPush({ description, amount, threshold }) {
  const title = threshold === 0 ? "Foresee — Hoy vence un pago" : "Foresee — Recordatorio de pago";
  const body = `"${description}" vence ${dayLabelFor(threshold)} — ${formatCurrency(amount)}`;
  return { title, body };
}

// Tarjetas y préstamos (agregado 2026-07-24) — mismo canal, distinto
// contenido: menciona el banco/tarjeta y el pago mensual estimado.
function buildCardReminderPush({ bank, monthlyPayment, threshold }) {
  const title =
    threshold === 0
      ? "Foresee — Hoy vence el pago de tu tarjeta"
      : "Foresee — Recordatorio de pago de tarjeta";
  const body = `Tarjeta "${bank}" vence ${dayLabelFor(threshold)} — pago estimado ${formatCurrency(monthlyPayment)}`;
  return { title, body };
}

// Envía a todos los dispositivos del usuario (puede tener varios tokens
// guardados). Tokens inválidos/expirados se borran solos — limpieza sin
// intervención manual.
async function sendPush({ uid, title, body }) {
  const db = getFirestore();
  const tokensSnap = await db
    .collection(`artifacts/${APP_ID}/users/${uid}/fcmTokens`)
    .get();
  if (tokensSnap.empty) return { sent: 0 };

  const tokens = tokensSnap.docs.map((d) => d.id);
  const messaging = getMessaging();
  const response = await messaging.sendEachForMulticast({
    tokens,
    data: { title, body },
  });

  const staleTokenDeletes = [];
  response.responses.forEach((res, i) => {
    if (
      !res.success &&
      res.error &&
      res.error.code === "messaging/registration-token-not-registered"
    ) {
      staleTokenDeletes.push(
        db
          .doc(`artifacts/${APP_ID}/users/${uid}/fcmTokens/${tokens[i]}`)
          .delete(),
      );
    }
  });
  if (staleTokenDeletes.length) await Promise.allSettled(staleTokenDeletes);

  return { sent: response.successCount };
}

async function sendReminderPush({ uid, description, amount, threshold }) {
  const { title, body } = buildReminderPush({ description, amount, threshold });
  return sendPush({ uid, title, body });
}

async function sendCardReminderPush({ uid, bank, monthlyPayment, threshold }) {
  const { title, body } = buildCardReminderPush({ bank, monthlyPayment, threshold });
  return sendPush({ uid, title, body });
}

module.exports = { sendReminderPush, sendCardReminderPush };
