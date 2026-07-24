const { FieldValue } = require("firebase-admin/firestore");

const THRESHOLDS = [5, 1, 0];

// Mismo mecanismo que el cliente (index.html ~línea 7574): barrido hacia
// adelante día por día en vez de calcular "próxima fecha de vencimiento" —
// evita por construcción los bugs de meses de 28-31 días (ej. day=31 en
// febrero simplemente no matchea ese mes, que es el comportamiento correcto).
function getThresholdMatch(today, dayOfMonth) {
  for (const ahead of THRESHOLDS) {
    const target = new Date(today);
    target.setDate(today.getDate() + ahead);
    if (target.getDate() === dayOfMonth) {
      return { ahead, dueDateISO: target.toISOString().split("T")[0] };
    }
  }
  return null;
}

// Los documentos de recurringExpenses/creditCards viven en
// artifacts/{APP_ID}/users/{uid}/<coleccion>/{docId}.
function extractUid(docPath) {
  const parts = docPath.split("/");
  const idx = parts.indexOf("users");
  return idx >= 0 ? parts[idx + 1] : null;
}

// Dedup por canal — cada canal se reintenta independiente si falla; un
// canal exitoso no bloquea al otro. status:'sent' es lo único que evita
// reenvío; status:'failed'/'pending' permite reintentar al día siguiente.
async function runChannelWithDedup({ db, reminderKey, channelName, meta, sendFn }) {
  const logRef = db.collection("emailReminderLog").doc(`${reminderKey}_${channelName}`);
  const existing = await logRef.get();
  if (existing.exists && existing.data().status === "sent") {
    return { skipped: true, reason: "already-sent" };
  }

  await logRef.set(
    {
      ...meta,
      channel: channelName,
      status: "pending",
      claimedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  try {
    await sendFn();
    await logRef.update({ status: "sent", sentAt: FieldValue.serverTimestamp() });
    return { sent: true };
  } catch (err) {
    await logRef.update({
      status: "failed",
      errorMessage: String((err && err.message) || err),
    });
    return { failed: true, error: String((err && err.message) || err) };
  }
}

module.exports = { THRESHOLDS, getThresholdMatch, extractUid, runChannelWithDedup };
