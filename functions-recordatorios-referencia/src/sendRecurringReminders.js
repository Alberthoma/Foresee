const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { sendReminderEmail, SENDGRID_API_KEY } = require("./emailChannel");
const { sendReminderPush } = require("./pushChannel");
const { getThresholdMatch, extractUid, runChannelWithDedup } = require("./reminderUtils");
const { runCardReminderSweep } = require("./creditCardReminders");

if (!getApps().length) {
  initializeApp();
}

const APP_ID = "wittfinances-282f1";

async function runReminderSweep() {
  const db = getFirestore();
  const auth = getAuth();
  const today = new Date();

  const snap = await db.collectionGroup("recurringExpenses").get();
  const userEmailCache = new Map();
  const prefCache = new Map();

  const tasks = snap.docs.map(async (doc) => {
    const exp = doc.data();
    const uid = extractUid(doc.ref.path);
    if (!uid) return { skipped: true, reason: "no-uid" };

    const day = parseInt(exp.day, 10);
    if (!day || day < 1 || day > 31) return { skipped: true, reason: "bad-day" };

    const match = getThresholdMatch(today, day);
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

    const reminderKey = `${uid}_${doc.id}_${match.dueDateISO}_${match.ahead}`;
    const meta = {
      uid,
      expenseId: doc.id,
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
          await sendReminderEmail({
            toEmail,
            description: exp.description || "(sin descripción)",
            amount: exp.amount,
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
          sendReminderPush({
            uid,
            description: exp.description || "(sin descripción)",
            amount: exp.amount,
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
      console.error("[sendRecurringExpenseReminders] tarea rechazada:", r.reason);
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

  console.log(`[sendRecurringExpenseReminders] sweep complete: ${JSON.stringify(summary)}`);
  return summary;
}

const sendRecurringExpenseReminders = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: "America/New_York",
    region: "us-central1",
    secrets: [SENDGRID_API_KEY],
  },
  async () => {
    // Gastos recurrentes: la lógica original, intacta. Si esto lanzara,
    // el barrido de tarjetas de abajo ni siquiera arranca — se prioriza
    // no tocar el comportamiento que ya está probado en producción.
    await runReminderSweep();

    // Tarjetas y préstamos (agregado 2026-07-24): aislado en su propio
    // try/catch para que un bug acá nunca pueda afectar el resultado ya
    // confirmado de los gastos recurrentes de arriba.
    try {
      await runCardReminderSweep();
    } catch (err) {
      console.error("[sendRecurringExpenseReminders] barrido de tarjetas falló:", err);
    }
  },
);

module.exports = {
  sendRecurringExpenseReminders,
  runReminderSweep,
  getThresholdMatch,
  extractUid,
};
