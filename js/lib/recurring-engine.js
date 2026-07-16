// Foresee 2.0 — recurring-engine.js
// Auto-registro mensual de gastos recurrentes (®) + recordatorios de
// vencimiento. Misma lógica del origen: detección de huecos hasta 12
// meses atrás, filtro coveredByImport (palabra compartida ±5 días) para
// no duplicar cuando el gasto real ya se importó, y cooldown de 60s en
// sessionStorage contra los parpadeos de auth/Firestore que re-suscriben
// los listeners en la misma pestaña.
import { db, doc, collection, writeBatch, DB_COL } from "../firebase.js";
import { appState, isRecurringReady } from "../state.js";
import { sharesDescriptionWord, withinDays, formatCurrency } from "./utils.js";
import { showToast } from "./ui.js";
import { sendBrowserNotification } from "./notifications.js";

let recurringProcessed = false;

export function resetRecurringEngineState() {
  recurringProcessed = false;
}

export function tryProcessRecurringExpenses() {
  if (!isRecurringReady() || recurringProcessed) return;

  const uid = appState.currentUser?.uid;
  const cooldownKey = `foresee-recurring-run-${uid}`;
  const lastRun = parseInt(sessionStorage.getItem(cooldownKey) || "0", 10);
  if (uid && Date.now() - lastRun < 60000) {
    recurringProcessed = true;
    return;
  }
  if (uid) sessionStorage.setItem(cooldownKey, String(Date.now()));
  recurringProcessed = true;
  processRecurringExpenses();
}

async function processRecurringExpenses() {
  if (!appState.recurringExpenses.length) return;

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();
  const userId = appState.currentUser?.uid;
  if (!userId) return;

  let gapStartYear = currentYear;
  let gapStartMonth = currentMonth;

  if (appState.transactions.length > 0) {
    let latestDate = null;
    for (const tx of appState.transactions) {
      if (tx.date) {
        const d = new Date(tx.date + "T00:00:00");
        if (!latestDate || d > latestDate) latestDate = d;
      }
    }
    if (latestDate) {
      const ly = latestDate.getFullYear();
      const lm = latestDate.getMonth();
      if (ly < currentYear || lm < currentMonth) {
        gapStartMonth = lm + 1;
        gapStartYear = ly;
        if (gapStartMonth > 11) {
          gapStartMonth = 0;
          gapStartYear++;
        }
        const cap = new Date(currentYear, currentMonth - 11, 1);
        if (new Date(gapStartYear, gapStartMonth, 1) < cap) {
          gapStartYear = cap.getFullYear();
          gapStartMonth = cap.getMonth();
        }
      }
    }
  }

  const existingKeys = new Set(
    appState.transactions.map(
      (t) => `${t.date}_${t.category}_${(t.description || "").replace(/\s*®\s*$/, "").toLowerCase()}`,
    ),
  );

  const toCreate = [];
  let y = gapStartYear, m = gapStartMonth;

  while (y < currentYear || (y === currentYear && m <= currentMonth)) {
    const isCurrentMonth = y === currentYear && m === currentMonth;
    const daysToCheck = isCurrentMonth ? currentDay : new Date(y, m + 1, 0).getDate();

    for (const expense of appState.recurringExpenses) {
      const expDay = parseInt(expense.day, 10);
      if (expDay > daysToCheck) continue;

      const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(expDay).padStart(2, "0")}`;
      const alreadyExists = existingKeys.has(
        `${dateStr}_${expense.category}_${(expense.description || "").toLowerCase()}`,
      );
      const coveredByImport =
        !alreadyExists &&
        appState.transactions.some((tx) => {
          if (tx.type !== "expense") return false;
          if (!sharesDescriptionWord(tx.description, expense.description)) return false;
          return withinDays(tx.date, dateStr, 5);
        });

      if (!alreadyExists && !coveredByImport) {
        toCreate.push({
          date: dateStr,
          description: (expense.description || "") + " ®",
          category: expense.category,
          bank: expense.bank,
          amount: expense.sharedAmount > 0 ? expense.sharedAmount : expense.amount,
          type: "expense",
          isRecurring: true,
        });
      }
    }

    m++;
    if (m > 11) { m = 0; y++; }
  }

  if (!toCreate.length) return;

  const txColRef = collection(db, DB_COL(userId, "transactions"));
  try {
    const batch = writeBatch(db);
    toCreate.forEach((tx) => batch.set(doc(txColRef), tx));
    await batch.commit();
    showToast(`${toCreate.length} gasto(s) recurrente(s) registrado(s) automáticamente.`, "success");
  } catch (err) {
    console.error("[Auto-Registro] Error al registrar recurrentes:", err);
  }
}

/* ===================================================================
   RECORDATORIOS DE VENCIMIENTO
   =================================================================== */
export function checkRecurringPaymentReminders() {
  const today = new Date();

  appState.recurringExpenses.forEach((exp) => {
    const day = parseInt(exp.day, 10);
    for (let ahead = 1; ahead <= 3; ahead++) {
      const target = new Date(today);
      target.setDate(today.getDate() + ahead);
      if (target.getDate() !== day) continue;
      const targetKey = target.toISOString().split("T")[0];
      const msg =
        ahead === 1
          ? `Recordatorio: Mañana vence "${exp.description}" — ${formatCurrency(exp.amount, appState.currency)}.`
          : `Recordatorio: En ${ahead} días vence "${exp.description}" — ${formatCurrency(exp.amount, appState.currency)}.`;
      const toastKey = `reminder-${exp.id}-${targetKey}`;
      if (!sessionStorage.getItem(toastKey)) {
        showToast(msg, "warning");
        sessionStorage.setItem(toastKey, "1");
      }
      const notifKey = `notif-rec-${exp.id}-${targetKey}`;
      if (!localStorage.getItem(notifKey)) {
        sendBrowserNotification("Foresee — Gasto recurrente", msg);
        localStorage.setItem(notifKey, "1");
      }
    }
  });
}
