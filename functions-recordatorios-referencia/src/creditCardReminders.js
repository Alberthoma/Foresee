const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { sendCardReminderEmail } = require("./emailChannel");
const { sendCardReminderPush } = require("./pushChannel");
const { getThresholdMatch, extractUid, runChannelWithDedup } = require("./reminderUtils");

const APP_ID = "wittfinances-282f1";

// Misma fórmula que js/secciones/tarjetas.js (calculateMonthlyPayment) —
// cuota fija de amortización francesa. Portada acá porque el cliente y
// esta función no comparten código (mundos distintos: navegador vs Cloud
// Function). Si se cambia la fórmula en la app, hay que replicar el
// cambio acá a mano.
function calculateMonthlyPayment(principal, annualRate, months) {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRate <= 0) return principal / months;
  const r = annualRate / 100 / 12;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

// Agregado 2026-07-24 — antes las tarjetas y préstamos solo tenían alerta
// dentro de la app (banner + notificación nativa, solo si el navegador
// está abierto, y solo por 80%+ de línea usada). Este barrido las suma al
// mismo sistema de recordatorios por correo/push que ya tenían los gastos
// recurrentes, con el mismo esquema de 5/1/0 días antes del día de pago
// (campo `dueDate` en creditCards, no `day` como en recurringExpenses).
async function runCardReminderSweep() {
  const db = getFirestore();
  const auth = getAuth();
  const today = new Date();

  const snap = await db.collectionGroup("creditCards").get();
  const userEmailCache = new Map();
  const prefCache = new Map();

  const tasks = snap.docs.map(async (doc) => {
    const card = doc.data();
    const uid = extractUid(doc.ref.path);
    if (!uid) return { skipped: true, reason: "no-uid" };

    const dueDate = parseInt(card.dueDate, 10);
    if (!dueDate || dueDate < 1 || dueDate > 31) return { skipped: true, reason: "bad-day" };

    const match = getThresholdMatch(today, dueDate);
    if (!match) return { skipped: true, reason: "no-match" };

    if (!prefCache.has(uid)) {
      const prefSnap = await db
        .doc(`artifacts/${APP_ID}/users/${uid}/user_data/preferences`)
        .get();
      prefCache.set(uid, prefSnap.exists ? prefSnap.data() : {});
    }
    const prefs = prefCache.get(uid);
    const wantsEmail = !!prefs.emailRemindersEnabled;
    const wantsPush = !!prefs.pushRemindersEnabled;
    if (!wantsEmail && !wantsPush) {
      return { skipped: true, reason: "opted-out" };
    }

    const monthlyPayment = calculateMonthlyPayment(
      parseFloat(card.amount) || 0,
      parseFloat(card.rate) || 0,
      parseInt(card.months, 10) || 1,
    );

    // Prefijo "cc_" para no colisionar nunca con las claves de
    // recurringExpenses en la misma colección emailReminderLog.
    const reminderKey = `cc_${uid}_${doc.id}_${match.dueDateISO}_${match.ahead}`;
    const meta = {
      uid,
      cardId: doc.id,
      dueDateISO: match.dueDateISO,
      threshold: match.ahead,
    };
    const channelResults = {};

    if (wantsEmail) {
      channelResults.email = await runChannelWithDedup({
        db,
        reminderKey,
        channelName: "email",
        meta,
        sendFn: async () => {
          if (!userEmailCache.has(uid)) {
            const userRecord = await auth.getUser(uid);
            userEmailCache.set(uid, userRecord.email || null);
          }
          const toEmail = userEmailCache.get(uid);
          if (!toEmail) throw new Error("user sin email en Auth");
          await sendCardReminderEmail({
            toEmail,
            bank: card.bank || "(sin nombre)",
            monthlyPayment,
            dueDateISO: match.dueDateISO,
            threshold: match.ahead,
          });
        },
      });
    }

    if (wantsPush) {
      channelResults.push = await runChannelWithDedup({
        db,
        reminderKey,
        channelName: "push",
        meta,
        sendFn: () =>
          sendCardReminderPush({
            uid,
            bank: card.bank || "(sin nombre)",
            monthlyPayment,
            threshold: match.ahead,
          }),
      });
    }

    return { channelResults, reminderKey };
  });

  const results = await Promise.allSettled(tasks);

  const summary = { sent: 0, failed: 0, skipped: 0, errors: 0 };
  results.forEach((r) => {
    if (r.status !== "fulfilled") {
      console.error("[creditCardReminders] tarea rechazada:", r.reason);
      summary.errors++;
      return;
    }
    const v = r.value;
    if (!v.channelResults) {
      summary.skipped++;
      return;
    }
    Object.values(v.channelResults).forEach((cr) => {
      if (cr.sent) summary.sent++;
      else if (cr.failed) summary.failed++;
      else summary.skipped++;
    });
  });

  console.log(`[creditCardReminders] sweep complete: ${JSON.stringify(summary)}`);
  return summary;
}

module.exports = { runCardReminderSweep, calculateMonthlyPayment };
